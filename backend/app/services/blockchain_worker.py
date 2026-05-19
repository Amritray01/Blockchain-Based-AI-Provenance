"""
blockchain_worker.py — Background Flusher Thread
=================================================
Runs every 3 seconds (via worker_runner.py) and flushes two queues:

  1. MACRO TRACK — Datasets with txHash IS NULL
     → contract.anchorDatasetHash(bytes32 hash, bytes32 prevHash)

  2. MICRO TRACK  — InferenceBatches with status = 'PENDING'
     → contract.anchorBatchRoot(uint256 batchId, bytes32 merkleRoot, bytes32 modelHash)

Contract function signatures (from Provenance.sol ABI):
  anchorDatasetHash(bytes32 _hash, bytes32 _prevHash)
  anchorBatchRoot(uint256 _batchId, bytes32 _merkleRoot, bytes32 _modelHash)
"""

import os
import json
from app.services.db import get_conn
from web3 import Web3

# ── Web3 + ABI Setup ───────────────────────────────────────────────────────────

w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))

# Resolve ABI path: backend/app/services → blockChain/contract/artifacts/…
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ABI_PATH = os.path.join(
    BASE_DIR, "..", "contract", "artifacts", "contracts",
    "Provenance.sol", "Provenance.json"
)

try:
    with open(ABI_PATH, "r") as f:
        ABI = json.load(f)["abi"]
    print(f"[blockchain_worker] ABI loaded from {ABI_PATH}")
except FileNotFoundError:
    print(f"[blockchain_worker] CRITICAL: ABI not found at {ABI_PATH}")
    ABI = None

CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3"

contract = None
hardhat_account = None

if ABI and w3.is_connected():
    try:
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=ABI
        )
        hardhat_account = w3.eth.accounts[0]
        print(f"[blockchain_worker] Connected to Hardhat. Account: {hardhat_account}")
    except Exception as exc:
        print(f"[blockchain_worker] Contract init failed: {exc}")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _hex_to_bytes32(hex_str: str) -> bytes:
    """
    Convert a 0x-prefixed hex string (or raw hex) to a right-padded 32-byte value
    suitable for Solidity bytes32 parameters.
    """
    if not hex_str:
        return b"\x00" * 32
    clean = hex_str.removeprefix("0x").lower()
    # Pad or truncate to 32 bytes
    raw = bytes.fromhex(clean.ljust(64, "0")[:64])
    return raw


# ── Macro Track: Dataset Anchoring ────────────────────────────────────────────

def _anchor_pending_datasets(conn):
    """
    Fetch all Datasets with txHash IS NULL and anchor each via
    contract.anchorDatasetHash(bytes32 _hash, bytes32 _prevHash).
    """
    cur = conn.cursor()
    cur.execute(
        "SELECT hash, prevHash FROM Datasets WHERE txHash IS NULL ORDER BY timestamp ASC"
    )
    pending = cur.fetchall()

    for ds_hash, prev_hash in pending:
        try:
            hash_bytes    = _hex_to_bytes32(ds_hash)
            prev_bytes    = _hex_to_bytes32(prev_hash) if prev_hash else b"\x00" * 32

            tx = contract.functions.anchorDatasetHash(
                hash_bytes, prev_bytes
            ).transact({"from": hardhat_account})

            receipt = w3.eth.wait_for_transaction_receipt(tx)

            cur.execute(
                "UPDATE Datasets SET txHash = ?, blockNumber = ? WHERE hash = ?",
                (tx.hex(), receipt.blockNumber, ds_hash),
            )
            conn.commit()
            print(
                f"[blockchain_worker] Dataset anchored: {ds_hash[:16]}… "
                f"block={receipt.blockNumber} tx={tx.hex()[:16]}…"
            )

        except Exception as exc:
            print(f"[blockchain_worker] Dataset anchor failed for {ds_hash[:16]}…: {exc}")
            # Leave txHash as NULL — will retry next cycle


# ── Relational Link: Model Anchoring ──────────────────────────────────────────

def _anchor_pending_models(conn):
    """
    Fetch all AIModels with txHash IS NULL and anchor each via
    contract.registerModel(bytes32 _modelHash, bytes32 _datasetHash, bytes32 _unused).

    Pre-condition: the model's linked dataset MUST already be anchored
    (contract reverts with "Training dataset not anchored" otherwise).
    So we only pick models whose datasetHash has a non-NULL txHash.
    """
    cur = conn.cursor()
    cur.execute(
        """
        SELECT m.modelHash, m.datasetHash
        FROM   AIModels m
        JOIN   Datasets d ON m.datasetHash = d.hash
        WHERE  m.txHash IS NULL
          AND  d.txHash IS NOT NULL
        ORDER  BY m.timestamp ASC
        """
    )
    pending = cur.fetchall()

    for model_hash, dataset_hash in pending:
        try:
            model_bytes   = _hex_to_bytes32(model_hash)
            dataset_bytes = _hex_to_bytes32(dataset_hash)
            unused_bytes  = b"\x00" * 32

            # ABI: registerModel(bytes32 _modelHash, bytes32 _datasetHash, bytes32)
            tx = contract.functions.registerModel(
                model_bytes, dataset_bytes, unused_bytes
            ).transact({"from": hardhat_account})

            receipt = w3.eth.wait_for_transaction_receipt(tx)

            cur.execute(
                "UPDATE AIModels SET txHash = ?, blockNumber = ? WHERE modelHash = ?",
                (tx.hex(), receipt.blockNumber, model_hash),
            )
            conn.commit()
            print(
                f"[blockchain_worker] Model anchored: {model_hash[:16]}… "
                f"block={receipt.blockNumber} tx={tx.hex()[:16]}…"
            )

        except Exception as exc:
            print(f"[blockchain_worker] Model anchor failed for {model_hash[:16]}…: {exc}")


# ── Micro Track: InferenceBatch Anchoring ─────────────────────────────────────

def _anchor_pending_batches(conn):
    """
    Fetch all InferenceBatches with status = 'PENDING' and anchor each via
    contract.anchorBatchRoot(uint256 _batchId, bytes32 _merkleRoot, bytes32 _modelHash).

    Pre-condition: the model must be registered on-chain first.
    """
    cur = conn.cursor()
    cur.execute(
        """
        SELECT b.batchId, b.merkleRoot, b.modelHash
        FROM   InferenceBatches b
        JOIN   AIModels m ON b.modelHash = m.modelHash
        WHERE  b.status = 'PENDING'
          AND  b.merkleRoot IS NOT NULL
          AND  m.txHash IS NOT NULL
        ORDER  BY b.timestamp ASC
        """
    )
    pending = cur.fetchall()

    for batch_id, merkle_root, model_hash in pending:
        try:
            merkle_bytes = _hex_to_bytes32(merkle_root)
            model_bytes  = _hex_to_bytes32(model_hash)

            tx = contract.functions.anchorBatchRoot(
                int(batch_id), merkle_bytes, model_bytes
            ).transact({"from": hardhat_account})

            receipt = w3.eth.wait_for_transaction_receipt(tx)

            cur.execute(
                """
                UPDATE InferenceBatches
                SET    status = 'MINED', txHash = ?, blockNumber = ?
                WHERE  batchId = ?
                """,
                (tx.hex(), receipt.blockNumber, batch_id),
            )
            conn.commit()
            print(
                f"[blockchain_worker] Batch {batch_id} anchored: "
                f"root={merkle_root[:16]}… block={receipt.blockNumber}"
            )

        except Exception as exc:
            print(
                f"[blockchain_worker] Batch {batch_id} anchor failed: {exc}"
            )
            cur.execute(
                "UPDATE InferenceBatches SET status = 'FAILED' WHERE batchId = ?",
                (batch_id,),
            )
            conn.commit()


# ── Public Entry Point ─────────────────────────────────────────────────────────

def process_pending():
    """
    Called every 3 s by worker_runner.py.
    Order: Datasets → Models → Batches (respects on-chain dependency chain).
    """
    if not contract or not hardhat_account:
        return

    if not w3.is_connected():
        print("[blockchain_worker] Hardhat not connected — skipping cycle.")
        return

    conn = get_conn()
    try:
        _anchor_pending_datasets(conn)
        _anchor_pending_models(conn)
        _anchor_pending_batches(conn)
    finally:
        conn.close()
"""
model_service.py — Relational Link Layer
==========================================
Manages AIModels — the bridge between the Macro track (Datasets) and
the Micro track (InferenceBatches).

Every model MUST be linked to exactly one Training Dataset hash (FK enforced
by SQLite and on-chain by Provenance.sol::registerModel).

Model registration now accepts an absolute path to a .pkl file on D: Drive.
The file is stream-hashed (same 8 KB chunk approach as datasets) so large
model files never consume significant RAM.
"""

from datetime import datetime
from pathlib import Path
from app.services.db import get_conn
from app.services.hash_service import stream_sha256_file


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def register_model(
    file_path: str,
    dataset_hash: str,
    wallet: str,
    lineage_id: str,
) -> dict:
    """
    Register a .pkl model file by streaming its SHA-256 hash and link it
    to its Training Dataset.

    Parameters
    ----------
    file_path    : Absolute path to the .pkl file on D: Drive.
                   Stream-hashed in 8 KB chunks — never fully loaded into RAM.
    dataset_hash : SHA-256 hash of the Training Dataset (must exist in Datasets).
    wallet       : MetaMask wallet that owns this model.
    lineage_id   : Groups model versions together (same as the dataset lineageId).

    Returns
    -------
    dict with modelHash, datasetHash, filePath, and prevModelHash.

    Raises
    ------
    FileNotFoundError  if file_path does not exist.
    ValueError         if dataset_hash is not found in the Datasets table.
    """
    # Validate file exists before touching the DB
    p = Path(file_path)
    if not p.exists():
        raise FileNotFoundError(
            f"Model file not found: {file_path}\n"
            "Ensure the .pkl is saved to D: Drive and the path is correct."
        )

    # Stream-hash the .pkl file (8 KB chunks, negligible RAM)
    model_hash = stream_sha256_file(file_path)

    conn = get_conn()
    cur  = conn.cursor()
    try:
        # Tier-1: Verify the linked Training Dataset exists (Macro guard)
        cur.execute("SELECT hash FROM Datasets WHERE hash = ?", (dataset_hash,))
        if not cur.fetchone():
            raise ValueError(
                f"Training dataset '{dataset_hash}' not found in Datasets table. "
                "Register the dataset first via POST /dataset/register."
            )

        # Resolve previous model in the same lineage
        cur.execute(
            """
            SELECT modelHash FROM AIModels
            WHERE wallet = ? AND lineageId = ?
            ORDER BY timestamp DESC
            LIMIT 1
            """,
            (wallet, lineage_id),
        )
        prev_row        = cur.fetchone()
        prev_model_hash = prev_row[0] if prev_row else None

        cur.execute(
            """
            INSERT OR IGNORE INTO AIModels
                (modelHash, wallet, lineageId, datasetHash, filePath, prevModelHash, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (model_hash, wallet, lineage_id, dataset_hash, file_path, prev_model_hash, _now()),
        )
        conn.commit()

    finally:
        conn.close()

    return {
        "modelHash":     model_hash,
        "wallet":        wallet,
        "lineageId":     lineage_id,
        "datasetHash":   dataset_hash,
        "filePath":      file_path,
        "prevModelHash": prev_model_hash,
    }


def get_model_filepath(model_hash: str) -> str | None:
    """
    Look up the .pkl file path for a registered model.
    Called by batch_service before loading the model for inference.
    """
    conn = get_conn()
    cur  = conn.cursor()
    try:
        cur.execute("SELECT filePath FROM AIModels WHERE modelHash = ?", (model_hash,))
        row = cur.fetchone()
    finally:
        conn.close()
    return row[0] if row else None


def list_models(wallet: str | None = None) -> list[dict]:
    """
    List all registered models, JOINed with their linked Training Dataset metadata.
    Ordered newest-first.
    """
    conn = get_conn()
    cur  = conn.cursor()
    try:
        query = """
            SELECT
                m.modelHash, m.wallet, m.lineageId, m.datasetHash,
                m.timestamp, m.prevModelHash, m.txHash, m.blockNumber,
                m.filePath,
                d.version        AS datasetVersion,
                d.timestamp      AS datasetTimestamp,
                d.datasetType    AS datasetType
            FROM AIModels m
            LEFT JOIN Datasets d ON m.datasetHash = d.hash
        """
        params = []
        if wallet:
            query += " WHERE m.wallet = ?"
            params.append(wallet)
        query += " ORDER BY m.timestamp DESC"
        cur.execute(query, params)
        rows = cur.fetchall()
    finally:
        conn.close()

    keys = [
        "modelHash", "wallet", "lineageId", "datasetHash",
        "timestamp", "prevModelHash", "txHash", "blockNumber",
        "filePath", "datasetVersion", "datasetTimestamp", "datasetType",
    ]
    return [dict(zip(keys, r)) for r in rows]


def get_model(model_hash: str) -> dict | None:
    """Fetch a single AIModels record by its hash."""
    conn = get_conn()
    cur  = conn.cursor()
    try:
        cur.execute(
            """
            SELECT modelHash, wallet, lineageId, datasetHash,
                   timestamp, prevModelHash, txHash, blockNumber, filePath
            FROM AIModels WHERE modelHash = ?
            """,
            (model_hash,),
        )
        row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return None
    keys = ["modelHash", "wallet", "lineageId", "datasetHash",
            "timestamp", "prevModelHash", "txHash", "blockNumber", "filePath"]
    return dict(zip(keys, row))
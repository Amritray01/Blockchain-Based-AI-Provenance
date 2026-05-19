"""
dataset_service.py — Macro Track
=================================
Handles registration of Training and Testing dataset files using the
stream-based SHA-256 hasher so large files on D: Drive are never fully
loaded into RAM (AGENTS.md §7 RAM Constraint).
"""

from datetime import datetime
from app.services.db import get_conn
from app.services.hash_service import stream_sha256_file


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


# ── Public API ─────────────────────────────────────────────────────────────────

def register_dataset(
    file_path: str,
    wallet: str,
    lineage_id: str,
    dataset_type: str = "TRAINING",   # TRAINING | TESTING
) -> dict:
    """
    Macro Track: Register a dataset file by streaming its SHA-256 hash.

    Steps
    -----
    1. Stream-read the file in 8 KB chunks → SHA-256 hash (zero full-file RAM).
    2. Look up previous versions in the same lineage to auto-increment version.
    3. Insert into the Datasets table with the FK-safe prevHash chain.

    Parameters
    ----------
    file_path    : Absolute path to the dataset file on D: Drive.
    wallet       : MetaMask wallet address of the registering user.
    lineage_id   : Logical group identifier that links dataset versions together.
    dataset_type : 'TRAINING' (default) or 'TESTING'.

    Returns
    -------
    dict with hash, version, prevHash, and registration timestamp.

    Raises
    ------
    FileNotFoundError  if file_path does not exist.
    ValueError         if dataset_type is not TRAINING or TESTING.
    """
    if dataset_type not in ("TRAINING", "TESTING"):
        raise ValueError(f"dataset_type must be TRAINING or TESTING, got '{dataset_type}'")

    # MACRO TRACK: stream the file — never loads more than 8 KB into RAM at once
    file_hash = stream_sha256_file(file_path)

    conn = get_conn()
    cur  = conn.cursor()
    try:
        # Resolve previous version in this lineage
        cur.execute(
            """
            SELECT hash FROM Datasets
            WHERE wallet = ? AND lineageId = ? AND datasetType = ?
            ORDER BY version DESC
            LIMIT 1
            """,
            (wallet, lineage_id, dataset_type),
        )
        prev_row = cur.fetchone()
        prev_hash = prev_row[0] if prev_row else None

        # Version counter = current max + 1
        cur.execute(
            """
            SELECT COALESCE(MAX(version), 0) FROM Datasets
            WHERE wallet = ? AND lineageId = ? AND datasetType = ?
            """,
            (wallet, lineage_id, dataset_type),
        )
        version = cur.fetchone()[0] + 1

        cur.execute(
            """
            INSERT OR IGNORE INTO Datasets
                (hash, wallet, lineageId, datasetType, version, prevHash, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (file_hash, wallet, lineage_id, dataset_type, version, prev_hash, _now()),
        )
        conn.commit()

        # If hash already existed (IGNORE fired), fetch its stored version
        if cur.rowcount == 0:
            cur.execute("SELECT version, prevHash, timestamp FROM Datasets WHERE hash = ?", (file_hash,))
            row = cur.fetchone()
            version, prev_hash, ts = row
        else:
            ts = _now()

    finally:
        conn.close()

    return {
        "hash":        file_hash,
        "wallet":      wallet,
        "lineageId":   lineage_id,
        "datasetType": dataset_type,
        "version":     version,
        "prevHash":    prev_hash,
        "timestamp":   ts,
    }


def get_dataset(file_hash: str) -> dict | None:
    """Fetch a single Datasets record by its SHA-256 hash."""
    conn = get_conn()
    cur  = conn.cursor()
    try:
        cur.execute(
            """
            SELECT hash, wallet, lineageId, datasetType, version, prevHash, timestamp, txHash, blockNumber
            FROM Datasets WHERE hash = ?
            """,
            (file_hash,),
        )
        row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return None
    keys = ["hash", "wallet", "lineageId", "datasetType", "version", "prevHash",
            "timestamp", "txHash", "blockNumber"]
    return dict(zip(keys, row))


def list_datasets(wallet: str | None = None, lineage_id: str | None = None) -> list[dict]:
    """
    List all registered datasets, optionally filtered by wallet and/or lineage.
    Ordered newest-first.
    """
    conn = get_conn()
    cur  = conn.cursor()
    try:
        query  = "SELECT hash, wallet, lineageId, datasetType, version, prevHash, timestamp FROM Datasets"
        params = []
        filters = []
        if wallet:
            filters.append("wallet = ?")
            params.append(wallet)
        if lineage_id:
            filters.append("lineageId = ?")
            params.append(lineage_id)
        if filters:
            query += " WHERE " + " AND ".join(filters)
        query += " ORDER BY timestamp DESC"
        cur.execute(query, params)
        rows = cur.fetchall()
    finally:
        conn.close()

    keys = ["hash", "wallet", "lineageId", "datasetType", "version", "prevHash", "timestamp"]
    return [dict(zip(keys, r)) for r in rows]
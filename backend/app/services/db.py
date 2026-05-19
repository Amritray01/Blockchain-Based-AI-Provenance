import sqlite3

DB_NAME = "provenance.db"

def get_conn():
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    # Enforce FK constraints on every connection
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_conn()
    cur = conn.cursor()

    # ── MACRO TRACK ──────────────────────────────────────────────────────────
    # Table 1: Datasets  (Macro objects — SHA-256 file-level integrity)
    # Each row represents one registered Training or Testing dataset file.
    # Primary key is the SHA-256 hash itself so duplicates are naturally rejected.
    cur.execute("""
    CREATE TABLE IF NOT EXISTS Datasets (
        hash        TEXT    PRIMARY KEY,            -- SHA-256 of the raw file content
        wallet      TEXT    NOT NULL,               -- MetaMask wallet that registered it
        lineageId   TEXT    NOT NULL,               -- Groups dataset versions together
        datasetType TEXT    NOT NULL DEFAULT 'TRAINING',  -- TRAINING | TESTING
        version     INTEGER NOT NULL DEFAULT 1,     -- Auto-incremented per lineage
        prevHash    TEXT    REFERENCES Datasets(hash) ON DELETE SET NULL,
        timestamp   TEXT    NOT NULL,               -- UTC registration time
        txHash      TEXT,                           -- Hardhat tx that anchored this hash
        blockNumber INTEGER                         -- Block the tx was mined in
    )
    """)

    # ── RELATIONAL LINK ───────────────────────────────────────────────────────
    # Table 2: AIModels  (links every model to exactly one Training Dataset)
    # CRITICAL per AGENTS.md §6: Every Model Hash MUST be linked to a Training Dataset ID.
    cur.execute("""
    CREATE TABLE IF NOT EXISTS AIModels (
        modelHash       TEXT    PRIMARY KEY,
        wallet          TEXT    NOT NULL,
        lineageId       TEXT    NOT NULL,
        datasetHash     TEXT    NOT NULL
                            REFERENCES Datasets(hash) ON DELETE RESTRICT,
        filePath        TEXT,                           -- Absolute path to .pkl on D: Drive
        prevModelHash   TEXT    REFERENCES AIModels(modelHash) ON DELETE SET NULL,
        timestamp       TEXT    NOT NULL,
        txHash          TEXT,
        blockNumber     INTEGER
    )
    """)

    # Migration: add filePath if upgrading an existing DB that doesn't have it yet
    try:
        cur.execute("ALTER TABLE AIModels ADD COLUMN filePath TEXT")
    except Exception:
        pass  # Column already exists — safe to ignore

    # Migration: add Datasets columns that may be missing on older schema DBs
    for _col, _dflt in [
        ("datasetType", "'TRAINING'"),
        ("version",     "1"),
        ("prevHash",    "NULL"),
        ("txHash",      "NULL"),
        ("blockNumber", "NULL"),
    ]:
        try:
            cur.execute(f"ALTER TABLE Datasets ADD COLUMN {_col} TEXT DEFAULT {_dflt}")
        except Exception:
            pass  # Column already exists


    # ── MICRO TRACK ───────────────────────────────────────────────────────────
    # Table 3: InferenceBatches  (Micro objects — Merkle Root row-level integrity)
    # Each batch covers ≤1000 rows processed in 4 × 250-row serial segments.
    # CRITICAL per AGENTS.md §6: Every Inference Batch MUST be linked to a Model Hash.
    cur.execute("""
    CREATE TABLE IF NOT EXISTS InferenceBatches (
        batchId         INTEGER PRIMARY KEY AUTOINCREMENT,
        modelHash       TEXT    NOT NULL            -- FK → AIModels.modelHash
                            REFERENCES AIModels(modelHash) ON DELETE RESTRICT,
        wallet          TEXT    NOT NULL,
        merkleRoot      TEXT    NOT NULL,           -- Merkle Root of all 4 segment roots
        seg0Root        TEXT,                       -- Root for rows   0-249
        seg1Root        TEXT,                       -- Root for rows 250-499
        seg2Root        TEXT,                       -- Root for rows 500-749
        seg3Root        TEXT,                       -- Root for rows 750-999
        rowCount        INTEGER NOT NULL DEFAULT 0,
        status          TEXT    NOT NULL DEFAULT 'PENDING',  -- PENDING | MINED | FAILED
        txHash          TEXT,                       -- Hardhat tx that anchored the root
        blockNumber     INTEGER,
        timestamp       TEXT    NOT NULL
    )
    """)

    # ── MICRO ROW LOG ─────────────────────────────────────────────────────────
    # Table 4: Predictions  (individual inference rows, linked to a batch)
    # Kept separate so we can do per-row Merkle proof lookups (GET /verify/proof/{row_id}).
    cur.execute("""
    CREATE TABLE IF NOT EXISTS Predictions (
        key         TEXT    PRIMARY KEY,            -- SHA-256(inputHash + outputHash)
        batchId     INTEGER NOT NULL
                        REFERENCES InferenceBatches(batchId) ON DELETE CASCADE,
        modelHash   TEXT    NOT NULL
                        REFERENCES AIModels(modelHash) ON DELETE RESTRICT,
        inputHash   TEXT    NOT NULL,
        outputHash  TEXT    NOT NULL,
        wallet      TEXT    NOT NULL,
        sequence    INTEGER NOT NULL,               -- Row position within the batch (0-based)
        prevHash    TEXT,                           -- Chain link to previous prediction
        timestamp   TEXT    NOT NULL
    )
    """)

    # ── PERFORMANCE INDICES ───────────────────────────────────────────────────
    # Macro track
    cur.execute("CREATE INDEX IF NOT EXISTS idx_datasets_lineage  ON Datasets(lineageId)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_datasets_wallet   ON Datasets(wallet)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_datasets_type     ON Datasets(datasetType)")

    # Relational link
    cur.execute("CREATE INDEX IF NOT EXISTS idx_models_dataset    ON AIModels(datasetHash)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_models_lineage    ON AIModels(lineageId)")

    # Micro track
    cur.execute("CREATE INDEX IF NOT EXISTS idx_batches_model     ON InferenceBatches(modelHash)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_batches_status    ON InferenceBatches(status)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_batches_merkle    ON InferenceBatches(merkleRoot)")

    # Row log
    cur.execute("CREATE INDEX IF NOT EXISTS idx_preds_batch       ON Predictions(batchId)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_preds_model       ON Predictions(modelHash)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_preds_sequence    ON Predictions(batchId, sequence)")

    conn.commit()
    conn.close()
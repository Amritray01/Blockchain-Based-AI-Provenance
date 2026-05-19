"""
batch_service.py — Micro Track
================================
Implements the 25%-serial chunking inference pipeline described in AGENTS.md §3:

  1 000-row batch  →  4 × 250-row segments  (processed serially to cap RAM)
                                ↓
                    per-segment Merkle Root  (rows 0-249, 250-499, 500-749, 750-999)
                                ↓
               aggregate Merkle Root  (combines the 4 segment roots)
                                ↓
             written to InferenceBatches + individual rows to Predictions

Model Loading
--------------
The registered .pkl file path is fetched from AIModels and loaded ONCE per
batch call using joblib.load().  The model object is passed into every segment
so it is never reloaded per row — keeping RAM usage flat on the i5/8 GB machine.
"""

import json
import joblib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.services.db import get_conn
from app.services.hash_service import hash_dict, sha256, merkle_root, aggregate_segment_roots
from app.services.model_service import get_model_filepath

# ── Constants ──────────────────────────────────────────────────────────────────

SEGMENTS      = 4          # 25% split per AGENTS.md
SEGMENT_ROWS  = 250        # Target rows per segment (1 000 / 4)


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


# ── Private: Load .pkl model ──────────────────────────────────────────────────

def _load_model(model_hash: str):
    """
    Load a registered .pkl model from D: Drive using joblib.
    Called ONCE per batch — the returned object is reused for all 1 000 rows.
    Returns None if the model path is missing or the file can't be loaded,
    in which case inference falls back to the placeholder.
    """
    file_path = get_model_filepath(model_hash)
    if not file_path:
        print(f"[batch_service] No filePath registered for model {model_hash[:12]}… — using placeholder")
        return None

    p = Path(file_path)
    if not p.exists():
        print(f"[batch_service] .pkl not found at {file_path} — using placeholder")
        return None

    try:
        model = joblib.load(file_path)
        print(f"[batch_service] Loaded model from {file_path}")
        return model
    except Exception as exc:
        print(f"[batch_service] joblib.load failed: {exc} — using placeholder")
        return None


# ── Private: Inference ─────────────────────────────────────────────────────────

def _infer_row(row: dict, model=None) -> dict:
    """
    Run inference on a single row dict.

    Strategy (in priority order)
    ----------------------------
    1. Real sklearn/joblib model — try predict_proba first, then predict.
       Feature values are extracted as a list in dict-insertion order.
    2. Fallback placeholder — mean of numeric values, thresholded at 5.

    The returned dict is always deterministic so SHA-256 hashing is stable.
    """
    if model is not None:
        try:
            features = []
            for v in row.values():
                try:
                    features.append(float(v))
                except (TypeError, ValueError):
                    features.append(0.0)

            X = [features]  # shape (1, n_features)

            if hasattr(model, 'predict_proba'):
                proba  = model.predict_proba(X)[0]          # e.g. [0.2, 0.8]
                label  = model.classes_[proba.argmax()]
                score  = round(float(proba.max()), 4)
            else:
                label  = str(model.predict(X)[0])
                score  = 1.0  # binary predict gives no probability

            return {"label": str(label), "score": score}

        except Exception as exc:
            print(f"[batch_service] Model inference failed on row: {exc} — using placeholder")
            # Fall through to placeholder

    # ── Placeholder (no model loaded or inference error) ─────────────────────
    try:
        values = [float(v) for v in row.values() if v != ""]
        score  = round(sum(values) / len(values), 3) if values else 0.0
    except (TypeError, ValueError):
        score = 0.0
    return {"label": "High Risk" if score > 5 else "Low Risk", "score": score}


# ── Private: One Segment (25%) ─────────────────────────────────────────────────

def _process_segment(
    rows: List[dict],
    model=None,
) -> tuple[List[str], List[tuple]]:
    """
    Run inference and build per-row hashes for one 250-row segment.
    `model` is the loaded joblib object (or None for placeholder).
    """
    row_keys    : List[str]   = []
    insert_data : List[tuple] = []

    for row in rows:
        try:
            result      = _infer_row(row, model)            # ← pass model
            input_hash  = hash_dict(row)
            output_hash = hash_dict(result)
            key         = sha256(input_hash[2:] + output_hash[2:])

            row_keys.append(key)
            insert_data.append((key, input_hash, output_hash))
        except Exception as exc:
            print(f"[batch_service] Row skipped: {exc}")

    return row_keys, insert_data


# ── Public API ─────────────────────────────────────────────────────────────────

def run_batch_prediction(
    dataset: List[Dict[str, Any]],
    model_hash: str,
    wallet: str,
) -> dict:
    """
    Micro Track: Process up to 1 000 rows in 4 serial 25% segments.

    For each segment
    ~~~~~~~~~~~~~~~~
    1. Run inference row-by-row (only 250 rows in memory at once).
    2. Hash each (input, output) pair → row key.
    3. Build a Merkle Root from the 250 row keys.
    4. Commit segment rows to Predictions (checkpoint after each 25%).

    After all segments
    ~~~~~~~~~~~~~~~~~~
    5. Combine the 4 segment roots into one aggregate batch Merkle Root.
    6. Insert the InferenceBatches record (FK → AIModels).
    7. Return a summary with all four segment roots + the aggregate root.

    Parameters
    ----------
    dataset    : List of dicts — at most 1 000 rows.
    model_hash : Must exist in AIModels table (FK enforced by SQLite).
    wallet     : MetaMask wallet of the caller.

    Returns
    -------
    dict with batchId, aggregateMerkleRoot, four segRoots, and per-segment summaries.

    Raises
    ------
    ValueError  if model_hash is not registered in AIModels.
    """
    conn = get_conn()
    cur  = conn.cursor()

    # Verify the model exists (Tier-1 check before touching Micro tables)
    cur.execute("SELECT modelHash FROM AIModels WHERE modelHash = ?", (model_hash,))
    if not cur.fetchone():
        conn.close()
        raise ValueError(f"Model '{model_hash}' is not registered. Register it first.")

    # Load the .pkl ONCE here — reused across all 4 segments
    model = _load_model(model_hash)

    total = len(dataset)

    # Dynamic 25% split: segment size = ceil(total / 4)
    import math
    segment_size = max(1, math.ceil(total / SEGMENTS))

    # Resolve previous prediction key for chain-linking
    cur.execute("SELECT key FROM Predictions ORDER BY timestamp DESC LIMIT 1")
    last = cur.fetchone()
    prev_hash_global = last[0] if last else "GENESIS"

    cur.execute("SELECT COUNT(*) FROM Predictions")
    global_sequence = cur.fetchone()[0]

    # ── Serial 25% segments ────────────────────────────────────────────────────
    seg_roots  : List[str | None] = []
    seg_summaries = []

    for seg_idx in range(SEGMENTS):
        start = seg_idx * segment_size
        end   = min(start + segment_size, total)
        seg_rows = dataset[start:end]

        if not seg_rows:
            seg_roots.append(None)
            continue

        row_keys, insert_data = _process_segment(seg_rows, model)  # pass loaded model

        # Per-segment Merkle Root (covers 250 rows)
        seg_root = merkle_root(row_keys)
        seg_roots.append(seg_root)

        # Insert rows into Predictions (checkpoint every 25%)
        for i, (key, in_h, out_h) in enumerate(insert_data):
            cur.execute(
                """
                INSERT OR IGNORE INTO Predictions
                    (key, batchId, modelHash, inputHash, outputHash,
                     wallet, sequence, prevHash, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    key,
                    None,            # batchId filled after InferenceBatches insert below
                    model_hash,
                    in_h,
                    out_h,
                    wallet,
                    global_sequence + i,
                    prev_hash_global,
                    _now(),
                ),
            )
            prev_hash_global = key

        global_sequence += len(insert_data)

        # CHECKPOINT — release memory lock after each 25%
        conn.commit()

        seg_summaries.append({
            "segment":     seg_idx,
            "rows":        len(row_keys),
            "startRow":    start,
            "endRow":      end - 1,
            "segMerkleRoot": seg_root,
        })

    # ── Aggregate the four segment roots into one batch root ───────────────────
    batch_merkle_root = aggregate_segment_roots(seg_roots)

    # ── Persist InferenceBatches (all FKs now resolvable) ─────────────────────
    cur.execute(
        """
        INSERT INTO InferenceBatches
            (modelHash, wallet, merkleRoot,
             seg0Root, seg1Root, seg2Root, seg3Root,
             rowCount, status, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            model_hash,
            wallet,
            batch_merkle_root,
            seg_roots[0],
            seg_roots[1] if len(seg_roots) > 1 else None,
            seg_roots[2] if len(seg_roots) > 2 else None,
            seg_roots[3] if len(seg_roots) > 3 else None,
            total,
            "PENDING",
            _now(),
        ),
    )
    batch_id = cur.lastrowid

    # Back-fill the batchId on all Predictions that were inserted as None
    cur.execute(
        "UPDATE Predictions SET batchId = ? WHERE batchId IS NULL AND modelHash = ? AND wallet = ?",
        (batch_id, model_hash, wallet),
    )

    conn.commit()
    conn.close()

    return {
        "batchId":             batch_id,
        "modelHash":           model_hash,
        "wallet":              wallet,
        "totalRows":           total,
        "aggregateMerkleRoot": batch_merkle_root,
        "seg0Root":            seg_roots[0],
        "seg1Root":            seg_roots[1] if len(seg_roots) > 1 else None,
        "seg2Root":            seg_roots[2] if len(seg_roots) > 2 else None,
        "seg3Root":            seg_roots[3] if len(seg_roots) > 3 else None,
        "segments":            seg_summaries,
        "status":              "PENDING",
    }
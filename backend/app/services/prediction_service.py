import json
import hashlib
from app.services.db import get_conn
from app.services.hash_service import sha256
from datetime import datetime

def now():
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

def compute_merkle_root(hashes):
    """Recursively computes a Merkle Root from a list of hashes."""
    if not hashes:
        return None
    if len(hashes) == 1:
        return hashes[0]

    new_level = []
    for i in range(0, len(hashes), 2):
        left = hashes[i]
        # If odd number of hashes, duplicate the last one
        right = hashes[i+1] if i+1 < len(hashes) else left 
        combined = left + right
        new_level.append(sha256(combined))

    return compute_merkle_root(new_level)

def run_prediction(dataset, modelHash, wallet):
    conn = get_conn()
    cur = conn.cursor()

    total = len(dataset)
    batch_size = max(1, total // 4) # 25% chunks

    # Fetch global state to maintain continuous lineage across runs
    cur.execute("SELECT key FROM predictions ORDER BY timestamp DESC LIMIT 1")
    last_row = cur.fetchone()
    prev_hash_global = last_row[0] if last_row else "GENESIS"
    
    cur.execute("SELECT COUNT(*) FROM predictions")
    sequence = cur.fetchone()[0]

    batch_summaries = []

    for batch_id in range(4):
        start = batch_id * batch_size
        end = (batch_id + 1) * batch_size if batch_id < 3 else total
        batch = dataset[start:end]

        batch_data_to_insert = []
        batch_keys = [] # Collected strictly for the Merkle Tree

        # 1. Process Inference and Hashing
        for row in batch:
            try:
                values = [float(v) for v in row.values() if v != ""]
                score = sum(values) / len(values) if values else 0
                result = {"label": "High Risk" if score > 5 else "Low Risk", "score": round(score, 3)}

                input_hash = sha256(json.dumps(row, sort_keys=True))
                output_hash = sha256(json.dumps(result, sort_keys=True))
                key = input_hash + output_hash

                batch_keys.append(key)
                batch_data_to_insert.append((key, input_hash, output_hash, result))
            except Exception as e:
                print(f"Row failed: {e}")

        if not batch_keys:
            continue

        # 2. Generate the Merkle Root for this 25% Batch
        merkle_root = compute_merkle_root(batch_keys)

        # 3. Database Insertion (Attaching the Merkle Root)
        for data in batch_data_to_insert:
            key, in_h, out_h, _ = data
            
            cur.execute("""
                INSERT OR IGNORE INTO predictions 
                (key, inputHash, outputHash, modelHash, wallet, timestamp, 
                 status, batchId, sequence, prevHash, merkleRoot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                key, in_h, out_h, modelHash, wallet, now(),
                "PENDING", batch_id, sequence, prev_hash_global, merkle_root
            ))
            
            prev_hash_global = key
            sequence += 1

        # Checkpoint memory to DB
        conn.commit()
        
        batch_summaries.append({
            "batchId": batch_id,
            "merkleRoot": merkle_root,
            "rows_processed": len(batch_keys)
        })

    conn.close()
    return {
        "status": "Success",
        "batches": batch_summaries
    }
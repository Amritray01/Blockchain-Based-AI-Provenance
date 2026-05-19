from app.services.db import get_conn

def get_lineage(modelHash):
    conn = get_conn()
    cur = conn.cursor()

    # 1. Get Model Info
    cur.execute("SELECT * FROM models WHERE modelHash=?", (modelHash,))
    model_row = cur.fetchone()
    if not model_row:
        return {"error": "Model not found"}

    # 2. Get Linked Dataset (Lineage Link)
    dataset_hash = model_row[3] # datasetHash column
    cur.execute("SELECT * FROM datasets WHERE hash=?", (dataset_hash,))
    dataset_row = cur.fetchone()

    # 3. Get All Predictions for this Model
    cur.execute("""
        SELECT inputHash, outputHash, status, txHash, batchId 
        FROM predictions 
        WHERE modelHash=? 
        ORDER BY sequence ASC
    """, (modelHash,))
    preds = cur.fetchall()

    conn.close()
    return {
        "model": model_row,
        "dataset": dataset_row,
        "prediction_count": len(preds),
        "batches_processed": list(set([p[4] for p in preds])) # Distinct batch IDs
    }
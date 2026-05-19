from fastapi import APIRouter
from app.schemas.request_models import DatasetReq
from app.services.dataset_service import register_dataset
from app.services.db import get_conn

router = APIRouter(prefix="/dataset", tags=["dataset"])

@router.post("/register")
def create_dataset(req: DatasetReq):
    return register_dataset(req.filePath, req.wallet, req.lineageId, req.datasetType)

@router.get("/list")
def list_datasets():
    """Return all registered datasets ordered newest-first."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT hash, wallet, lineageId, datasetType, version,
                   prevHash, timestamp, txHash, blockNumber
            FROM   Datasets
            ORDER  BY timestamp DESC
        """)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        return rows
    finally:
        conn.close()
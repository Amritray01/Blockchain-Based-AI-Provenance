from fastapi import APIRouter
from app.schemas.request_models import BatchPredictReq
from app.services.batch_service import run_batch_prediction

router = APIRouter(prefix="/batch")

@router.post("/predict")
def batch_predict(req: BatchPredictReq):
    return run_batch_prediction(
        req.dataset,
        req.modelHash,
        req.wallet
    )
from fastapi import APIRouter
from app.schemas.request_models import PredictReq
from app.services.prediction_service import run_prediction

router = APIRouter(prefix="/predict")

@router.post("/")
def predict(req: PredictReq):
    return run_prediction(req.features, req.modelHash, req.wallet)
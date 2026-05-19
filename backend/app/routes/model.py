from fastapi import APIRouter
from app.schemas.request_models import ModelReq
from app.services.model_service import register_model, list_models, get_model

router = APIRouter(prefix="/model")

@router.post("/register")
def create_model(req: ModelReq):
    return register_model(req.filePath, req.datasetHash, req.wallet, req.lineageId)

@router.get("/models")
def get_all_models():
    return list_models()

@router.get("/models/{model_hash}")
def get_one_model(model_hash: str):
    result = get_model(model_hash)
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Model not found")
    return result
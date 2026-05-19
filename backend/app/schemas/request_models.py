from pydantic import BaseModel
from typing import List, Dict, Optional

class DatasetReq(BaseModel):
    filePath: str             # Absolute path to the dataset file on D: Drive
    wallet: str
    lineageId: str
    datasetType: str = "TRAINING"  # TRAINING | TESTING

class ModelReq(BaseModel):
    filePath: str             # Absolute path to the .pkl file on D: Drive
    datasetHash: str          # Must exist in Datasets table
    wallet: str
    lineageId: str

class PredictReq(BaseModel):
    features: Dict
    modelHash: str
    wallet: str

# NEW → Batch support
class BatchPredictReq(BaseModel):
    dataset: List[Dict]
    modelHash: str
    wallet: str

class VerifyPredictionReq(BaseModel):
    inputHash: str
    outputHash: str
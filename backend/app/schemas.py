from pydantic import BaseModel, Field


class PredictionResponse(BaseModel):
    prediction: str = Field(..., examples=["PNEUMONIA"])
    probability: float = Field(..., ge=0.0, le=1.0, examples=[0.91])
    confidence: str = Field(..., examples=["high"])
    explanation: str
    recommendation: str
    heatmap_url: str

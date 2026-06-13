from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import UnidentifiedImageError

from .model import PneumoniaPredictor
from .schemas import PredictionResponse

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
HEATMAP_DIR = STATIC_DIR / "heatmaps"
HEATMAP_DIR.mkdir(parents=True, exist_ok=True)

frontend_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app = FastAPI(
    title="Explainable Pneumonia AI API",
    description="FastAPI service for pneumonia prediction and Grad-CAM heatmap generation.",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in frontend_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
predictor = PneumoniaPredictor(heatmap_dir=HEATMAP_DIR)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": predictor.using_checkpoint,
        "model_mode": "trained_checkpoint" if predictor.using_checkpoint else "demo_heuristic",
        "model_name": predictor.config.model_name if predictor.using_checkpoint else "demo_resnet18",
        "model_info": predictor.model_info(),
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: Request, file: UploadFile = File(...)) -> PredictionResponse:
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload must be an image file.")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = predictor.predict(image_bytes)
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Unable to read uploaded image.") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Prediction failed.") from exc

    heatmap_url = str(request.base_url).rstrip("/") + result["heatmap_url"]
    heatmap_raw_url = str(request.base_url).rstrip("/") + result["heatmap_raw_url"]
    return PredictionResponse(**{**result, "heatmap_url": heatmap_url, "heatmap_raw_url": heatmap_raw_url})

# Explainable Pneumonia AI

Complete MVP for explainable chest X-ray pneumonia screening.

A doctor uploads a chest X-ray image and receives:

1. Pneumonia prediction
2. Confidence score
3. Visual explanation as a Grad-CAM heatmap
4. Human-readable explanation
5. Clinical recommendation

> Clinical safety note: this MVP is for demonstration and workflow prototyping only. It is not a certified medical device and must not be used as a standalone diagnosis.

## Tech stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS

### Backend

- FastAPI
- PyTorch
- ResNet18

## Project structure

```text
.
├── backend
│   ├── app
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── model.py
│   │   └── schemas.py
│   ├── models
│   │   └── .gitkeep
│   ├── static
│   │   └── heatmaps
│   │       └── .gitkeep
│   ├── .env.example
│   └── requirements.txt
├── frontend
│   ├── app
│   │   ├── api
│   │   │   ├── heatmaps
│   │   │   │   └── [filename]
│   │   │   │       └── route.ts
│   │   │   └── predict
│   │   │       └── route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── recommendations
│   │   │   └── page.tsx
│   │   └── results
│   │       └── page.tsx
│   ├── lib
│   │   ├── recommendations.ts
│   │   └── types.ts
│   ├── .env.example
│   ├── eslint.config.mjs
│   ├── next-env.d.ts
│   ├── next.config.ts
│   ├── package.json
│   ├── postcss.config.mjs
│   └── tsconfig.json
├── .gitignore
└── README.md
```

## Backend API

### `POST /predict`

Request: `multipart/form-data` with an image file field named `file`.

Response:

```json
{
  "prediction": "PNEUMONIA",
  "probability": 0.91,
  "confidence": "high",
  "explanation": "Opacity detected in lower right lung",
  "recommendation": "Radiologist review recommended",
  "heatmap_url": "http://localhost:8000/static/heatmaps/example.png",
  "suspicious_region": "lower right lung",
  "region_opacity_score": 0.14,
  "opacity_pattern": "focal",
  "key_findings": [
    "AI pneumonia probability is 91% with high confidence.",
    "Most influential region: lower right lung.",
    "Pattern appears focal, centered on the lower right lung."
  ],
  "model_mode": "demo_heuristic",
  "model_name": "model1_resnet18_pneumonia"
}
```

The backend saves generated heatmaps in `backend/static/heatmaps/` and serves them from `/static/heatmaps/...`.
The structured finding fields power the physician action plan so recommendations can reference the specific
heatmap region, opacity pattern, confidence, and probability for each uploaded X-ray.

## Model behavior

The backend uses a ResNet18 architecture and implements standard Grad-CAM from `model.layer4[-1]`.

When the trained checkpoint is loaded:

- The classifier head matches training: `Dropout → Linear(512,256) → ReLU → Dropout → Linear(256,2)`
- Images are preprocessed as grayscale with 3 channels, resized to 224, and normalized with ImageNet statistics
- Screening uses a `0.20` threshold on the PNEUMONIA model score, not argmax
- Grad-CAM is rendered as a raw influence map without lung masking or heuristic post-processing
- Grad-CAM explains class `1` for PNEUMONIA-like screening and class `0` for NORMAL-like screening

Grad-CAM shows model influence regions, not proven disease location. The UI and API copy state this explicitly.

### Trained model 1 (ResNet18 pneumonia)

Expected files in `backend/models/`:

- `model1_resnet18_pneumonia.pth`
- `model1_config.json`
- `model1_summary.txt`

Quick setup from your Downloads folder:

```bash
bash backend/scripts/setup_model.sh "/Users/nikolausschweigert/Downloads"
```

When `model1_resnet18_pneumonia.pth` is present, the backend auto-loads it and switches from demo heuristics to trained inference + Grad-CAM.
You can override paths with:

```bash
export PNEUMONIA_MODEL_PATH=./models/model1_resnet18_pneumonia.pth
export PNEUMONIA_MODEL_CONFIG=./models/model1_config.json
export PNEUMONIA_MODEL_SUMMARY=./models/model1_summary.txt
```

If no checkpoint is present, the app runs in deterministic MVP/demo mode while still generating explainable heatmaps.

## Gradio demo

A standalone Gradio app is available for quick chest X-ray screening demos with threshold-based
classification and Grad-CAM overlays.

Requirements:

- `backend/models/model1_resnet18_pneumonia.pth`
- `backend/models/model1_config.json`

Run:

```bash
cd gradio
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The demo opens at `http://localhost:7860` by default.

Model rules implemented in the Gradio app:

- Binary ResNet18 with a custom classifier head
- Threshold screening at `0.20` on the PNEUMONIA model score (not argmax)
- Raw Grad-CAM on `model.layer4[-1]` for every upload, without anatomical masking
- Explains class 1 for PNEUMONIA-like results and class 0 for NORMAL-like results
- UI labels use **Model score**, **Screening threshold**, and **PNEUMONIA-like pattern flagged**

The FastAPI backend now uses the same architecture, preprocessing, threshold logic, and raw Grad-CAM path when the trained checkpoint is loaded.

Optional environment variables:

```bash
export PNEUMONIA_MODEL_PATH=./backend/models/model1_resnet18_pneumonia.pth
export PNEUMONIA_MODEL_CONFIG=./backend/models/model1_config.json
export GRADIO_SERVER_PORT=7860
```

## Run locally

Open two terminals from the repository root.

### 1. Start the backend

Requires Python 3.9+ (Python 3.10+ recommended).

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
```

The API will be available at:

- `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The web app will be available at `http://localhost:3000`.

By default, browser uploads go to the frontend's same-origin `/api/predict` route.
That Next.js route forwards the image to FastAPI through `BACKEND_INTERNAL_URL`
(`http://127.0.0.1:8000` by default), then rewrites the returned heatmap URL to
`/api/heatmaps/...`. This avoids CORS and `localhost` issues in remote/cloud port
previews.

If your backend is running on a different internal URL, copy `frontend/.env.example`
to `frontend/.env.local` and update:

```bash
BACKEND_INTERNAL_URL=http://127.0.0.1:8000
```

Only set `NEXT_PUBLIC_API_BASE_URL` when the user's browser can directly reach the
FastAPI service.

## User flow

1. Open `http://localhost:3000`.
2. Upload a chest X-ray image.
3. Click **Analyze X-ray**.
4. Review the results page:
   - Original image
   - Prediction card
   - Probability card
   - Confidence card
   - Heatmap card
   - AI explanation card
   - Clinical recommendation card
5. Click **View doctor recommendations** to open the physician action plan:
   - Triage guidance
   - Image-specific findings used for the plan
   - Highlighted-region review steps
   - Pattern-specific interpretation
   - Targeted bedside correlation
   - Case-specific diagnostics and disposition
   - Documentation note

## Development notes

- Frontend upload requests are sent as `multipart/form-data`.
- The homepage supports both explicit file selection and drag-and-drop uploads.
- In development, `next.config.ts` allows common cloud preview origins so client JavaScript can load correctly through forwarded ports.
- The backend allows CORS from `http://localhost:3000` and `http://127.0.0.1:3000` by default.
- To change CORS origins, set `FRONTEND_ORIGINS` as a comma-separated list.
- Generated heatmaps and model checkpoints are ignored by Git.

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
  "model_mode": "demo_heuristic"
}
```

The backend saves generated heatmaps in `backend/static/heatmaps/` and serves them from `/static/heatmaps/...`.
The structured finding fields power the physician action plan so recommendations can reference the specific
heatmap region, opacity pattern, confidence, and probability for each uploaded X-ray.

## Model behavior

The backend uses a ResNet18 architecture and implements Grad-CAM from the final convolutional block.

For a production model, place a trained two-class ResNet18 checkpoint under `backend/models/` and set:

```bash
export PNEUMONIA_MODEL_PATH=./models/pneumonia_resnet18.pt
```

If no checkpoint is provided, the app runs in deterministic MVP/demo mode: ResNet18 still powers the Grad-CAM path, while the probability is derived from a simple opacity-region heuristic so the workflow can be exercised end-to-end.

## Run locally

Open two terminals from the repository root.

### 1. Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
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

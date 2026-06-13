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
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── results
│   │       └── page.tsx
│   ├── lib
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
  "heatmap_url": "http://localhost:8000/static/heatmaps/example.png"
}
```

The backend saves generated heatmaps in `backend/static/heatmaps/` and serves them from `/static/heatmaps/...`.

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
python -m venv .venv
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

If your backend is running on a different URL, copy `frontend/.env.example` to `frontend/.env.local` and update:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

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

## Development notes

- Frontend upload requests are sent as `multipart/form-data`.
- The backend allows CORS from `http://localhost:3000` and `http://127.0.0.1:3000` by default.
- To change CORS origins, set `FRONTEND_ORIGINS` as a comma-separated list.
- Generated heatmaps and model checkpoints are ignored by Git.

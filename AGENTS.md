# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **Explainable Pneumonia AI** app: a FastAPI + PyTorch backend (`backend/`) and a Next.js frontend (`frontend/`). Standard install/run commands live in `README.md`; only the non-obvious caveats are captured here.

### Services
| Service | Dir | Run (dev) | Port | Required |
|---|---|---|---|---|
| Backend (FastAPI/Uvicorn) | `backend/` | `. .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` | 8000 | Yes |
| Frontend (Next.js) | `frontend/` | `npm run dev` | 3000 | Yes |

### Caveats
- The update script installs backend deps into `backend/.venv`. Always activate it (`. backend/.venv/bin/activate`) before running the backend; `uvicorn` must be launched from inside `backend/`.
- Backend deps use CPU-only PyTorch wheels (`--extra-index-url https://download.pytorch.org/whl/cpu`); there is no GPU in this environment.
- On first backend import/startup, torchvision downloads pretrained ResNet18 weights to `~/.cache/torch/hub` (needs network the first time; cached afterward).
- No trained checkpoint is required: without `PNEUMONIA_MODEL_PATH` the backend runs in deterministic `demo_heuristic` mode and the full upload→predict→heatmap flow still works end-to-end.
- Default env values work as-is (no `.env`/`.env.local` needed). The browser uploads to the frontend's same-origin `/api/predict` route, which proxies to FastAPI via `BACKEND_INTERNAL_URL` (default `http://127.0.0.1:8000`) and rewrites heatmap URLs to `/api/heatmaps/...`. Only port 3000 needs to be exposed.
- There are no automated tests. Lint with `npm run lint` in `frontend/`. Verify the backend with `python -c "from app.main import app"` from `backend/` (with the venv active).

# Gradio-only deployment (no local terminal)

Use the `hf_space/` folder to run the pneumonia demo as a **single Gradio website**.

You do **not** need to start the FastAPI backend or the Next.js frontend.

## Option A: Hugging Face Space (recommended, browser only)

1. Open [https://huggingface.co/spaces](https://huggingface.co/spaces) and sign in.
2. Click **Create new Space**.
3. Choose:
   - **SDK:** Gradio
   - **Repository:** connect `nikolausschweigert02/pneumoniawebapp`
   - **App file:** `hf_space/app.py`
4. Upload your model once via the Hugging Face website:
   - Create a model repo, e.g. `your-username/pneumonia-model1`
   - Upload:
     - `model1_resnet18_pneumonia.pth`
     - `model1_config.json`
5. In the Space settings, add this environment variable:
   - `MODEL_REPO_ID=your-username/pneumonia-model1`
6. Open the Space URL, for example:
   - `https://huggingface.co/spaces/your-username/your-space-name`

After that you only need the browser. No Mac terminal.

## Option B: One local Gradio command (only if you want localhost)

```bash
cd hf_space
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp /path/to/model1_resnet18_pneumonia.pth models/
python app.py
```

Open `http://localhost:7860`.

## What this includes

- Trained ResNet18 checkpoint inference
- Screening threshold `0.20`
- Raw Grad-CAM on `model.layer4[-1]`
- Model score labels and clinician/patient/disclaimer copy

## What you can ignore

- `backend/` FastAPI server
- `frontend/` Next.js website

Those are optional. For a Gradio-only demo, only `hf_space/` matters.

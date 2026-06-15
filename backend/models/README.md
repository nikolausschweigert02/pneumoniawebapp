# Trained model files

Place your trained pneumonia model here:

- `model1_resnet18_pneumonia.pth`
- `model1_config.json`
- `model1_summary.txt`

## Quick setup from Downloads (macOS/Linux)

From the repository root:

```bash
bash backend/scripts/setup_model.sh "/Users/nikolausschweigert/Downloads"
```

Or copy manually:

```bash
cp "/Users/nikolausschweigert/Downloads/model1_resnet18_pneumonia.pth" backend/models/
cp "/Users/nikolausschweigert/Downloads/model1_config.json" backend/models/
cp "/Users/nikolausschweigert/Downloads/model1_summary.txt" backend/models/
```

The backend auto-loads `backend/models/model1_resnet18_pneumonia.pth` when present.
Large checkpoint files (`.pth`, `.pt`) are gitignored.

from __future__ import annotations

CONFIDENCE_DISCLAIMER = (
    "This score is not calibrated and must not be interpreted as the clinical probability of pneumonia."
)

GRADCAM_NOTE = (
    "The heatmap highlights regions that influenced the model's prediction. "
    "It does not prove that pneumonia is present and should not be treated as a diagnostic explanation."
)

CLINICIAN_PNEUMONIA_TEXT = (
    "AI-assisted screening result: pneumonia-like pattern flagged. Please review the X-ray manually "
    "and correlate with symptoms, oxygen saturation, temperature, inflammatory markers, prior imaging "
    "and clinical context. Radiologist review is recommended before treatment decisions."
)

CLINICIAN_NORMAL_TEXT = (
    "AI-assisted screening result: normal-like pattern. A normal AI output does not rule out pneumonia. "
    "Please review the image manually and correlate with the clinical context."
)

PATIENT_TEXT = (
    "This demo cannot diagnose disease. The model result does not prove that you have or do not have "
    "pneumonia. A healthcare professional must interpret the X-ray together with symptoms and medical history."
)

DISCLAIMER_TEXT = (
    "Educational research demo only. Not a medical device. Not validated for clinical use. "
    "The result may be wrong and must not replace professional medical judgement. "
    "Grad-CAM is an inspection aid only and does not prove clinical correctness."
)

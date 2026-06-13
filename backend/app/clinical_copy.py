from __future__ import annotations

CONFIDENCE_DISCLAIMER = (
    "This score is not calibrated and must not be interpreted as the clinical probability of pneumonia."
)

GRADCAM_NOTE = (
    "The heatmap highlights regions that influenced the model's prediction. "
    "It does not prove that pneumonia is present and should not be treated as a diagnostic explanation."
)

CLINICIAN_PNEUMONIA_TEXT = (
    "Possible pneumonia pattern detected. Please review the X-ray manually and check symptoms, "
    "vitals, and labs. Radiologist review is recommended."
)

CLINICIAN_NORMAL_TEXT = (
    "No strong pneumonia pattern detected by the AI. Please still review the image manually "
    "and consider the clinical context."
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

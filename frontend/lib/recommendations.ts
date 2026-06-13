import type { StoredAnalysis } from "@/lib/types";

export type RecommendationSection = {
  title: string;
  description: string;
  items: string[];
};

export type DoctorActionPlan = {
  triageLevel: string;
  triageTone: "amber" | "emerald" | "red";
  summary: string;
  sections: RecommendationSection[];
};

function formatProbability(probability: number) {
  return `${Math.round(probability * 100)}%`;
}

export function buildDoctorActionPlan(analysis: StoredAnalysis): DoctorActionPlan {
  const probability = formatProbability(analysis.probability);

  if (analysis.prediction === "PNEUMONIA") {
    const highConfidence = analysis.confidence === "high";

    return {
      triageLevel: highConfidence ? "Prioritized radiology review" : "Clinical correlation required",
      triageTone: highConfidence ? "red" : "amber",
      summary: `The MVP detected pneumonia features with ${probability} probability and ${analysis.confidence} confidence. Use this as decision support only and confirm against the full clinical picture.`,
      sections: [
        {
          title: "Immediate clinical checks",
          description: "Confirm whether the imaging finding matches the patient's acuity.",
          items: [
            "Review oxygen saturation, respiratory rate, temperature, heart rate, and blood pressure.",
            "Assess symptoms: cough, dyspnea, pleuritic chest pain, fever, sputum, and onset duration.",
            "Screen for red flags: hypoxia, sepsis signs, altered mental status, immunosuppression, or rapid deterioration."
          ]
        },
        {
          title: "Imaging and diagnostic next steps",
          description: "Validate the AI result with standard clinical interpretation.",
          items: [
            "Request or document radiologist review of the X-ray and compare with prior imaging when available.",
            "Correlate the Grad-CAM highlighted region with the visible opacity, consolidation, or infiltrate pattern.",
            "Consider CBC, CRP/procalcitonin, blood cultures, sputum culture, or viral testing based on local protocol and severity."
          ]
        },
        {
          title: "Treatment considerations",
          description: "Use local guidelines and patient-specific risk factors before therapy.",
          items: [
            "If pneumonia is clinically supported, consider empiric antibiotics according to local CAP/HAP guidance.",
            "Account for allergies, renal function, pregnancy status, aspiration risk, recent hospitalization, and resistance risk.",
            "Provide supportive care such as antipyretics, hydration, bronchodilator therapy, or oxygen when clinically indicated."
          ]
        },
        {
          title: "Disposition and follow-up",
          description: "Choose monitoring intensity based on stability and risk.",
          items: [
            "Use a validated severity score or institutional pathway to decide outpatient treatment vs. admission.",
            "Arrange reassessment if symptoms worsen or fail to improve within the expected treatment window.",
            "Document that the AI result is advisory and was interpreted alongside exam findings and clinician judgment."
          ]
        }
      ]
    };
  }

  return {
    triageLevel: analysis.confidence === "high" ? "Low AI suspicion" : "Indeterminate AI support",
    triageTone: analysis.confidence === "high" ? "emerald" : "amber",
    summary: `The MVP did not cross the pneumonia threshold (${probability} probability, ${analysis.confidence} confidence). Continue clinical assessment if symptoms or risk factors remain concerning.`,
    sections: [
      {
        title: "Clinical reassessment",
        description: "A normal AI result does not exclude disease in the right clinical context.",
        items: [
          "Recheck symptoms, vital signs, oxygen saturation, and risk factors such as age, immunosuppression, or chronic lung disease.",
          "If clinical suspicion remains high, seek radiologist review despite the AI result.",
          "Compare with prior imaging and verify image quality, projection, rotation, and exposure."
        ]
      },
      {
        title: "Alternative diagnoses",
        description: "Consider other causes for respiratory symptoms.",
        items: [
          "Evaluate for viral bronchitis, asthma/COPD exacerbation, pulmonary edema, pulmonary embolism, atelectasis, or non-thoracic causes.",
          "Use labs, ECG, viral testing, D-dimer/CT pathway, or other tests only when clinically indicated.",
          "Avoid anchoring on the AI output if the bedside assessment suggests a different diagnosis."
        ]
      },
      {
        title: "Follow-up and safety net",
        description: "Give clear escalation instructions when outpatient management is appropriate.",
        items: [
          "Advise urgent reassessment for worsening dyspnea, persistent fever, chest pain, confusion, cyanosis, or low oxygen saturation.",
          "Plan follow-up if symptoms persist, worsen, or if the patient is high risk.",
          "Document that the AI screen was negative/low probability and was not used as a standalone rule-out test."
        ]
      }
    ]
  };
}

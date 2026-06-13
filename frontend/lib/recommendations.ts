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
  imageSpecificFindings: string[];
  sections: RecommendationSection[];
};

function formatProbability(probability: number) {
  return `${Math.round(probability * 100)}%`;
}

function fallbackRegion(analysis: StoredAnalysis) {
  if (analysis.suspicious_region) {
    return analysis.suspicious_region;
  }

  const match = analysis.explanation.match(/(?:in|the)\s+(upper|lower)\s+(left|right)\s+lung/i);
  if (!match) {
    return "most influential heatmap region";
  }

  return `${match[1].toLowerCase()} ${match[2].toLowerCase()} lung`;
}

function regionLabel(region: string) {
  return region.replace("lung", "lung field");
}

function regionSide(region: string) {
  if (region.includes("right")) {
    return "right";
  }

  if (region.includes("left")) {
    return "left";
  }

  return "corresponding";
}

function regionZone(region: string) {
  if (region.includes("upper")) {
    return "upper-zone";
  }

  if (region.includes("lower")) {
    return "lower-zone";
  }

  return "region-specific";
}

function locationSpecificActions(region: string, prediction: StoredAnalysis["prediction"]) {
  const side = regionSide(region);
  const zone = regionZone(region);
  const label = regionLabel(region);

  if (prediction === "NORMAL") {
    return [
      `Re-check the ${label} because it was still the most influential area despite a below-threshold result.`,
      `If symptoms localize to the ${side} chest or auscultation is abnormal there, do not use this AI result as a rule-out.`,
      "If clinical suspicion remains high, request radiologist review or repeat imaging according to local protocol."
    ];
  }

  if (zone === "lower-zone") {
    return [
      `Inspect the ${label} for consolidation, air bronchograms, pleural effusion, or dependent/aspiration-pattern opacity.`,
      `Focus the bedside exam on the ${side} lower chest: crackles, reduced breath sounds, dullness to percussion, and oxygen requirement.`,
      "If aspiration risk is present, include swallowing status, vomiting, altered consciousness, or reflux history in the treatment decision."
    ];
  }

  if (zone === "upper-zone") {
    return [
      `Inspect the ${label} for focal infiltrate, cavitary change, apical scarring, or overlapping clavicle/scapula artifact.`,
      `Focus the bedside exam on the ${side} upper chest and compare the heatmap focus with visible upper-zone opacity.`,
      "If symptoms or epidemiology fit, consider atypical infection, tuberculosis pathway, or malignancy differential before narrowing treatment."
    ];
  }

  return [
    `Correlate the heatmap focus in the ${label} with the visible opacity on the original X-ray.`,
    "Compare with prior imaging if available to determine whether this is new, resolving, or chronic.",
    "Use radiologist review before finalizing treatment if the visual finding is subtle or discordant with symptoms."
  ];
}

function patternSpecificActions(pattern: StoredAnalysis["opacity_pattern"], region: string) {
  if (pattern === "focal") {
    return [
      `Because the opacity pattern is focal, ask radiology to specifically confirm whether the ${regionLabel(region)} represents true consolidation versus projection artifact.`,
      "If clinical findings match, manage as localized pneumonia per local CAP/HAP pathway and document the focal site."
    ];
  }

  if (pattern === "multifocal_or_diffuse") {
    return [
      "Because the signal is broader than a single focus, consider bilateral/multifocal pneumonia, edema, diffuse inflammatory disease, or technical exposure effects.",
      "Review oxygenation and work of breathing carefully; diffuse patterns can require closer monitoring even when one region is most highlighted."
    ];
  }

  if (pattern === "subtle") {
    return [
      "Because the AI signal is subtle, prioritize radiologist confirmation before anchoring on pneumonia.",
      "If symptoms are mild and vitals are stable, consider short-interval reassessment rather than treating from AI output alone."
    ];
  }

  return [
    "No focal pattern crossed the MVP threshold; use the highlighted region only as an area to double-check.",
    "If the image is low quality, rotated, or under/overexposed, consider repeat imaging before relying on the screen."
  ];
}

export function buildDoctorActionPlan(analysis: StoredAnalysis): DoctorActionPlan {
  const probability = formatProbability(analysis.model_score_pneumonia ?? analysis.probability);
  const region = fallbackRegion(analysis);
  const pattern = analysis.opacity_pattern ?? (analysis.prediction === "PNEUMONIA" ? "subtle" : "low_suspicion");
  const imageSpecificFindings = analysis.key_findings?.length
    ? analysis.key_findings
    : [
        `AI pneumonia score is ${probability} with ${analysis.confidence} confidence.`,
        `Most influential area: ${region}.`,
        analysis.explanation
      ];
  const locationActions = locationSpecificActions(region, analysis.prediction);
  const patternActions = patternSpecificActions(pattern, region);

  if (analysis.prediction === "PNEUMONIA") {
    const highConfidence = analysis.confidence === "high";

    return {
      triageLevel: highConfidence ? "Prioritized radiology review" : "Clinical correlation required",
      triageTone: highConfidence ? "red" : "amber",
      summary: `This X-ray is flagged for pneumonia with ${probability} pneumonia score and ${analysis.confidence} confidence. The most influential area is the ${regionLabel(region)}.`,
      imageSpecificFindings,
      sections: [
        {
          title: `Check the highlighted ${regionLabel(region)}`,
          description: "Start with the exact area that drove the AI output instead of reviewing the case generically.",
          items: locationActions
        },
        {
          title: "Pattern-specific interpretation",
          description: "Use the detected opacity pattern to decide how urgently the image needs confirmation.",
          items: patternActions
        },
        {
          title: "Targeted bedside correlation",
          description: `Confirm whether findings in the ${regionSide(region)} chest match the image signal.`,
          items: [
            `Document whether auscultation findings localize to the ${regionSide(region)} side or are diffuse.`,
            `If the heatmap focus and symptoms both point to the ${regionLabel(region)}, escalate radiology review priority.`,
            "Check oxygen saturation, respiratory rate, temperature, heart rate, and blood pressure before disposition decisions."
          ]
        },
        {
          title: "Diagnostics to consider for this case",
          description: "Choose tests based on the image-specific risk signal and clinical severity.",
          items: [
            highConfidence
              ? `Request prioritized radiologist confirmation of suspected pneumonia in the ${regionLabel(region)}.`
              : `Request radiologist confirmation if the ${regionLabel(region)} finding is not obvious on visual review.`,
            "Compare with prior X-rays to determine whether the opacity is new, chronic, resolving, or positional.",
            "Consider CBC, CRP/procalcitonin, cultures, or viral testing only if they will change treatment or isolation decisions."
          ]
        },
        {
          title: "Treatment and disposition decision",
          description: "Tie treatment to concordance between AI, radiology, vitals, and symptoms.",
          items: [
            highConfidence
              ? "If symptoms and vitals support infection, start empiric therapy per local pneumonia guideline after accounting for allergies, renal function, and resistance risk."
              : "If clinical findings are weak or discordant, avoid treatment based on AI alone; confirm with radiology or repeat imaging as appropriate.",
            "Use a validated severity score or institutional pathway to decide outpatient treatment, observation, or admission.",
            `Document the AI-indicated region (${regionLabel(region)}), probability (${probability}), confidence (${analysis.confidence}), and clinician interpretation.`
          ]
        }
      ]
    };
  }

  return {
    triageLevel: analysis.confidence === "high" ? "Low AI suspicion" : "Indeterminate AI support",
    triageTone: analysis.confidence === "high" ? "emerald" : "amber",
    summary: `This X-ray stayed below the 20% pneumonia threshold (${probability} pneumonia score, ${analysis.confidence} confidence). The area to double-check is the ${regionLabel(region)}, because it was still the most influential heatmap region.`,
    imageSpecificFindings,
    sections: [
      {
        title: `Double-check the ${regionLabel(region)}`,
        description: "Even a below-threshold case has one area that influenced the AI most.",
        items: locationActions
      },
      {
        title: "Why this is not a full rule-out",
        description: "The recommendation changes depending on the confidence of the negative screen.",
        items: [
          analysis.confidence === "high"
            ? "The AI signal is comfortably below threshold, so routine clinical correlation is reasonable if vitals and symptoms are reassuring."
            : "The AI signal is near threshold, so treat the result as indeterminate if symptoms, fever, hypoxia, or exam findings are concerning.",
          `If there are focal findings on the ${regionSide(region)} side, ask radiology to review the ${regionLabel(region)} despite the negative prediction.`,
          "Verify image quality, rotation, exposure, and whether portable/AP technique could hide early infiltrate."
        ]
      },
      {
        title: "Alternative explanation for symptoms",
        description: "Use the negative AI result to broaden the differential instead of stopping the workup.",
        items: [
          "Consider viral bronchitis, asthma/COPD exacerbation, pulmonary edema, pulmonary embolism, atelectasis, or non-thoracic causes if symptoms persist.",
          "Use ECG, viral testing, D-dimer/CT pathway, labs, or repeat imaging only when the bedside assessment supports them.",
          `If the ${regionLabel(region)} has chronic changes on prior imaging, document that context with the AI result.`
        ]
      },
      {
        title: "Patient-specific safety net",
        description: "Base follow-up intensity on symptoms and the near-threshold risk level.",
        items: [
          analysis.confidence === "low"
            ? "Because confidence is low, arrange closer reassessment or radiology review if clinical suspicion is more than minimal."
            : "If outpatient management is chosen, give return precautions for worsening dyspnea, persistent fever, chest pain, confusion, cyanosis, or low oxygen saturation.",
          "Plan follow-up if symptoms persist, worsen, or the patient is high risk.",
          `Document that pneumonia probability was ${probability}, with the ${regionLabel(region)} reviewed as the most influential region.`
        ]
      }
    ]
  };
}

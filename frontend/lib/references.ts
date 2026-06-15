export type ReferenceCategory = "dataset" | "model" | "explainability" | "guideline" | "review";

export type ScientificReference = {
  id: string;
  category: ReferenceCategory;
  authors: string;
  year: number;
  title: string;
  journal: string;
  impactNote: string;
  doi?: string;
  url: string;
  relevance: string;
};

export const referenceCategoryLabels: Record<ReferenceCategory, string> = {
  dataset: "Dataset & benchmark",
  model: "Deep learning model",
  explainability: "Explainability (XAI)",
  guideline: "Clinical guideline",
  review: "Review & methods"
};

export const scientificReferences: ScientificReference[] = [
  {
    id: "kermany-2018",
    category: "dataset",
    authors: "Kermany DS, Goldbaum M, Cai W, et al.",
    year: 2018,
    title: "Identifying Medical Diagnoses and Treatable Diseases by Image-Based Deep Learning",
    journal: "Cell",
    impactNote: "High-impact clinical AI validation (IF ~64)",
    doi: "10.1016/j.cell.2018.02.010",
    url: "https://doi.org/10.1016/j.cell.2018.02.010",
    relevance:
      "Landmark pediatric chest X-ray pneumonia dataset and transfer-learning workflow widely used for binary pneumonia screening benchmarks."
  },
  {
    id: "irvin-2019",
    category: "dataset",
    authors: "Irvin J, Rajpurkar P, Ko M, et al.",
    year: 2019,
    title: "CheXpert: A Large Chest Radiograph Dataset with Uncertainty Labels and Expert Comparison",
    journal: "Proceedings of the National Academy of Sciences",
    impactNote: "Large-scale CXR benchmark (PNAS, IF ~11)",
    doi: "10.1073/pnas.1909055116",
    url: "https://doi.org/10.1073/pnas.1909055116",
    relevance:
      "Defines uncertainty-aware labeling for chest radiographs and supports robust evaluation of pneumonia-related findings."
  },
  {
    id: "wang-2017",
    category: "dataset",
    authors: "Wang X, Peng Y, Lu L, et al.",
    year: 2017,
    title: "ChestX-ray8: Hospital-Scale Chest X-ray Database and Benchmarks on Weakly-Supervised Classification",
    journal: "CVPR",
    impactNote: "Foundational multi-label CXR dataset (>100k images)",
    url: "https://openaccess.thecvf.com/content_cvpr_2017/html/Wang_ChestX-ray8_Hospital-Scale_Chest_CVPR_2017_paper.html",
    relevance:
      "Established large-scale chest radiograph classification benchmarks including pneumonia as a target label."
  },
  {
    id: "rajpurkar-2017",
    category: "model",
    authors: "Rajpurkar P, Irvin J, Zhu K, et al.",
    year: 2017,
    title: "CheXNet: Radiologist-Level Pneumonia Detection on Chest Radiographs with Deep Learning",
    journal: "arXiv (Stanford ML Group)",
    impactNote: "Highly cited pneumonia detection architecture (DenseNet-121)",
    url: "https://arxiv.org/abs/1711.05225",
    relevance:
      "Demonstrated radiologist-level pneumonia detection on chest X-rays and motivated ResNet/DenseNet screening pipelines."
  },
  {
    id: "he-2016",
    category: "model",
    authors: "He K, Zhang X, Ren S, Sun J",
    year: 2016,
    title: "Deep Residual Learning for Image Recognition",
    journal: "CVPR",
    impactNote: "ResNet backbone used in this demo (ResNet18)",
    doi: "10.1109/CVPR.2016.90",
    url: "https://doi.org/10.1109/CVPR.2016.90",
    relevance:
      "ResNet architectures, including ResNet18 used here, are standard backbones for chest X-ray classification."
  },
  {
    id: "selvaraju-2017",
    category: "explainability",
    authors: "Selvaraju RR, Cogswell M, Das A, et al.",
    year: 2017,
    title: "Grad-CAM: Visual Explanations from Deep Networks via Gradient-Based Localization",
    journal: "ICCV",
    impactNote: "Core Grad-CAM method for model interpretability",
    doi: "10.1109/ICCV.2017.74",
    url: "https://doi.org/10.1109/ICCV.2017.74",
    relevance:
      "Grad-CAM heatmaps in this app localize convolutional activations that most influenced the pneumonia class score."
  },
  {
    id: "litjens-2017",
    category: "review",
    authors: "Litjens G, Kooi T, Bejnordi BE, et al.",
    year: 2017,
    title: "A Survey on Deep Learning in Medical Image Analysis",
    journal: "Medical Image Analysis",
    impactNote: "Authoritative medical imaging AI review (IF ~10)",
    doi: "10.1016/j.media.2017.07.005",
    url: "https://doi.org/10.1016/j.media.2017.07.005",
    relevance:
      "Summarizes validation requirements, dataset bias, and clinical deployment risks for chest imaging AI systems."
  },
  {
    id: "metlay-2019",
    category: "guideline",
    authors: "Metlay JP, Waterer GW, Long AC, et al.",
    year: 2019,
    title: "Diagnosis and Treatment of Adults with Community-acquired Pneumonia: An Official Clinical Practice Guideline of the ATS/IDSA",
    journal: "American Journal of Respiratory and Critical Care Medicine",
    impactNote: "ATS/IDSA CAP guideline (IF ~19)",
    doi: "10.1164/rccm.201908-1581ST",
    url: "https://doi.org/10.1164/rccm.201908-1581ST",
    relevance:
      "Supports radiology confirmation, severity assessment, and treatment pathways referenced in physician recommendations."
  },
  {
    id: "who-2014",
    category: "guideline",
    authors: "World Health Organization",
    year: 2014,
    title: "Pocket Book of Hospital Care for Children: Guidelines for the Management of Common Childhood Illnesses",
    journal: "WHO",
    impactNote: "Global pneumonia management standard",
    url: "https://www.who.int/publications/i/item/9789241548373",
    relevance:
      "WHO pneumonia definitions and severity criteria inform triage language for pediatric and global health contexts."
  },
  {
    id: "nice-2019",
    category: "guideline",
    authors: "National Institute for Health and Care Excellence (NICE)",
    year: 2019,
    title: "Pneumonia in Adults: Diagnosis and Management (NG138)",
    journal: "NICE Guideline",
    impactNote: "Evidence-based CAP pathway (UK/European practice)",
    url: "https://www.nice.org.uk/guidance/ng138",
    relevance:
      "Recommends chest imaging interpretation within structured CAP assessment and documents when repeat imaging is needed."
  }
];

export function referencesByCategory(category: ReferenceCategory) {
  return scientificReferences.filter((reference) => reference.category === category);
}

export const methodSummary =
  "This demo applies a binary ResNet18 classifier with Grad-CAM explainability. Predictions and heatmaps are decision-support outputs and must be interpreted alongside ATS/IDSA CAP guidance, radiologist review, and bedside assessment.";

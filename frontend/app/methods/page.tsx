import Link from "next/link";

export default function MethodsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Methods</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-950">Methodology & limitations</h1>
        <p className="mt-3 text-lg text-slate-600">
          Educational research demo for explainable pneumonia screening. Not a medical device.
        </p>
      </div>

      <section className="space-y-6">
        <article className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Model</h2>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
            <li>Binary ResNet18 classifier with a custom fully connected head.</li>
            <li>Classes: 0 = NORMAL, 1 = PNEUMONIA.</li>
            <li>Checkpoint: trained model1 ResNet18 pneumonia weights.</li>
          </ul>
        </article>

        <article className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Preprocessing</h2>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
            <li>Resize to 224×224 pixels.</li>
            <li>Convert to grayscale with 3 output channels.</li>
            <li>Normalize with ImageNet mean [0.485, 0.456, 0.406] and std [0.229, 0.224, 0.225].</li>
          </ul>
        </article>

        <article className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Screening rule</h2>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            The app does <strong>not</strong> use argmax for the final screening label. Instead:
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
            <li>If model score (PNEUMONIA) ≥ 0.20 → PNEUMONIA-like pattern flagged</li>
            <li>Otherwise → NORMAL-like pattern</li>
          </ul>
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Model scores are not calibrated clinical probabilities.
          </p>
        </article>

        <article className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Grad-CAM explainability</h2>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
            <li>Target layer: final ResNet18 convolutional block (`layer4[-1]`).</li>
            <li>PNEUMONIA-like results explain class 1; NORMAL-like results explain class 0.</li>
            <li>Overlay view blends influence onto the X-ray; raw view shows the influence map only.</li>
          </ul>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            The heatmap highlights regions that influenced the model&apos;s prediction. It does not prove that
            pneumonia is present and should not be treated as a diagnostic explanation.
          </p>
        </article>

        <article className="rounded-3xl border border-red-100 bg-red-50 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-red-900">Limitations</h2>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-red-900">
            <li>Educational research demo only. Not validated for clinical use.</li>
            <li>Results may be wrong and must not replace professional medical judgement.</li>
            <li>Grad-CAM is an inspection aid only and does not prove disease location.</li>
            <li>A normal-like AI output does not rule out pneumonia.</li>
            <li>Radiologist review and clinical correlation remain mandatory.</li>
          </ul>
        </article>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="rounded-2xl bg-sky-600 px-5 py-3 font-semibold text-white hover:bg-sky-700">
          Back to upload
        </Link>
        <Link
          href="/results"
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
        >
          View latest results
        </Link>
      </div>
    </main>
  );
}

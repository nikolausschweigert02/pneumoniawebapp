"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { DemoFlow } from "@/components/DemoFlow";
import type { PredictionResponse, StoredAnalysis } from "@/lib/types";

const PREDICT_ENDPOINT = process.env.NEXT_PUBLIC_API_BASE_URL
  ? `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "")}/predict`
  : "/api/predict";

const DEMO_STEPS = [
  "Upload a chest X-ray image",
  "Click Analyze X-ray",
  "Review the AI result and doctor recommendations"
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>("");

  const canAnalyze = selectedFile !== null && !isAnalyzing;

  async function selectFile(file: File | null) {
    setError("");
    setSelectedFile(file);

    if (!file) {
      setPreviewUrl("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSelectedFile(null);
      setPreviewUrl("");
      setError("Please upload a chest X-ray image file.");
      return;
    }

    setPreviewUrl(await fileToDataUrl(file));
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    await selectFile(event.target.files?.[0] ?? null);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    await selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Select an X-ray image before analyzing.");
      return;
    }

    setIsAnalyzing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(PREDICT_ENDPOINT, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || "Prediction request failed.");
      }

      const prediction = (await response.json()) as PredictionResponse;
      const originalImage = previewUrl || (await fileToDataUrl(selectedFile));
      const storedAnalysis: StoredAnalysis = {
        ...prediction,
        originalImage,
        fileName: selectedFile.name
      };

      sessionStorage.setItem("pneumonia-analysis", JSON.stringify(storedAnalysis));
      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze the image.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8">
      <DemoFlow current="upload" />

      <section className="grid gap-8 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="inline-flex rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800">
            Explainable Pneumonia AI
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Chest X-ray pneumonia screening demo
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
            A simple 3-step demo: upload an X-ray, run the trained AI model, and review the
            explainable result.
          </p>

          <ol className="mt-8 space-y-3">
            {DEMO_STEPS.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm font-medium text-slate-800">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/80 bg-white/95 p-6 shadow-xl"
        >
          <h2 className="text-lg font-semibold text-slate-900">Upload chest X-ray</h2>
          <p className="mt-1 text-sm text-slate-500">PNG, JPG, JPEG, or WEBP</p>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-4 rounded-2xl border-2 border-dashed p-4 transition ${
              isDragging ? "border-sky-500 bg-sky-50" : "border-sky-200 bg-sky-50/50"
            }`}
          >
            <input
              id="xray-upload"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="cursor-pointer rounded-2xl bg-white px-4 py-8 text-center"
            >
              {previewUrl ? (
                <div>
                  <Image
                    src={previewUrl}
                    alt="Selected chest X-ray preview"
                    width={520}
                    height={420}
                    unoptimized
                    className="mx-auto max-h-[360px] rounded-xl object-contain"
                  />
                  <p className="mt-4 text-sm font-medium text-sky-700">Tap to choose a different image</p>
                </div>
              ) : (
                <div className="mx-auto max-w-sm">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-2xl text-sky-700">
                    +
                  </div>
                  <p className="text-lg font-semibold text-slate-900">Choose or drop an X-ray</p>
                  <p className="mt-2 text-sm text-slate-500">Click here or drag an image into this box.</p>
                </div>
              )}
            </div>
          </div>

          {selectedFile ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Selected file: <span className="font-semibold text-slate-900">{selectedFile.name}</span>
            </p>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canAnalyze}
            className="mt-5 w-full rounded-2xl bg-sky-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {isAnalyzing ? "Analyzing X-ray..." : "Analyze X-ray"}
          </button>
        </form>
      </section>
    </main>
  );
}

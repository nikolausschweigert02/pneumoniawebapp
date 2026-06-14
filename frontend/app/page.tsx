"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import type { PredictionResponse, StoredAnalysis } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const PREDICT_ENDPOINT = process.env.NEXT_PUBLIC_API_BASE_URL
  ? `${API_BASE_URL.replace(/\/$/, "")}/predict`
  : "/api/predict";

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
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
      <section className="grid flex-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800">
            Explainable Pneumonia AI
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            Upload a chest X-ray and get an explainable pneumonia assessment.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Upload a chest X-ray to get an AI-assisted pneumonia screening result, model scores,
            a Grad-CAM explanation, and a clinical recommendation for physician review.
          </p>
          <div className="mt-8 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
            {["ResNet18 screening", "Grad-CAM explanation", "Clinical summary"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                <span className="font-semibold text-slate-900">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-2xl shadow-sky-900/10 backdrop-blur"
        >
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
              isDragging ? "border-sky-500 bg-sky-100" : "border-sky-200 bg-sky-50/60"
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
            className="block cursor-pointer rounded-2xl bg-white px-6 py-10 transition"
          >
              {previewUrl ? (
                <div>
                  <Image
                    src={previewUrl}
                    alt="Selected chest X-ray preview"
                    width={520}
                    height={420}
                    unoptimized
                    className="mx-auto max-h-[420px] rounded-xl object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-5 rounded-xl border border-sky-200 px-5 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
                  >
                    Choose a different image
                  </button>
                </div>
              ) : (
                <div className="mx-auto max-w-sm">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl">
                    +
                  </div>
                  <p className="text-lg font-semibold text-slate-900">Choose chest X-ray image</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Drag and drop an image here, or use the upload button below.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-5 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                  >
                    Upload image
                  </button>
                  <p className="mt-3 text-xs text-slate-400">PNG, JPG, JPEG, or WEBP files are supported.</p>
                </div>
              )}
            </div>
          </div>

          {selectedFile ? (
            <p className="mt-4 text-sm text-slate-600">
              Selected: <span className="font-medium text-slate-900">{selectedFile.name}</span>
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
            className="mt-6 w-full rounded-2xl bg-sky-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-sky-600/25 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze X-ray"}
          </button>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Predictions must be reviewed by qualified clinicians and are not a standalone diagnosis.
          </p>
        </form>
      </section>
    </main>
  );
}

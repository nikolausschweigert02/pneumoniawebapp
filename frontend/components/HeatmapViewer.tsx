"use client";

import { useEffect, useRef, useState } from "react";

type HeatmapViewerProps = {
  originalImage: string;
  camUrl: string;
  fallbackUrl?: string;
  alt?: string;
};

function resolveUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return url.startsWith("/") ? url : `/${url}`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
    image.src = src;
  });
}

export default function HeatmapViewer({
  originalImage,
  camUrl,
  fallbackUrl,
  alt = "Grad-CAM heatmap visualization"
}: HeatmapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opacity, setOpacity] = useState(62);
  const [threshold, setThreshold] = useState(10);
  const [isReady, setIsReady] = useState(false);
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderHeatmap() {
      setRenderError("");
      setIsReady(false);

      try {
        const [baseImage, camImage] = await Promise.all([
          loadImage(originalImage),
          loadImage(resolveUrl(camUrl))
        ]);

        if (cancelled || !canvasRef.current) {
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas rendering is unavailable in this browser.");
        }

        canvas.width = baseImage.naturalWidth;
        canvas.height = baseImage.naturalHeight;

        const camCanvas = document.createElement("canvas");
        camCanvas.width = canvas.width;
        camCanvas.height = canvas.height;
        const camContext = camCanvas.getContext("2d");
        if (!camContext) {
          throw new Error("Unable to read the heatmap layer.");
        }

        camContext.drawImage(camImage, 0, 0, canvas.width, canvas.height);
        const camPixels = camContext.getImageData(0, 0, canvas.width, canvas.height);

        const baseCanvas = document.createElement("canvas");
        baseCanvas.width = canvas.width;
        baseCanvas.height = canvas.height;
        const baseContext = baseCanvas.getContext("2d");
        if (!baseContext) {
          throw new Error("Unable to read the original image.");
        }

        baseContext.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
        const originalPixels = baseContext.getImageData(0, 0, canvas.width, canvas.height);
        const outputPixels = context.createImageData(canvas.width, canvas.height);
        const thresholdValue = threshold / 100;
        const overlayAlpha = opacity / 100;

        for (let index = 0; index < outputPixels.data.length; index += 4) {
          outputPixels.data[index] = originalPixels.data[index];
          outputPixels.data[index + 1] = originalPixels.data[index + 1];
          outputPixels.data[index + 2] = originalPixels.data[index + 2];
          outputPixels.data[index + 3] = 255;

          const camAlpha = camPixels.data[index + 3] / 255;
          if (camAlpha < thresholdValue) {
            continue;
          }

          const blend = camAlpha * overlayAlpha;
          outputPixels.data[index] = Math.round(
            originalPixels.data[index] * (1 - blend) + camPixels.data[index] * blend
          );
          outputPixels.data[index + 1] = Math.round(
            originalPixels.data[index + 1] * (1 - blend) + camPixels.data[index + 1] * blend
          );
          outputPixels.data[index + 2] = Math.round(
            originalPixels.data[index + 2] * (1 - blend) + camPixels.data[index + 2] * blend
          );
        }

        context.putImageData(outputPixels, 0, 0);
        setIsReady(true);
      } catch (error) {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : "Heatmap rendering failed.");
        }
      }
    }

    void renderHeatmap();

    return () => {
      cancelled = true;
    };
  }, [originalImage, camUrl, opacity, threshold]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-slate-950">
        {renderError && fallbackUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveUrl(fallbackUrl)} alt={alt} className="h-auto w-full object-contain" />
        ) : (
          <canvas ref={canvasRef} aria-label={alt} className="h-auto w-full object-contain" />
        )}
      </div>

      <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">Overlay opacity</span>
            <span>{opacity}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
            className="w-full accent-sky-600"
          />
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">Activation threshold</span>
            <span>{threshold}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            className="w-full accent-sky-600"
          />
        </label>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Adjust overlay opacity and activation threshold to inspect Grad-CAM saliency. Higher thresholds
        suppress low-confidence activations per Selvaraju et al. (2017).
        {!isReady && !renderError ? " Rendering heatmap..." : null}
      </p>
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8000";

function proxiedHeatmapUrl(heatmapUrl: string) {
  try {
    const pathname = heatmapUrl.startsWith("http")
      ? new URL(heatmapUrl).pathname
      : heatmapUrl;
    const filename = pathname.split("/").pop();

    if (pathname.startsWith("/static/heatmaps/") && filename) {
      return `/api/heatmaps/${encodeURIComponent(filename)}`;
    }
  } catch {
    return heatmapUrl;
  }

  return heatmapUrl;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const response = await fetch(`${BACKEND_URL}/predict`, {
    method: "POST",
    body: formData
  });

  const responseText = await response.text();
  if (!response.ok) {
    return new NextResponse(responseText || "Prediction request failed.", {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "text/plain"
      }
    });
  }

  const payload = JSON.parse(responseText);
  return NextResponse.json({
    ...payload,
    heatmap_url: proxiedHeatmapUrl(payload.heatmap_url),
    heatmap_raw_url: proxiedHeatmapUrl(payload.heatmap_raw_url)
  });
}

import { NextRequest } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8000";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const response = await fetch(`${BACKEND_URL}/static/heatmaps/${encodeURIComponent(filename)}`);

  if (!response.ok) {
    return new Response("Heatmap not found.", { status: response.status });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "image/png",
      "cache-control": "no-store"
    }
  });
}

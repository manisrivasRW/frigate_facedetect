import { NextResponse } from "next/server";

// Backend base URL (FastAPI). Configure via env: BACKEND_BASE_URL
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:8000";

// GET /api/logs?threshold=0.6
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const thresholdStr = searchParams.get("threshold") ?? "0.6";
    const threshold = Math.min(1, Math.max(0.2, parseFloat(thresholdStr)) || 0.6);
    const thresholdPercent = Math.min(100, Math.max(20, Math.round(threshold * 100)));

    // 1) Fetch suspects map: { [suspectId]: [faceIds] }
    const resCriminals = await fetch(`${BACKEND_BASE_URL}/get-criminals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ threshold: thresholdPercent }),
    });
    if (!resCriminals.ok) {
      return NextResponse.json(
        { error: "/get-criminals failed", status: resCriminals.status },
        { status: 500 }
      );
    }
    const suspects = (await resCriminals.json()) as Record<string, (string | number)[]>;

    // 2) For each suspect, fetch faces to get image URLs
    const logs = await Promise.all(
      Object.entries(suspects).map(async ([suspectId, faceIds]) => {
        if (!Array.isArray(faceIds) || faceIds.length === 0) {
          return {
            id: suspectId,
            name: "Unknown",
            policeStation: "PS-?",
            matches: 0,
            confidence: threshold,
            images: [],
          };
        }

        const resFaces = await fetch(`${BACKEND_BASE_URL}/get-suspects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ suspect_ids: faceIds }),
        });
        if (!resFaces.ok) {
          return {
            id: suspectId,
            name: "Unknown",
            policeStation: "PS-?",
            matches: 0,
            confidence: threshold,
            images: [],
          };
        }
        const faces = (await resFaces.json()) as Array<{ img_url?: string }>;
        const images = (faces || []).map((f) => f.img_url).filter(Boolean) as string[];
        return {
          id: suspectId,
          name: "Unknown",
          policeStation: "PS-?",
          matches: images.length,
          confidence: threshold,
          images,
        };
      })
    );

    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unknown error" }, { status: 500 });
  }
}



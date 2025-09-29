import { NextResponse } from "next/server";

// Backend base URL (FastAPI). Configure via env: BACKEND_BASE_URL
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:8000";

type BackendFaceRef = string | { f_id?: string; score?: number } | Record<string, any>;
type BackendFacesResponse = Array<{ img_url?: string }>;

// GET /api/logs?threshold=0.6
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const thresholdStr = searchParams.get("threshold") ?? "0.6";
    const threshold = Math.min(1, Math.max(0.2, parseFloat(thresholdStr) || 0.6));
    const thresholdPercent = Math.min(100, Math.max(20, Math.round(threshold * 100)));

    // Call backend. It may return one of two shapes based on current server logic:
    //  A) Array<{ criminal_data: {...}, suspect_list: Record<string, BackendFaceRef[]> }>
    //  B) Record<criminalId, BackendFaceRef[]> // suspect_list mapping only
    const res = await fetch(`${BACKEND_BASE_URL}/get-criminals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ threshold: thresholdPercent }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "/get-criminals failed", status: res.status },
        { status: 500 }
      );
    }
    const raw = await res.json();

    // Normalize to entries of [criminalId, faceRefs[]] plus optional metadata
type Normalized = { id: string; faceRefs: BackendFaceRef[]; name?: string; policeStation?: string; avatarUrl?: string; age?: number };
    const normalized: Normalized[] = [];

    if (Array.isArray(raw)) {
      for (const item of raw) {
        const cData = item?.criminal_data;
        const sList = item?.suspect_list;
        const id = cData?.criminal_id || String(cData?.id || "");
        const refs = Array.isArray(sList) ? (sList as BackendFaceRef[]) : [];
        if (id) {
          normalized.push({
            id,
            faceRefs: refs,
            name: cData?.criminal_name,
            policeStation: cData?.criminal_ps,
            avatarUrl: cData?.criminal_img,
            age: typeof cData?.criminal_age === "number" ? cData?.criminal_age : undefined,
          });
        }
      }
    } else if (raw && typeof raw === "object") {
      for (const [cid, refs] of Object.entries(raw as Record<string, BackendFaceRef[]>)) {
        normalized.push({ id: cid, faceRefs: refs || [] });
      }
    }

    // For each criminal, parse faceRefs which might be strings containing JSON like '{"f_id": "a", "score": 0.3}'
    const logs = await Promise.all(
      normalized.map(async ({ id, faceRefs, name, policeStation, avatarUrl, age }) => {
        try {
          const parsed = faceRefs
            .map((ref) => {
              if (typeof ref === "string") {
                try {
                  const obj = JSON.parse(ref);
                  return { f_id: obj?.f_id as string | undefined, score: Number(obj?.score) };
                } catch {
                  return { f_id: ref as string, score: undefined };
                }
              }
              if (ref && typeof ref === "object") {
                return { f_id: (ref as any).f_id as string | undefined, score: Number((ref as any).score) };
              }
              return { f_id: undefined, score: undefined };
            })
            .filter((x) => Boolean(x.f_id)) as Array<{ f_id: string; score?: number }>;

          const faceIds = parsed.map((p) => p.f_id);
          const maxScore = parsed.reduce((m, p) => (typeof p.score === "number" && p.score > m ? p.score : m), 0);

          // Fetch images for the face IDs
          let images: string[] = [];
          if (faceIds.length) {
            const resFaces = await fetch(`${BACKEND_BASE_URL}/get-suspects`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
              body: JSON.stringify({ suspect_ids: faceIds }),
            });
            if (resFaces.ok) {
              const faces = (await resFaces.json()) as BackendFacesResponse;
              images = (faces || []).map((f) => f.img_url).filter(Boolean) as string[];
            }
          }

          return {
            id,
            name: name || id,
            policeStation: policeStation || "",
            matches: images.length,
            confidence: maxScore || threshold, // fallback to slider threshold if no score
            images,
            avatarUrl: avatarUrl || images[0] || undefined,
            age,
          };
        } catch {
          return {
            id,
            name: name || id,
            policeStation: policeStation || "",
            matches: 0,
            confidence: threshold,
            images: [],
            avatarUrl,
            age,
          };
        }
      })
    );

    // Filter by threshold and sort by highest score then matches
    const filtered = logs
      .filter((l) => (typeof l.confidence === "number" ? l.confidence : 0) >= threshold)
      .sort((a, b) => {
        const conf = (b.confidence || 0) - (a.confidence || 0);
        if (Math.abs(conf) > 1e-9) return conf;
        return (b.matches || 0) - (a.matches || 0);
      });

    return NextResponse.json(filtered);
  } catch (error: any) {
    // Never leak framework/parse errors to the UI; return empty list on 0.2 edge-cases
    return NextResponse.json([], { status: 200 });
  }
}



export type LogItem = {
  id: string;
  name: string;
  policeStation: string;
  matches: number;
  confidence: number; // 0..1
  images: string[];
};

const MOCK_LOGS: LogItem[] = [
  {
    id: "1",
    name: "John Carter",
    policeStation: "PS-12 Alpha",
    matches: 3,
    confidence: 0.92,
    images: ["/next.svg", "/vercel.svg", "/globe.svg"],
  },
  {
    id: "2",
    name: "Sarah Connor",
    policeStation: "PS-7 Beta",
    matches: 1,
    confidence: 0.45,
    images: ["/window.svg", "/file.svg"],
  },
  {
    id: "3",
    name: "Neo Anderson",
    policeStation: "PS-3 Zion",
    matches: 2,
    confidence: 0.78,
    images: ["/vercel.svg", "/next.svg"],
  },
];

/**
 * Calls FastAPI backend to get suspects above the threshold and their face images.
 * Backend contract (server.py):
 * - POST /get-criminals { threshold: int } -> { [suspectId: string]: string[] /* face ids */ }
 * - POST /get-suspects { suspect_ids: string[] /* face ids */ } -> Array<{ img_url: string, ... }>
 * Note: Slider uses 0.2..1.0; backend appears to store integer thresholds (e.g., 20..100).
 * We scale by thresholdPercent = Math.round(threshold * 100).
 */
export async function fetchLogs(threshold: number): Promise<LogItem[]> {
  const backendBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  try {
    const thresholdPercent = Math.round(threshold * 100);

    // Get suspects meeting the minimum threshold; returns mapping of suspectId -> [faceIds]
    const resCriminals = await fetch(`${backendBase}/get-criminals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold: thresholdPercent }),
      // next: { revalidate: 0 }, // Uncomment to disable caching
    });

    if (!resCriminals.ok) {
      throw new Error(`Failed /get-criminals: ${resCriminals.status}`);
    }

    const suspects: Record<string, string[]> = await resCriminals.json();

    // For each suspect, fetch image URLs for their face ids
    const entries = await Promise.all(
      Object.entries(suspects).map(async ([suspectId, faceIds]) => {
        if (!Array.isArray(faceIds) || faceIds.length === 0) {
          return {
            id: suspectId,
            name: "Unknown", // TODO: map real name when backend provides it
            policeStation: "PS-?", // TODO: map real station when available
            matches: 0,
            confidence: threshold, // TODO: use real confidence if provided per suspect
            images: [],
          } as LogItem;
        }

        // Fetch faces for these IDs
        const resFaces = await fetch(`${backendBase}/get-suspects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suspect_ids: faceIds }),
        });

        if (!resFaces.ok) {
          throw new Error(`Failed /get-suspects: ${resFaces.status}`);
        }

        type FaceRecord = {
          img_url?: string;
          // f_id?: string; event_id?: string; camera?: string; start_time?: string; end_time?: string;
        };
        const faces: FaceRecord[] = await resFaces.json();
        const images = (faces || []).map((f) => f.img_url).filter(Boolean) as string[];

        const logItem: LogItem = {
          id: suspectId,
          name: "Unknown", // TODO: replace with backend-provided name
          policeStation: "PS-?", // TODO: replace with backend-provided station
          matches: images.length,
          confidence: threshold, // TODO: replace if backend returns confidence per suspect
          images,
        };
        return logItem;
      })
    );

    // Sort by matches desc for a nicer default ordering
    return entries
      .filter(Boolean) as LogItem[];
  } catch (err) {
    // Mock fallback until backend is fully connected
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_LOGS.filter((l) => l.confidence >= threshold);
  }
}



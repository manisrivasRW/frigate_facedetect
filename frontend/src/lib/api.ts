export type LogItem = {
  id: string;
  name: string;
  policeStation: string;
  matches: number;
  confidence: number; // 0..1
  images: string[];
  avatarUrl?: string;
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

// Calls FastAPI backend to get suspects above the threshold and their face images.
// Backend contract (server.py):
// - POST /get-criminals { threshold: int } -> { [suspectId: string]: string[] } (face ids)
// - POST /get-suspects { suspect_ids: string[] } -> Array<{ img_url: string, ... }>
// Note: Slider uses 0.2..1.0; backend appears to store integer thresholds (e.g., 20..100).
// We scale by thresholdPercent = Math.round(threshold * 100).
export async function fetchLogs(threshold: number): Promise<LogItem[]> {
  try {
    // Call internal Next.js API route which proxies backend
    const res = await fetch(`/api/logs?threshold=${encodeURIComponent(threshold)}`, {
      method: "GET",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`GET /api/logs failed: ${res.status}`);
    const data = (await res.json()) as LogItem[];
    return data;
  } catch (err) {
    // Mock fallback until backend is fully connected
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_LOGS.filter((l) => l.confidence >= threshold);
  }
}



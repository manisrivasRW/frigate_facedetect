export type LogItem = {
  id: string;
  name: string;
  policeStation: string;
  age?: number;
  matches: number;
  confidence: number; // 0..1
  images: Array<{ url: string; score: number; start_time?: number }>;
  avatarUrl?: string;
};

// Mock data removed - using real API calls

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
    // No fallback - return empty array if backend is not available
    console.error("Backend not available:", err);
    return [];
  }
}



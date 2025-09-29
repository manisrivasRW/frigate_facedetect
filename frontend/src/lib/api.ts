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

export async function fetchLogs(threshold: number): Promise<LogItem[]> {
  // Real API request to be enabled later:
  // const res = await fetch(`http://localhost:8000/api/logs?threshold=${threshold}`, {
  //   method: "GET",
  //   headers: { "Content-Type": "application/json" },
  //   // next: { revalidate: 0 }, // disable caching if needed
  // });
  // if (!res.ok) {
  //   throw new Error(`Failed to fetch logs: ${res.status}`);
  // }
  // const data: LogItem[] = await res.json();
  // return data;

  // Mock fallback until backend is connected
  await new Promise((r) => setTimeout(r, 200));
  return MOCK_LOGS.filter((l) => l.confidence >= threshold);
}



"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { fetchLogs, type LogItem } from "@/lib/api";

export default function Home() {
  const [threshold, setThreshold] = useState(0.6);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchLogs(threshold)
      .then((data) => {
        if (active) setLogs(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [threshold]);

  const filteredLogs = useMemo(() => logs, [logs]);

  const onNext = (id: string, total: number) => {
    setSlideIndex((prev) => {
      const current = prev[id] ?? 0;
      return { ...prev, [id]: (current + 1) % total };
    });
  };

  const onPrev = (id: string, total: number) => {
    setSlideIndex((prev) => {
      const current = prev[id] ?? 0;
      return { ...prev, [id]: (current - 1 + total) % total };
    });
  };

  return (
    <div className="min-h-screen w-full px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-widest text-center text-[#9ad7ff] drop-shadow-[0_0_10px_rgba(0,209,255,0.25)]">
          FRIGATE FACE LOGS
        </h1>

        <div className="mt-6 md:mt-8 glass neon-border rounded-xl p-4 md:p-5">
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#9ad7ff]/80">Threshold</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.1}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(parseFloat(e.target.value).toFixed(1)))}
              className="w-full accent-[#00d1ff]"
            />
            <span className="text-sm tabular-nums text-[#00d1ff] min-w-[2.5rem] text-right">{threshold.toFixed(1)}</span>
          </div>
          <div className="mt-2 grid grid-cols-9 text-[10px] text-[#9ad7ff]/60">
            {Array.from({ length: 9 }, (_, i) => 0.2 + i * 0.1).map((v) => (
              <span key={v.toFixed(1)} className="text-center">{v.toFixed(1)}</span>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {loading && (
            <div className="glass neon-border rounded-xl p-4 text-center text-[#9ad7ff]/80">
              Loading...
            </div>
          )}
          {filteredLogs.map((log) => {
            const isExpanded = expandedId === log.id;
            const index = slideIndex[log.id] ?? 0;
            const total = log.images.length;
            return (
              <div
                key={log.id}
                className="glass neon-border rounded-xl p-4 md:p-5 transition-shadow hover:shadow-[0_0_20px_rgba(0,209,255,0.2)]"
              >
                <button
                  onClick={() =>
                    setExpandedId((prev) => (prev === log.id ? null : log.id))
                  }
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#00d1ff] flex items-center justify-center text-black font-bold flex-shrink-0">
                        {log.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#e6f3ff] truncate max-w-[60vw] sm:max-w-none">
                          {log.name}
                        </div>
                        <div className="text-xs text-[#9ad7ff]/70">
                          Station: {log.policeStation}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm text-[#9ad7ff]">
                        Matches: {log.matches}
                      </div>
                      <div className="text-xs text-[#00d1ff]">
                        Confidence: {(log.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 border-t border-[#0b2d4a] pt-4">
                    <div className="relative overflow-hidden rounded-lg bg-black/40">
                      <div className="flex items-center justify-center h-48 sm:h-56 md:h-64 lg:h-72">
                        <Image
                          src={log.images[index]}
                          alt={`${log.name} ${index + 1}`}
                          width={240}
                          height={240}
                          sizes="(max-width: 640px) 160px, (max-width: 768px) 200px, 240px"
                          className="object-contain max-h-full"
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-between px-1 sm:px-2">
                        <button
                          onClick={() => onPrev(log.id, total)}
                          className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-[#0b132b]/70 hover:bg-[#0b132b]/90 text-[#9ad7ff] grid place-items-center"
                          aria-label="Previous image"
                        >
                          ‹
                        </button>
                        <button
                          onClick={() => onNext(log.id, total)}
                          className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-[#0b132b]/70 hover:bg-[#0b132b]/90 text-[#9ad7ff] grid place-items-center"
                          aria-label="Next image"
                        >
                          ›
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2">
                        {log.images.map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 w-5 sm:w-6 rounded-full ${
                              i === index ? "bg-[#00d1ff]" : "bg-[#16324a]"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setExpandedId(null)}
                        className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-[#0ea5e9] to-[#00d1ff] text-black font-semibold tracking-wide hover:opacity-90"
                      >
                        Collapse
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="glass neon-border rounded-xl p-5 md:p-6 text-center text-[#9ad7ff]/80">
              No logs at this threshold.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

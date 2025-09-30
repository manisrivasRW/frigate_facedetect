"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { fetchLogs, type LogItem } from "@/lib/api";

export default function Home() {
  const [threshold, setThreshold] = useState(0.2);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    // Clear current logs to avoid showing stale content while loading
    setLogs([]);
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

  const formatIST = (unixSeconds?: number) => {
    if (typeof unixSeconds !== "number") return "";
    try {
      return (
        new Date(unixSeconds * 1000).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " IST"
      );
    } catch {
      return new Date(unixSeconds * 1000).toString();
    }
  };

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
        <div className="flex items-center justify-center gap-4 mb-6 glass neon-border rounded-xl p-4 bg-gradient-to-r from-[#0b132b]/50 to-[#1e3a8a]/30">
        <Image
            src="/HEADER-logo.png"
            alt="Deekshabhoomi Logo"
            width={90}
            height={90}
            className="object-contain"
          />
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-widest text-[#9ad7ff] drop-shadow-[0_0_10px_rgba(0,209,255,0.25)]">
            Deekshabhoomi 2025 - Face Logs
          </h1>
        </div>

        <div className="mt-6 md:mt-8 flex justify-center relative">
          <div className="relative">
            <Image
              src="/face.png"
              alt="Face wireframe"
              width={300}
              height={300}
              className="object-contain w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72"
            />
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#00d1ff] to-transparent shadow-[0_0_10px_#00d1ff]" 
                   style={{
                     animation: 'scan 3s ease-in-out infinite',
                     animationDirection: 'alternate'
                   }}>
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00d1ff]/20 to-transparent pointer-events-none"
                   style={{
                     animation: 'scan 3s ease-in-out infinite',
                     animationDirection: 'alternate'
                   }}>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 glass neon-border rounded-xl p-4 md:p-5 max-w-2xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#9ad7ff]/80">Threshold</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.1}
              value={threshold}
              onChange={(e) => {
                const newValue = parseFloat(e.target.value);
                // Force exact 0.1 intervals by using step-based calculation
                const step = 0.1;
                const min = 0.2;
                const rounded = Math.round((newValue - min) / step) * step + min;
                setThreshold(parseFloat(rounded.toFixed(1)));
              }}
              className="w-full accent-[#00d1ff] cursor-pointer"
            />
            <span className="text-sm tabular-nums text-[#00d1ff] min-w-[2.5rem] text-right">{threshold.toFixed(1)}</span>
          </div>
          <div className="mt-2 grid grid-cols-9 text-[10px] text-[#9ad7ff]/60">
            {Array.from({ length: 9 }, (_, i) => 0.2 + i * 0.1).map((v) => (
              <button
                key={v.toFixed(1)}
                onClick={() => setThreshold(v)}
                className="text-center hover:text-[#00d1ff] transition-colors cursor-pointer"
              >
                {v.toFixed(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-[#00d1ff] border-t-transparent animate-spin" />
              </div>
            </div>
          ) : (
            <>
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
                  onClick={() => {
                    setExpandedId(log.id);
                    setModalOpen(true);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#00d1ff] overflow-hidden flex items-center justify-center text-black font-bold flex-shrink-0">
                        {log.avatarUrl ? (
                          <Image src={log.avatarUrl} alt={log.name} width={40} height={40} className="h-full w-full object-cover" />
                        ) : (
                          <span>{log.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#e6f3ff] truncate max-w-[60vw] sm:max-w-none">
                          {log.name}
                        </div>
                        <div className="text-xs text-[#9ad7ff]/70">
                          Age: {log.age ?? "-"}
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

                {/* Inline expanded panel removed in favor of modal */}
              </div>
            );
          })}

              {filteredLogs.length === 0 && !loading && (
                <div className="glass neon-border rounded-xl p-5 md:p-6 text-center text-[#9ad7ff]/80">
                  No logs at this threshold.
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* Modal glass card */}
      {modalOpen && expandedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/70 z-10" onClick={() => setModalOpen(false)} />
          <div className="relative glass neon-border rounded-2xl max-w-5xl w-full p-4 sm:p-6 grid grid-cols-1 md:grid-cols-5 gap-6 z-20">
            <button
              className="absolute top-3 right-3 h-9 w-9 rounded-full bg-[#0b132b]/70 hover:bg-[#0b132b]/90 text-[#9ad7ff] grid place-items-center z-30"
              onClick={() => setModalOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
            {(() => {
              const log = logs.find(l => l.id === expandedId)!;
              const index = slideIndex[log.id] ?? 0;
              const total = log.images.length;
              return (
                <>
                  <div className="md:col-span-2 flex flex-col items-center gap-4">
                    <div className="h-32 w-32 rounded-full overflow-hidden bg-gradient-to-br from-[#0ea5e9] to-[#00d1ff]">
                      {log.avatarUrl ? (
                        <Image src={log.avatarUrl as string} alt={log.name} width={128} height={128} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-black text-4xl font-bold">{log.name.charAt(0)}</div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-semibold text-[#e6f3ff]">{log.name}</div>
                      <div className="text-lg text-[#9ad7ff]/80 mt-1">Age: {log.age ?? "-"}</div>
                      <div className="text-sm text-[#9ad7ff]/60 mt-2">Address: {log.policeStation}</div>
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <div className="relative overflow-hidden rounded-xl bg-black/40">
                      <div className="flex items-center justify-center h-56 sm:h-64 md:h-72">
                        {total > 0 ? (
          <Image
                            src={log.images[index].url}
                            alt={`${log.name} ${index + 1}`}
                            width={320}
                            height={320}
                            className="object-contain max-h-full"
                          />
                        ) : (
                          <div className="text-center text-[#9ad7ff]/70 p-6">No images available</div>
                        )}
                      </div>
                      {total > 0 && (
                        <>
                          <div className="absolute inset-0 flex items-center justify-between px-2">
                            <button
                              onClick={() => onPrev(log.id, total)}
                              className="h-10 w-10 rounded-full bg-[#0b132b]/70 hover:bg-[#0b132b]/90 text-[#9ad7ff] grid place-items-center"
                              aria-label="Previous image"
                            >
                              ‹
                            </button>
                            <button
                              onClick={() => onNext(log.id, total)}
                              className="h-10 w-10 rounded-full bg-[#0b132b]/70 hover:bg-[#0b132b]/90 text-[#9ad7ff] grid place-items-center"
                              aria-label="Next image"
                            >
                              ›
                            </button>
                          </div>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                            {log.images.map((_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 w-6 rounded-full ${i === index ? "bg-[#00d1ff]" : "bg-[#16324a]"}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {total > 0 && (
                      <div className="mt-4 text-center">
                        <div className="text-lg font-semibold text-[#00d1ff]">
                          Match Score: {(log.images[index].score * 100).toFixed(1)}%
                        </div>
                        {typeof log.images[index].start_time !== "undefined" && (
                          <div className="text-xs text-[#9ad7ff]/70 mt-1">
                            Captured at: {formatIST(log.images[index].start_time)}
                          </div>
                        )}
                        <div className="text-sm text-[#9ad7ff]/70 mt-1">
                          Image {index + 1} of {total}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

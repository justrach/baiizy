"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { GRAB_SNAPSHOT_STYLE } from "@/lib/fallback-style";

const SG_CENTER: [number, number] = [103.8198, 1.3521];

export default function Map3Page() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<{ layers: number; sources: number } | null>(null);
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    try {
      if (!containerRef.current) return;
      const style = GRAB_SNAPSHOT_STYLE as { sources?: Record<string, { tiles?: string[] }>; sprite?: string };
      setDebug(`tiles=${style.sources?.grabmaptiles?.tiles?.[0] ?? "?"} · sprite=${style.sprite ?? "?"}`);
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: GRAB_SNAPSHOT_STYLE,
        center: SG_CENTER,
        zoom: 12.8,
        bearing: -8,
        pitch: 42,
        attributionControl: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;
        setStats({
          layers: map.getStyle().layers?.length ?? 0,
          sources: Object.keys(map.getStyle().sources ?? {}).length,
        });
        requestAnimationFrame(() => map.resize());
      });
      map.on("error", (e) => {
        const err = e?.error?.message ?? String(e);
        console.error("[map3 error]", err, e);
        if (err && !err.includes("404") && !err.toLowerCase().includes("aborterror")) {
          setError((prev) => prev || err);
        }
      });
      map.on("styledata", () => console.log("[map3] styledata fired"));
      map.on("sourcedata", (e) => { if (e.isSourceLoaded) console.log("[map3] source loaded:", e.sourceId); });
      map.on("idle", () => console.log("[map3] idle — map finished rendering"));
    } catch (e) {
      if (!cancelled) setError(e instanceof Error ? e.message : "Map init failed");
    }
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <style jsx global>{`
        .maplibregl-ctrl-attrib { background: rgba(255,250,240,0.85) !important; font-size: 10px !important; }
      `}</style>

      <header className="sticky top-0 z-10 border-b border-[#1b271f]/10 bg-[#fffaf0]/90 backdrop-blur-md px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-black text-[#4b554c] hover:text-[#172019] transition">
            ← Home
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-[#d79c52] animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.22em] text-[#172019]">
              Map3 · Grab style, copied 1:1
            </span>
          </div>
          <Link href="/maps" className="text-xs font-black text-[#4b554c] hover:text-[#172019] transition">/maps →</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-4">
        <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-4 shadow-sm backdrop-blur flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f]">Snapshot source</p>
            <p className="text-sm font-black text-[#172019] mt-1">
              urban-light-partner · captured via kuri · routed through /api/grab/proxy
            </p>
          </div>
          {stats && (
            <div className="flex gap-2">
              <span className="rounded-full bg-[#172019] px-3 py-1.5 text-xs font-black text-[#fffaf0]">
                {stats.layers} layers
              </span>
              <span className="rounded-full bg-[#d79c52] px-3 py-1.5 text-xs font-black text-[#172019]">
                {stats.sources} sources
              </span>
            </div>
          )}
        </div>

        {debug && (
          <div className="rounded-2xl bg-[#172019]/5 px-4 py-2 text-[0.62rem] font-mono font-bold text-[#536055] break-all">
            {debug}
          </div>
        </div>

        <div className="relative rounded-[2rem] overflow-hidden border border-[#1b271f]/10 bg-[#eadfca] shadow-[0_22px_70px_rgba(23,32,25,0.18)]">
          <div ref={containerRef} className="h-[70vh] min-h-[520px] max-h-[820px] w-full" />
          {error && (
            <div className="absolute inset-0 z-20 grid place-items-center p-6 bg-[#eadfca]/80">
              <div className="max-w-sm rounded-[1.6rem] bg-[#fffaf0] p-6 shadow-xl text-center">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f]">Map error</p>
                <p className="mt-2 text-sm font-black leading-6 text-[#536055]">{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/60 p-4 text-sm font-semibold text-[#536055] leading-6">
          This page renders <strong>Grab&apos;s own &ldquo;urban-light-partner&rdquo; style</strong> from a
          snapshot fetched while their endpoint was live. Tiles, sprite, and fonts all stream through
          <code className="mx-1 rounded bg-[#eadfca]/50 px-1.5 py-0.5 text-xs font-black text-[#172019]">/api/grab/proxy</code>
          so the Bearer token stays server-side. When Grab&apos;s font service 502s, labels auto-fallback
          to Protomaps&apos; Noto Sans so nothing disappears.
        </div>
      </div>
    </div>
  );
}

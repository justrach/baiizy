"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { type Map as MLMap, type Marker as MLMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useSession } from "@/lib/auth-client";
import { loadMapStyle, FALLBACK_BEARING, FALLBACK_PITCH, resolveStyleUrls } from "@/lib/fallback-style";

type FriendLoc = {
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
  lat: number;
  lng: number;
  updatedAt: string | null;
  bio: string | null;
  neighborhood: string | null;
};

const COLORS = ["#1f6b5d", "#8a6d2f", "#b6522b", "#2f607f", "#8a3f38", "#c7812f"];
const SG_CENTER: [number, number] = [103.8198, 1.3521];
const initialsOf = (n: string) => n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

function relTime(iso: string | null) {
  if (!iso) return "never shared";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function buildMarkerEl(f: FriendLoc, isMe: boolean): HTMLElement {
  const ring = isMe ? "#d79c52" : COLORS[f.userId.charCodeAt(0) % COLORS.length];
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.className = "friend-marker";
  wrap.setAttribute("aria-label", f.name);
  wrap.style.cssText = `
    width: 48px; height: 48px; position: relative; cursor: pointer;
    padding: 0; border: 0; background: transparent;
    transform-origin: center bottom; transition: transform 180ms ease;
  `;

  const pulse = document.createElement("div");
  pulse.style.cssText = `
    position: absolute; inset: -4px; border-radius: 50%;
    background: ${ring}30; animation: friend-pulse 2.4s ease-out infinite;
    pointer-events: none;
  `;
  wrap.appendChild(pulse);

  const ringEl = document.createElement("div");
  ringEl.style.cssText = `
    position: relative; width: 48px; height: 48px; border-radius: 50%;
    background: ${ring}; padding: 3px;
    box-shadow: 0 6px 18px rgba(23,32,25,0.32), 0 1px 3px rgba(0,0,0,0.15);
  `;

  const inner = document.createElement("div");
  inner.style.cssText = `
    width: 42px; height: 42px; border-radius: 50%;
    display: grid; place-items: center; overflow: hidden;
    background: #fffaf0; color: #172019; font-weight: 900; font-size: 14px;
    border: 2px solid #fffaf0;
  `;
  if (f.image) {
    const img = document.createElement("img");
    img.src = f.image;
    img.alt = f.name;
    img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
    inner.appendChild(img);
  } else {
    inner.textContent = initialsOf(f.name);
    inner.style.background = ring;
    inner.style.color = "#fffaf0";
  }
  ringEl.appendChild(inner);

  // (pin tail removed — anchor:"center" places the avatar ring directly on the coord)

  wrap.appendChild(ringEl);

  wrap.addEventListener("mouseenter", () => { wrap.style.transform = "scale(1.08)"; });
  wrap.addEventListener("mouseleave", () => { wrap.style.transform = "scale(1)"; });

  return wrap;
}

export default function FriendsMapPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<MLMarker[]>([]);

  const session = useSession();
  const [friends, setFriends] = useState<FriendLoc[]>([]);
  const [me, setMe] = useState<string>("");
  const [styleReady, setStyleReady] = useState(false);
  const [loadError, setLoadError] = useState<string>("");
  const [selected, setSelected] = useState<FriendLoc | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState("");
  const [toast, setToast] = useState<string>("");

  const loadFriends = async () => {
    try {
      const r = await fetch("/api/friends/locations");
      const text = await r.text();
      if (!text) { setFriends([]); return; }
      const data = JSON.parse(text);
      setFriends(data.friends ?? []);
      setMe(data.me ?? "");
    } catch (e) {
      console.warn("Friend location fetch failed:", e);
      setFriends([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const loaded = await loadMapStyle();
      const { fallback, reason } = loaded;
      const style = loaded.fallback ? resolveStyleUrls(loaded.style, window.location.origin) : loaded.style;
      const isRasterFallback = loaded.fallbackKind === "carto-raster";
      if (cancelled || !containerRef.current) return;
      if (fallback) { setUsingFallback(true); setFallbackReason(reason ?? ""); }

      try {
        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: SG_CENTER,
          zoom: 11.4,
          attributionControl: false,
          bearing: isRasterFallback ? FALLBACK_BEARING : -10,
          pitch: isRasterFallback ? FALLBACK_PITCH : 24,
        });
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
        mapRef.current = map;

        map.on("load", () => {
          if (!cancelled) setStyleReady(true);
          requestAnimationFrame(() => map.resize());
          setTimeout(() => map.resize(), 120);
          setTimeout(() => map.resize(), 450);
        });
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Map failed to load");
      }
    };
    init();
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!session.data?.user) return;
    loadFriends();
  }, [session.data?.user]);

  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady || !map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (friends.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    for (const f of friends) {
      const el = buildMarkerEl(f, f.userId === me);
      el.addEventListener("click", () => {
        setSelected(f);
        map.flyTo({ center: [f.lng, f.lat], zoom: 16, duration: 800, essential: true, pitch: 24 });
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([f.lng, f.lat])
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([f.lng, f.lat]);
    }

    if (friends.length === 1) {
      map.flyTo({ center: [friends[0].lng, friends[0].lat], zoom: 13, duration: 900 });
    } else {
      map.fitBounds(bounds, { padding: 80, duration: 900, maxZoom: 13.5 });
    }
  }, [styleReady, friends, me]);

  if (!session.data?.user) {
    return (
      <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center">
        <Link href="/login" className="rounded-2xl bg-[#172019] px-6 py-3 text-sm font-black text-[#fffaf0]">Sign in</Link>
      </div>
    );
  }

  const otherFriends = friends.filter((f) => f.userId !== me);

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <style jsx global>{`
        @keyframes friend-pulse {
          0% { transform: scale(1); opacity: 0.55; }
          75% { transform: scale(1.9); opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        .maplibregl-ctrl-attrib { background: rgba(255,250,240,0.8) !important; font-size: 10px !important; }
      `}</style>

      <header className="sticky top-0 z-20 border-b border-[#1b271f]/10 bg-[#fffaf0]/90 backdrop-blur-md px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/users" className="flex items-center gap-2 text-sm font-black text-[#4b554c] hover:text-[#172019] transition">
            ← Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-[#1f6b5d] animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.22em] text-[#172019]">Live · Friends map</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setToast("Refreshing…");
                await loadFriends();
                setToast("");
              }}
              className="rounded-2xl border border-[#1b271f]/10 px-3 py-2 text-xs font-black text-[#4b554c] hover:border-[#172019] hover:text-[#172019] transition"
              title="Refresh friend locations"
            >
              ↻
            </button>
            <button
              onClick={async () => {
                setSeeding(true);
                setToast("Summoning friends…");
                try {
                  const r = await fetch("/api/dev/seed-friends", { method: "POST" });
                  const data = await r.json().catch(() => ({}));
                  if (!r.ok) {
                    setToast(`Seed failed: ${data?.error ?? r.status}`);
                  } else {
                    await loadFriends();
                    setToast(`✓ Linked ${data.linked?.length ?? 0} friends`);
                    setTimeout(() => setToast(""), 3500);
                  }
                } catch (e) {
                  setToast(`Seed failed: ${e instanceof Error ? e.message : "network"}`);
                } finally {
                  setSeeding(false);
                }
              }}
              disabled={seeding}
              className="rounded-2xl bg-[#1f6b5d] px-3 py-2 text-xs font-black text-[#fffaf0] hover:bg-[#255f55] transition disabled:opacity-60"
              title="Seed demo friends"
            >
              {seeding ? "…" : "🪄 Demo"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-4">
        {/* Fallback banner */}
        {usingFallback && (
          <div className="flex items-center justify-center gap-2 rounded-full bg-[#d79c52] px-4 py-2 shadow-[0_10px_30px_rgba(215,156,82,0.3)]">
            <span className="size-2 rounded-full bg-[#172019] animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.18em] text-[#172019]">
              Not GrabMaps · using OpenStreetMap fallback
            </span>
            {fallbackReason && <span className="text-[0.62rem] font-bold text-[#172019]/60 hidden sm:inline">({fallbackReason})</span>}
          </div>
        )}

        {/* Toast / status message */}
        {toast && (
          <div className="flex items-center justify-center">
            <div className="rounded-full bg-[#172019] px-4 py-2 text-xs font-black text-[#fffaf0] shadow-[0_8px_24px_rgba(23,32,25,0.25)]">
              {toast}
            </div>
          </div>
        )}

        {/* Map card */}
        <div className="relative rounded-[2rem] overflow-hidden border border-[#1b271f]/10 bg-[#eadfca] shadow-[0_22px_70px_rgba(23,32,25,0.18)]">
          <div ref={containerRef} className="h-[62vh] min-h-[440px] max-h-[720px] w-full" />

          {/* Selected friend detail, overlaid bottom-left */}
          {selected && (
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm z-10 rounded-[1.4rem] border border-[#1b271f]/10 bg-[#fffaf0]/96 p-4 shadow-[0_20px_60px_rgba(23,32,25,0.25)] backdrop-blur-xl">
              <div className="flex items-start gap-3">
                {selected.image ? (
                  <img src={selected.image} alt="" className="size-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <span
                    className="grid size-12 place-items-center rounded-full text-sm font-black text-[#fffaf0] flex-shrink-0"
                    style={{ backgroundColor: COLORS[selected.userId.charCodeAt(0) % COLORS.length] }}
                  >
                    {initialsOf(selected.name)}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-sm text-[#172019]">{selected.name}</p>
                    {selected.username && <p className="text-xs font-bold text-[#667064]">@{selected.username}</p>}
                    {selected.userId === me && <span className="rounded-full bg-[#d79c52] px-1.5 py-0.5 text-[0.58rem] font-black text-[#172019]">you</span>}
                  </div>
                  <p className="text-[0.68rem] font-bold text-[#667064] mt-0.5">
                    📍 {selected.neighborhood ?? "unknown area"}
                    <span className="text-[#899083] ml-1">({selected.lat.toFixed(4)}, {selected.lng.toFixed(4)})</span>
                  </p>
                  <p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#8a6d2f] mt-0.5">
                    {relTime(selected.updatedAt)}
                  </p>
                  {selected.bio && <p className="text-xs font-semibold text-[#536055] mt-1.5 leading-5 line-clamp-2">{selected.bio}</p>}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-full bg-[#fffaf0] border border-[#1b271f]/10 size-6 grid place-items-center text-[0.62rem] font-black text-[#4b554c] hover:bg-[#172019] hover:text-[#fffaf0] transition flex-shrink-0"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Empty state overlay */}
          {styleReady && otherFriends.length === 0 && !loadError && (
            <div className="absolute inset-0 z-10 grid place-items-center p-6 bg-[#eadfca]/60">
              <div className="max-w-sm rounded-[1.6rem] bg-[#fffaf0] p-6 shadow-[0_20px_60px_rgba(23,32,25,0.22)] text-center">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f]">No friends on the map yet</p>
                <h2 className="mt-2 font-serif text-xl font-black tracking-[-0.04em] text-[#172019]">
                  It&apos;s lonely out here
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#536055]">
                  Summon 6 demo friends across Singapore — or add real ones from the <Link href="/users" className="underline font-black">friends page</Link>.
                </p>
                <button
                  onClick={async () => {
                    setSeeding(true);
                    const r = await fetch("/api/dev/seed-friends", { method: "POST" });
                    const data = await r.json().catch(() => null);
                    setSeeding(false);
                    if (r.ok) { await loadFriends(); } else alert(data?.error ?? "Seed failed");
                  }}
                  disabled={seeding}
                  className="mt-4 w-full rounded-2xl bg-[#1f6b5d] px-4 py-2.5 text-xs font-black text-[#fffaf0] hover:bg-[#255f55] transition disabled:opacity-60"
                >
                  {seeding ? "Summoning friends..." : "🪄 Seed 6 demo friends"}
                </button>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {loadError && (
            <div className="absolute inset-0 z-20 grid place-items-center p-6 bg-[#eadfca]/80">
              <div className="max-w-sm rounded-[1.6rem] bg-[#fffaf0] p-6 shadow-xl text-center">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f]">Map loading</p>
                <p className="mt-2 text-sm font-black leading-6 text-[#536055]">{loadError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-2xl bg-[#172019] px-5 py-2 text-xs font-black text-[#fffaf0] hover:bg-[#2b372e] transition"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Friend list below map */}
        {otherFriends.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {otherFriends.map((f) => {
              const color = COLORS[f.userId.charCodeAt(0) % COLORS.length];
              const isSelected = selected?.userId === f.userId;
              return (
                <button
                  key={f.userId}
                  onClick={() => {
                    setSelected(f);
                    mapRef.current?.flyTo({ center: [f.lng, f.lat], zoom: 16, duration: 900, pitch: 24 });
                  }}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                    isSelected
                      ? "border-[#172019] bg-[#172019] text-[#fffaf0]"
                      : "border-[#1b271f]/10 bg-[#fffaf0]/82 hover:border-[#172019] hover:shadow-md"
                  }`}
                >
                  {f.image ? (
                    <img src={f.image} alt="" className="size-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span
                      className="grid size-10 place-items-center rounded-full text-xs font-black text-[#fffaf0] flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {initialsOf(f.name)}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-black text-sm ${isSelected ? "text-[#fffaf0]" : "text-[#172019]"}`}>{f.name}</p>
                      {f.username && <p className={`text-[0.62rem] font-bold ${isSelected ? "text-[#d7c9a8]" : "text-[#667064]"}`}>@{f.username}</p>}
                    </div>
                    <p className={`text-[0.62rem] font-bold ${isSelected ? "text-[#d7c9a8]" : "text-[#667064]"} mt-0.5 truncate`}>
                      📍 {f.neighborhood ?? `${f.lat.toFixed(3)}, ${f.lng.toFixed(3)}`} · {relTime(f.updatedAt)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { type Map as MLMap, type Marker as MLMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useSession } from "@/lib/auth-client";
import { loadMapStyle } from "@/lib/fallback-style";

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
    width: 56px; height: 56px; position: relative; cursor: pointer;
    padding: 0; border: 0; background: transparent;
    transform-origin: center bottom; transition: transform 180ms ease;
  `;

  // Pulse ring (behind)
  const pulse = document.createElement("div");
  pulse.style.cssText = `
    position: absolute; inset: -6px; border-radius: 50%;
    background: ${ring}30; animation: friend-pulse 2.4s ease-out infinite;
    pointer-events: none;
  `;
  wrap.appendChild(pulse);

  // Colored ring + inner avatar
  const ringEl = document.createElement("div");
  ringEl.style.cssText = `
    position: relative; width: 56px; height: 56px; border-radius: 50%;
    background: ${ring}; padding: 3px;
    box-shadow: 0 8px 22px rgba(23,32,25,0.35), 0 1px 3px rgba(0,0,0,0.15);
  `;

  const inner = document.createElement("div");
  inner.style.cssText = `
    width: 50px; height: 50px; border-radius: 50%;
    display: grid; place-items: center; overflow: hidden;
    background: #fffaf0; color: #172019; font-weight: 900; font-size: 16px;
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

  // Little pointer tail
  const tail = document.createElement("div");
  tail.style.cssText = `
    position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
    width: 10px; height: 10px; border-radius: 2px;
    background: ${ring}; transform: translateX(-50%) rotate(45deg);
    box-shadow: 0 4px 10px rgba(23,32,25,0.25);
  `;
  ringEl.appendChild(tail);

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

  // Load style + init map
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { style, fallback, reason } = await loadMapStyle();
        if (cancelled || !containerRef.current) return;
        if (fallback) { setUsingFallback(true); setFallbackReason(reason ?? ""); }

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: SG_CENTER,
          zoom: 11.6,
          attributionControl: false,
          bearing: -10,
          pitch: 36,
        });
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
        mapRef.current = map;

        map.on("load", () => {
          if (!cancelled) setStyleReady(true);
          requestAnimationFrame(() => map.resize());
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

  // Load friend locations
  useEffect(() => {
    if (!session.data?.user) return;
    loadFriends();
  }, [session.data?.user]);

  // Render markers when map + data ready
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady || !map) return;

    // Clear previous
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (friends.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    for (const f of friends) {
      const el = buildMarkerEl(f, f.userId === me);
      el.addEventListener("click", () => {
        setSelected(f);
        map.flyTo({ center: [f.lng, f.lat], zoom: 14.5, duration: 800, essential: true });
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([f.lng, f.lat])
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([f.lng, f.lat]);
    }

    if (friends.length === 1) {
      map.flyTo({ center: [friends[0].lng, friends[0].lat], zoom: 13.5, duration: 900 });
    } else {
      map.fitBounds(bounds, { padding: 100, duration: 900, maxZoom: 13 });
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
    <div className="fixed inset-0 overflow-hidden bg-[#eadfca]">
      <style jsx global>{`
        @keyframes friend-pulse {
          0% { transform: scale(1); opacity: 0.55; }
          75% { transform: scale(1.9); opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        .maplibregl-ctrl-attrib { background: rgba(255,250,240,0.8) !important; }
      `}</style>

      <div ref={containerRef} className="absolute inset-0" />

      {/* Top overlay: header + friend strip */}
      <div className="absolute top-0 inset-x-0 z-10 pointer-events-none">
        <div className="px-4 pt-4 pointer-events-auto">
          <div className="flex items-center justify-between rounded-full border border-[#1b271f]/10 bg-[#fffaf0]/92 px-4 py-3 shadow-[0_18px_60px_rgba(23,32,25,0.16)] backdrop-blur-xl">
            <Link href="/users" className="flex items-center gap-2 text-sm font-black text-[#4b554c] hover:text-[#172019] transition">
              ← Back
            </Link>
            <div className="flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-[#1f6b5d] animate-pulse" />
              <span className="text-xs font-black uppercase tracking-[0.22em] text-[#172019]">Live · Friends map</span>
            </div>
            <div className="w-12" />
          </div>
        </div>

        {/* GrabMaps-down banner */}
        {usingFallback && (
          <div className="px-4 mt-3 pointer-events-auto">
            <div className="flex items-center justify-center gap-2 rounded-full bg-[#d79c52] px-4 py-2 shadow-[0_10px_30px_rgba(215,156,82,0.3)] backdrop-blur">
              <span className="size-2 rounded-full bg-[#172019] animate-pulse" />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-[#172019]">
                Not GrabMaps · using OpenStreetMap fallback
              </span>
              {fallbackReason && <span className="text-[0.62rem] font-bold text-[#172019]/60">({fallbackReason})</span>}
            </div>
          </div>
        )}

        {/* Horizontal friend strip */}
        {otherFriends.length > 0 && (
          <div className="px-4 mt-3 pointer-events-auto">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {otherFriends.map((f) => {
                const color = COLORS[f.userId.charCodeAt(0) % COLORS.length];
                return (
                  <button
                    key={f.userId}
                    onClick={() => {
                      setSelected(f);
                      mapRef.current?.flyTo({ center: [f.lng, f.lat], zoom: 15, duration: 900 });
                    }}
                    className="flex-shrink-0 flex items-center gap-2 rounded-full border border-[#1b271f]/10 bg-[#fffaf0]/95 pr-4 pl-1 py-1 shadow-sm backdrop-blur hover:bg-[#172019] hover:text-[#fffaf0] transition group"
                  >
                    {f.image ? (
                      <img src={f.image} alt="" className="size-8 rounded-full object-cover" />
                    ) : (
                      <span
                        className="grid size-8 place-items-center rounded-full text-[0.62rem] font-black text-[#fffaf0]"
                        style={{ backgroundColor: color }}
                      >
                        {initialsOf(f.name)}
                      </span>
                    )}
                    <span className="text-xs font-black text-[#172019] group-hover:text-[#fffaf0] transition">
                      {f.name.split(" ")[0]}
                    </span>
                    <span className="text-[0.62rem] font-bold text-[#667064] group-hover:text-[#d7c9a8] transition">
                      {relTime(f.updatedAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected friend detail card (bottom) */}
      {selected && (
        <div className="absolute bottom-4 inset-x-0 z-10 px-4 pointer-events-none">
          <div className="mx-auto max-w-md rounded-[1.8rem] border border-[#1b271f]/10 bg-[#fffaf0]/96 p-5 shadow-[0_24px_80px_rgba(23,32,25,0.28)] backdrop-blur-2xl pointer-events-auto">
            <div className="flex items-start gap-4">
              {selected.image ? (
                <img src={selected.image} alt="" className="size-14 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span
                  className="grid size-14 place-items-center rounded-full text-base font-black text-[#fffaf0] flex-shrink-0"
                  style={{ backgroundColor: COLORS[selected.userId.charCodeAt(0) % COLORS.length] }}
                >
                  {initialsOf(selected.name)}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-[#172019]">{selected.name}</p>
                  {selected.username && <p className="text-xs font-bold text-[#667064]">@{selected.username}</p>}
                  {selected.userId === me && <span className="rounded-full bg-[#d79c52] px-2 py-0.5 text-[0.62rem] font-black text-[#172019]">you</span>}
                </div>
                <p className="text-xs font-bold text-[#667064] mt-0.5">
                  📍 {selected.neighborhood ?? `${selected.lat.toFixed(3)}, ${selected.lng.toFixed(3)}`}
                </p>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a6d2f] mt-1">
                  Last seen {relTime(selected.updatedAt)}
                </p>
                {selected.bio && <p className="text-sm font-semibold text-[#536055] mt-2 leading-6">{selected.bio}</p>}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-full bg-[#fffaf0] border border-[#1b271f]/10 size-8 grid place-items-center text-xs font-black text-[#4b554c] hover:bg-[#172019] hover:text-[#fffaf0] transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {styleReady && friends.length === 0 && !loadError && (
        <div className="absolute inset-0 z-20 grid place-items-center p-6 text-center pointer-events-none">
          <div className="max-w-sm rounded-[1.8rem] bg-[#fffaf0]/96 p-6 shadow-[0_24px_80px_rgba(23,32,25,0.28)] backdrop-blur-xl pointer-events-auto">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f]">No one on the map</p>
            <h2 className="mt-2 font-serif text-2xl font-black tracking-[-0.04em] text-[#172019]">Share your location to appear here</h2>
            <p className="mt-2 text-sm font-semibold text-[#536055]">
              Add friends on the <Link href="/users" className="underline font-black">friends page</Link>, then tap &quot;Use my location&quot; on the Picks tab.
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
              className="mt-4 w-full rounded-2xl bg-[#1f6b5d] px-4 py-3 text-sm font-black text-[#fffaf0] hover:bg-[#255f55] transition disabled:opacity-60"
            >
              {seeding ? "Summoning friends..." : "🪄 Seed 6 demo friends across Singapore"}
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {loadError && (
        <div className="absolute inset-0 z-30 grid place-items-center p-6 text-center">
          <div className="max-w-sm rounded-[1.8rem] bg-[#fffaf0] p-6 shadow-xl">
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
  );
}

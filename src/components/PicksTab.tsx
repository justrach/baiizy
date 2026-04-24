"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type AvailSlot = {
  slot: string;
  label: string;
  suggestedIntent: string;
  meFree: boolean;
  friends: Array<{ userId: string; name: string; username: string | null; image: string | null }>;
  count: number;
};

type NearbyFriend = {
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
  lat: number;
  lng: number;
  distanceKm: number;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fmtDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

type Recommendation = {
  poi_id: string;
  name: string;
  category: string;
  matchingIntent: string;
  whyItFits: string;
  suggestedMove: string;
  matchScore: number;
  address: string;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
};

const INTENT_COLORS: Record<string, string> = {
  work: "#1f6b5d",
  lunch: "#b6522b",
  supper: "#8a3f38",
  date: "#c7812f",
  friend: "#2f607f",
};

const INTENT_LABELS: Record<string, string> = {
  work: "Work",
  lunch: "Lunch",
  supper: "Supper",
  date: "Date",
  friend: "Friends",
};

export default function PicksTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usingLive, setUsingLive] = useState<boolean | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; source?: string; ageMinutes?: number | null; neighborhoodLabel?: string | null } | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [focusIntent, setFocusIntent] = useState<string | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [nearby, setNearby] = useState<NearbyFriend[]>([]);
  const [dismissedNearby, setDismissedNearby] = useState<Set<string>>(new Set());
  const [creatingEventFor, setCreatingEventFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailSlot[]>([]);
  const router = useRouter();

  const createQuickEvent = async (friendUserId: string) => {
    setCreatingEventFor(friendUserId);
    try {
      const r = await fetch("/api/events/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendUserId, startsInMin: 15 }),
      });
      const data = await r.json();
      if (r.ok && data?.event?.id) {
        router.push(`/events/${data.event.id}`);
      } else {
        alert(data?.error ?? "Couldn't create event");
      }
    } finally {
      setCreatingEventFor(null);
    }
  };

  useEffect(() => {
    fetch("/api/friends/availability")
      .then((r) => r.text())
      .then((t) => t ? JSON.parse(t) : null)
      .then((d) => setAvailability((d?.overlap as AvailSlot[] | undefined) ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch("/api/friends/locations");
        const text = await r.text();
        if (!text) return;
        const data = JSON.parse(text);
        const me = (data.friends ?? []).find((f: { userId: string; lat: number; lng: number }) => f.userId === data.me);
        if (!me) return;
        const others = (data.friends ?? [])
          .filter((f: { userId: string }) => f.userId !== data.me)
          .map((f: { userId: string; name: string; username: string | null; image: string | null; lat: number; lng: number }) => ({
            userId: f.userId,
            name: f.name,
            username: f.username,
            image: f.image,
            lat: f.lat,
            lng: f.lng,
            distanceKm: haversineKm({ lat: me.lat, lng: me.lng }, { lat: f.lat, lng: f.lng }),
          }))
          .filter((f: NearbyFriend) => f.distanceKm <= 1)
          .sort((a: NearbyFriend, b: NearbyFriend) => a.distanceKm - b.distanceKm);
        setNearby(others);
      } catch {
        /* silent */
      }
    };
    run();
    // Re-check every 30s so mocked notifications feel alive
    const id = setInterval(run, 30_000);
    return () => clearInterval(id);
  }, [location]);

  const shareLocation = () => {
    setSharingLocation(true);
    setLocationMsg("");
    if (!navigator.geolocation) {
      setLocationMsg("Your browser doesn't support location");
      setSharingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        await fetch("/api/user/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        });
        setLocation({ lat, lng, source: "live", ageMinutes: 0 });
        setLocationMsg(`✓ Location saved (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        setSharingLocation(false);
        // Auto-refresh recommendations now that DB has fresh coords
        if (recs.length > 0) fetchRecs(focusIntent ?? undefined);
      },
      (err) => {
        setLocationMsg(`Location denied: ${err.message}`);
        setSharingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const fetchRecs = useCallback(async (intent?: string, searchQuery?: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (intent) params.set("intent", intent);
      if (searchQuery) params.set("q", searchQuery);
      const url = params.toString() ? `/api/recommendations?${params}` : "/api/recommendations";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to get recommendations");
        setRecs([]);
      } else {
        setRecs(data.recommendations ?? []);
        setUsingLive(data.usingLiveLocation ?? false);
        setLocation(data.location ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  }, []);

  const checkIn = async (r: Recommendation) => {
    setCheckingIn(r.poi_id);
    await fetch("/api/user/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poi_id: r.poi_id,
        name: r.name,
        category: r.category,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        note: r.suggestedMove,
      }),
    });
    setCheckedIn((prev) => new Set(prev).add(r.poi_id));
    setCheckingIn(null);
  };

  const intents: (string | null)[] = [null, "work", "lunch", "supper", "date", "friend"];

  const visibleNearby = nearby.filter((f) => !dismissedNearby.has(f.userId));

  return (
    <div className="space-y-4">
      {/* 🔔 Nearby friends notification (mocked) */}
      {visibleNearby.length > 0 && (
        <div className="space-y-2">
          {visibleNearby.slice(0, 3).map((f) => (
            <div
              key={f.userId}
              className="flex items-center gap-3 rounded-[1.4rem] border border-[#d79c52]/50 bg-gradient-to-r from-[#fff6df] to-[#eadfca]/60 p-3 shadow-[0_10px_30px_rgba(215,156,82,0.2)]"
            >
              <div className="relative flex-shrink-0">
                {f.image ? (
                  <img src={f.image} alt="" className="size-11 rounded-full object-cover border-2 border-[#d79c52]" />
                ) : (
                  <div className="size-11 rounded-full bg-[#1f6b5d] grid place-items-center text-xs font-black text-[#fffaf0] border-2 border-[#d79c52]">
                    {f.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                )}
                <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-[#1f6b5d] border-2 border-[#fffaf0] animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b6522b]">🔔 Nearby now</p>
                <p className="text-sm font-black text-[#172019] mt-0.5 truncate">
                  {f.name} is <span className="text-[#1f6b5d]">{fmtDist(f.distanceKm)}</span> away
                </p>
                {f.username && <p className="text-[0.62rem] font-bold text-[#667064]">@{f.username}</p>}
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <button
                  onClick={() => createQuickEvent(f.userId)}
                  disabled={creatingEventFor === f.userId}
                  className="rounded-2xl bg-[#1f6b5d] px-3 py-1.5 text-xs font-black text-[#fffaf0] hover:bg-[#255f55] transition disabled:opacity-60 whitespace-nowrap"
                >
                  {creatingEventFor === f.userId ? "Creating…" : "⚡ Tap in"}
                </button>
                <button
                  onClick={() => setDismissedNearby((prev) => new Set(prev).add(f.userId))}
                  className="text-[0.62rem] font-black text-[#899083] hover:text-[#172019] transition"
                  aria-label="Dismiss"
                >
                  dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Freeform search */}
      <form
        onSubmit={(e) => { e.preventDefault(); fetchRecs(focusIntent ?? undefined, query || undefined); }}
        className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-1 shadow-sm backdrop-blur flex items-center gap-1"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try: 'dessert walk' or 'loud bar after work' or 'quiet coffee with Maya'"
          className="flex-1 rounded-[1.2rem] bg-transparent px-4 py-2.5 text-sm font-bold text-[#172019] outline-none placeholder:text-[#899083]"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="text-xs font-black text-[#899083] px-2">
            clear
          </button>
        )}
        <button type="submit" className="rounded-[1.2rem] bg-[#172019] px-4 py-2.5 text-xs font-black text-[#fffaf0] hover:bg-[#2b372e] transition">
          Search
        </button>
      </form>

      {/* 🗓 Free together */}
      {availability.length > 0 && availability.some((a) => a.meFree && a.friends.length > 0) && (
        <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#172019] p-4 text-[#fffaf0] shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black uppercase tracking-[0.22em] text-[#d79c52]">🗓 Free together</span>
            <span className="text-[0.62rem] font-bold text-[#d7c9a8]">when you &amp; friends overlap</span>
          </div>
          <div className="space-y-2">
            {availability
              .filter((a) => a.meFree && a.friends.length > 0)
              .slice(0, 4)
              .map((a) => {
                const stacked = a.friends.slice(0, 4);
                const extra = a.friends.length - stacked.length;
                return (
                  <button
                    key={a.slot}
                    onClick={() => { setFocusIntent(a.suggestedIntent); fetchRecs(a.suggestedIntent, undefined); }}
                    className="w-full flex items-center gap-3 rounded-2xl border border-[#fffaf0]/10 bg-[#fffaf0]/5 p-3 hover:bg-[#fffaf0]/10 transition"
                  >
                    <div className="flex -space-x-2 flex-shrink-0">
                      {stacked.map((f) =>
                        f.image ? (
                          <img key={f.userId} src={f.image} alt="" className="size-8 rounded-full object-cover border-2 border-[#172019]" />
                        ) : (
                          <span key={f.userId} className="grid size-8 place-items-center rounded-full bg-[#b6522b] text-[0.62rem] font-black text-[#fffaf0] border-2 border-[#172019]">
                            {f.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                          </span>
                        ),
                      )}
                      {extra > 0 && (
                        <span className="grid size-8 place-items-center rounded-full bg-[#fffaf0]/15 text-[0.62rem] font-black text-[#fffaf0] border-2 border-[#172019]">
                          +{extra}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-black text-sm">{a.label}</p>
                      <p className="text-[0.62rem] font-bold text-[#d7c9a8]">
                        {a.friends.length} friend{a.friends.length === 1 ? "" : "s"} free · suggests {a.suggestedIntent}
                      </p>
                    </div>
                    <span className="text-xs font-black text-[#d79c52] flex-shrink-0">Show picks →</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Location + intent controls */}
      <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f]">Your location</p>
            <p className="text-sm font-bold text-[#172019] mt-1">
              {usingLive === null
                ? "Not fetched yet"
                : usingLive
                ? (<>Using live GPS {location?.ageMinutes != null && <span className="font-semibold text-[#667064]">· saved {location.ageMinutes === 0 ? "just now" : `${location.ageMinutes}m ago`}</span>}</>)
                : (<>Using neighborhood {location?.neighborhoodLabel && <span className="font-semibold text-[#667064]">({location.neighborhoodLabel})</span>}</>)}
              {location && <span className="block text-[0.62rem] font-mono font-bold text-[#899083] mt-0.5">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>}
            </p>
          </div>
          <button
            onClick={shareLocation}
            disabled={sharingLocation}
            className="rounded-2xl bg-[#1f6b5d] px-4 py-2 text-xs font-black text-[#fffaf0] hover:bg-[#255f55] transition disabled:opacity-60"
          >
            {sharingLocation ? "Getting..." : "📍 Use my location"}
          </button>
        </div>
        {locationMsg && <p className="text-xs font-bold text-[#536055]">{locationMsg}</p>}

        <div className="flex flex-wrap gap-2 mt-4">
          {intents.map((i) => (
            <button
              key={i ?? "all"}
              onClick={() => { setFocusIntent(i); fetchRecs(i ?? undefined, query || undefined); }}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                focusIntent === i
                  ? "bg-[#172019] text-[#fffaf0]"
                  : "border border-[#1b271f]/10 bg-[#fffaf0] text-[#4b554c] hover:border-[#172019]"
              }`}
            >
              {i === null ? "✨ Any" : INTENT_LABELS[i]}
            </button>
          ))}
        </div>

        {recs.length === 0 && !loading && (
          <button
            onClick={() => fetchRecs(focusIntent ?? undefined, query || undefined)}
            className="mt-4 w-full rounded-2xl bg-[#172019] py-3 text-sm font-black text-[#fffaf0] hover:bg-[#2b372e] transition"
          >
            🤖 Get AI recommendations
          </button>
        )}
      </div>

      {loading && (
        <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/70 p-8 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="size-2 rounded-full bg-[#1f6b5d] animate-pulse" />
            <span className="size-2 rounded-full bg-[#1f6b5d] animate-pulse [animation-delay:120ms]" />
            <span className="size-2 rounded-full bg-[#1f6b5d] animate-pulse [animation-delay:240ms]" />
          </div>
          <p className="font-semibold text-[#667064] mt-3">Asking the AI to find spots near you...</p>
          <p className="text-xs font-bold text-[#899083] mt-1">Usually 10-30 seconds. Agent will timeout at 45s if the model is slow.</p>
        </div>
      )}

      {error && (
        <div className="rounded-[1.5rem] bg-[#b6522b]/10 p-4">
          <p className="text-sm font-black text-[#8a3f38]">{error}</p>
        </div>
      )}

      {recs.map((r) => {
        const color = INTENT_COLORS[r.matchingIntent] ?? "#1f6b5d";
        const hasCheckedIn = checkedIn.has(r.poi_id);
        return (
          <article
            key={r.poi_id}
            className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-5 shadow-sm backdrop-blur"
          >
            <div className="flex items-start gap-4">
              <div
                className="grid size-12 place-items-center rounded-full text-sm font-black text-[#fffaf0] flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                {r.matchScore}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-[#172019]">{r.name}</p>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-black text-[#fffaf0]"
                    style={{ backgroundColor: color }}
                  >
                    {INTENT_LABELS[r.matchingIntent] ?? r.matchingIntent}
                  </span>
                </div>
                <p className="text-xs text-[#667064] mt-0.5">
                  {r.category}{r.neighborhood && ` · ${r.neighborhood}`}
                </p>
                {r.address && <p className="text-xs text-[#899083] mt-0.5">{r.address}</p>}
              </div>
            </div>

            <p className="mt-3 text-sm font-semibold text-[#536055] leading-6">{r.whyItFits}</p>

            <div className="mt-3 rounded-[1.1rem] bg-[#e8f0e7] p-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1f6b5d]">Your move</p>
              <p className="mt-1 text-sm font-black text-[#172019] leading-6">{r.suggestedMove}</p>
            </div>

            <button
              onClick={() => checkIn(r)}
              disabled={hasCheckedIn || checkingIn === r.poi_id}
              className={`mt-3 w-full rounded-2xl py-2.5 text-xs font-black transition ${
                hasCheckedIn
                  ? "bg-[#e8f0e7] text-[#1f6b5d]"
                  : "bg-[#172019] text-[#fffaf0] hover:bg-[#2b372e]"
              } disabled:opacity-60`}
            >
              {hasCheckedIn ? "✓ Checked in" : checkingIn === r.poi_id ? "Checking in..." : "Check in here"}
            </button>
          </article>
        );
      })}
    </div>
  );
}

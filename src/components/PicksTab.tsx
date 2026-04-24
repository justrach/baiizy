"use client";

import { useState, useCallback } from "react";

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
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [focusIntent, setFocusIntent] = useState<string | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());

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
        setLocation({ lat, lng });
        setLocationMsg(`✓ Location saved (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        setSharingLocation(false);
      },
      (err) => {
        setLocationMsg(`Location denied: ${err.message}`);
        setSharingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const fetchRecs = useCallback(async (intent?: string) => {
    setLoading(true);
    setError("");
    try {
      const url = intent ? `/api/recommendations?intent=${intent}` : "/api/recommendations";
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

  return (
    <div className="space-y-4">
      {/* Location + intent controls */}
      <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f]">Your location</p>
            <p className="text-sm font-bold text-[#172019] mt-1">
              {usingLive === null
                ? "Not fetched yet"
                : usingLive
                ? "Using live GPS"
                : "Using your onboarding neighborhood"}
              {location && <span className="text-[#667064] text-xs ml-2">({location.lat.toFixed(3)}, {location.lng.toFixed(3)})</span>}
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
              onClick={() => { setFocusIntent(i); fetchRecs(i ?? undefined); }}
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
            onClick={() => fetchRecs()}
            className="mt-4 w-full rounded-2xl bg-[#172019] py-3 text-sm font-black text-[#fffaf0] hover:bg-[#2b372e] transition"
          >
            🤖 Get AI recommendations
          </button>
        )}
      </div>

      {loading && (
        <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/70 p-8 text-center">
          <p className="font-semibold text-[#667064]">Asking the AI agent to find spots near you...</p>
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

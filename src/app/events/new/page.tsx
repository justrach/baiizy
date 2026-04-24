"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

type Venue = {
  poi_id: string;
  display: string;
  subtitle: string;
  latitude: number;
  longitude: number;
};

type Friend = {
  friendshipId: number;
  friendId: string;
  friendName: string;
  friendUsername: string | null;
  friendImage: string | null;
};

export default function NewEventPage() {
  const router = useRouter();
  const session = useSession();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venueQuery, setVenueQuery] = useState("");
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueResults, setVenueResults] = useState<Venue[]>([]);
  const [venueSearching, setVenueSearching] = useState(false);
  const [showVenueDropdown, setShowVenueDropdown] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const venueWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session.data?.user) return;
    fetch("/api/friends").then((r) => r.json()).then((data) => {
      setFriends(Array.isArray(data) ? data : []);
    });
    // Default date = tomorrow
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().slice(0, 10));
  }, [session.data?.user]);

  useEffect(() => {
    if (!venueQuery || venueQuery.length < 2 || (venue && venueQuery === venue.display)) {
      setVenueResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setVenueSearching(true);
      try {
        const res = await fetch(`/api/grab/autocomplete?q=${encodeURIComponent(venueQuery)}`);
        const data = await res.json();
        setVenueResults(data.results ?? []);
        setShowVenueDropdown(true);
      } finally { setVenueSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [venueQuery, venue]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (venueWrapperRef.current && !venueWrapperRef.current.contains(e.target as Node)) {
        setShowVenueDropdown(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pickVenue = (v: Venue) => {
    setVenue(v);
    setVenueQuery(v.display);
    setShowVenueDropdown(false);
  };

  const toggleInvite = (friendId: string) => {
    setInvited((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Title required");
    if (!venue) return setError("Pick a venue");
    if (!date) return setError("Date required");

    setSaving(true);
    const startsAt = new Date(`${date}T${time}:00`).toISOString();

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        venuePoiId: venue.poi_id,
        venueName: venue.display,
        venueAddress: venue.subtitle,
        venueCategory: null,
        venueLat: venue.latitude,
        venueLng: venue.longitude,
        startsAt,
        inviteUserIds: Array.from(invited),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Failed to create event");
    router.push(`/events/${data.event.id}`);
  };

  if (!session.data?.user) return null;

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <header className="sticky top-0 z-10 border-b border-[#1b271f]/10 bg-[#fffaf0]/90 backdrop-blur-md px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/events" className="text-sm font-black text-[#4b554c] hover:text-[#172019] transition">← Cancel</Link>
          <h1 className="text-sm font-black uppercase tracking-[0.24em] text-[#172019]">New event</h1>
          <div className="w-16" />
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-2xl px-5 py-8 space-y-6">
        {/* Title */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <label className="block text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f] mb-2">What&apos;s happening?</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Standing Wednesday lunch"
            className="w-full font-serif text-3xl font-black tracking-[-0.04em] text-[#172019] outline-none bg-transparent placeholder:text-[#8b958c]"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional: who is this for, why are we doing it?"
            rows={2}
            className="mt-4 w-full text-sm font-bold text-[#172019] outline-none bg-transparent placeholder:text-[#8b958c] resize-none border-t border-[#1b271f]/10 pt-4"
          />
        </section>

        {/* Venue */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <label className="block text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f] mb-2">Where?</label>
          <div ref={venueWrapperRef} className="relative">
            <input
              value={venueQuery}
              onChange={(e) => { setVenueQuery(e.target.value); setVenue(null); }}
              onFocus={() => { if (venueResults.length > 0) setShowVenueDropdown(true); }}
              placeholder="Search for a restaurant, cafe, park..."
              className="w-full rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#172019] outline-none focus:ring-2 focus:ring-[#d79c52]/40"
            />
            {venue && (
              <p className="mt-2 text-xs font-black text-[#1f6b5d]">
                ✓ Pinned: {venue.latitude.toFixed(4)}, {venue.longitude.toFixed(4)}
              </p>
            )}
            {showVenueDropdown && (venueResults.length > 0 || venueSearching) && (
              <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-2xl border border-[#1b271f]/15 bg-[#fffaf0] shadow-[0_24px_60px_rgba(44,37,24,0.18)] overflow-hidden max-h-72 overflow-y-auto">
                {venueSearching && <div className="px-4 py-3 text-xs font-semibold text-[#899083]">Searching...</div>}
                {venueResults.map((v) => (
                  <button
                    type="button"
                    key={v.poi_id}
                    onClick={() => pickVenue(v)}
                    className="w-full text-left px-4 py-3 hover:bg-[#eadfca]/50 transition border-b border-[#1b271f]/5 last:border-0"
                  >
                    <p className="font-black text-sm text-[#172019]">{v.display}</p>
                    {v.subtitle && <p className="text-xs text-[#667064] mt-0.5">{v.subtitle}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Date + Time */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <label className="block text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f] mb-2">When?</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#172019] outline-none focus:ring-2 focus:ring-[#d79c52]/40"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#172019] outline-none focus:ring-2 focus:ring-[#d79c52]/40"
            />
          </div>
        </section>

        {/* Invite friends */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <label className="block text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f] mb-2">
            Invite friends {invited.size > 0 && `(${invited.size})`}
          </label>
          {friends.length === 0 ? (
            <p className="text-sm font-semibold text-[#667064]">
              No friends yet. You can still create the event and invite them later.
            </p>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => {
                const sel = invited.has(f.friendId);
                return (
                  <button
                    type="button"
                    key={f.friendId}
                    onClick={() => toggleInvite(f.friendId)}
                    className={`w-full flex items-center gap-3 rounded-2xl border p-3 transition text-left ${
                      sel
                        ? "border-[#1f6b5d] bg-[#e8f0e7]"
                        : "border-[#1b271f]/10 bg-[#fffaf0] hover:border-[#172019]"
                    }`}
                  >
                    {f.friendImage ? (
                      <img src={f.friendImage} alt="" className="size-10 rounded-full object-cover" />
                    ) : (
                      <div className="size-10 rounded-full bg-[#b6522b] grid place-items-center text-xs font-black text-[#fffaf0]">
                        {f.friendName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-[#172019]">{f.friendName}</p>
                      {f.friendUsername && <p className="text-xs text-[#667064]">@{f.friendUsername}</p>}
                    </div>
                    {sel && <span className="text-[#1f6b5d] font-black">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {error && <div className="rounded-2xl bg-[#b6522b]/10 p-4 text-sm font-black text-[#8a3f38]">{error}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-[#172019] py-4 text-sm font-black text-[#fffaf0] transition hover:bg-[#2b372e] disabled:opacity-60"
        >
          {saving ? "Creating event..." : "Create event & send invites →"}
        </button>
      </form>
    </div>
  );
}

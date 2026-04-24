"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";

type Event = {
  id: number;
  title: string;
  description: string | null;
  venueName: string;
  venueAddress: string | null;
  venueCategory: string | null;
  startsAt: string;
  creatorId: string;
  creatorName: string;
  creatorImage: string | null;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function EventsPage() {
  const session = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session.data?.user) return;
    fetch("/api/events").then((r) => r.json()).then((data) => {
      setEvents(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [session.data?.user]);

  if (!session.data?.user) {
    return (
      <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center">
        <Link href="/login" className="rounded-2xl bg-[#172019] px-6 py-3 text-sm font-black text-[#fffaf0]">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <header className="sticky top-0 z-10 border-b border-[#1b271f]/10 bg-[#fffaf0]/90 backdrop-blur-md px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/users" className="flex items-center gap-2 text-sm font-black text-[#4b554c] hover:text-[#172019] transition">
            ← Back
          </Link>
          <h1 className="text-sm font-black uppercase tracking-[0.24em] text-[#172019]">Events</h1>
          <Link href="/events/new" className="rounded-2xl bg-[#172019] px-4 py-2 text-xs font-black text-[#fffaf0] hover:bg-[#2b372e] transition">
            + New
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {loading ? (
          <p className="text-center py-12 text-[#899083] font-semibold">Loading...</p>
        ) : events.length === 0 ? (
          <div className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/70 p-12 text-center">
            <h2 className="font-serif text-3xl font-black tracking-[-0.04em] text-[#172019]">No events yet</h2>
            <p className="text-sm font-semibold text-[#667064] mt-2 mb-6">
              Create your first event to invite friends somewhere real.
            </p>
            <Link href="/events/new" className="inline-block rounded-2xl bg-[#1f6b5d] px-6 py-3 text-sm font-black text-[#fffaf0] hover:bg-[#255f55] transition">
              Create an event
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((e) => {
              const isCreator = e.creatorId === session.data!.user.id;
              return (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="block rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur hover:shadow-[0_18px_60px_rgba(44,37,24,0.14)] transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b6522b]">{fmtDate(e.startsAt)}</p>
                      <h2 className="font-serif text-2xl font-black tracking-[-0.04em] text-[#172019] mt-1">{e.title}</h2>
                      <p className="text-sm font-bold text-[#536055] mt-2">📍 {e.venueName}</p>
                      {e.venueAddress && <p className="text-xs text-[#667064] mt-0.5">{e.venueAddress}</p>}
                      {e.description && <p className="text-sm font-semibold text-[#536055] mt-3 line-clamp-2">{e.description}</p>}
                    </div>
                    {isCreator && (
                      <span className="rounded-full bg-[#d79c52] px-2.5 py-1 text-xs font-black text-[#172019] flex-shrink-0">Host</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

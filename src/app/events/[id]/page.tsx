"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";

type Event = {
  id: number;
  title: string;
  description: string | null;
  venuePoiId: string;
  venueName: string;
  venueAddress: string | null;
  venueCategory: string | null;
  venueLat: number | null;
  venueLng: number | null;
  startsAt: string;
  creatorId: string;
  creatorName: string;
  creatorImage: string | null;
  creatorUsername: string | null;
};

type Invitee = {
  id: number;
  status: string;
  userId: string;
  name: string;
  username: string | null;
  email: string;
  image: string | null;
};

type Review = {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  userId: string;
  userName: string;
  userUsername: string | null;
  userImage: string | null;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function Avatar({ image, name, size = 40 }: { image: string | null; name: string; size?: number }) {
  if (image) return <img src={image} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div
      className="grid place-items-center rounded-full bg-[#b6522b] font-black text-[#fffaf0] flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      {initials}
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();

  const [data, setData] = useState<{
    event: Event;
    invitees: Invitee[];
    myStatus: string | null;
    isCreator: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [rsvping, setRsvping] = useState(false);

  const load = useCallback(async () => {
    const [eventRes, reviewRes] = await Promise.all([
      fetch(`/api/events/${params.id}`).then((r) => r.json()),
      fetch(`/api/events/${params.id}`).then((r) => r.json()).then((d) =>
        d.event ? fetch(`/api/reviews?poi_id=${encodeURIComponent(d.event.venuePoiId)}`).then((r) => r.json()) : null
      ),
    ]);
    if (eventRes.error) { setLoading(false); return; }
    setData(eventRes);
    if (reviewRes) {
      setReviews(reviewRes.reviews ?? []);
      setAvgRating(reviewRes.averageRating ?? null);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    if (session.data?.user) load();
  }, [session.data?.user, load]);

  const rsvp = async (status: "going" | "maybe" | "declined") => {
    setRsvping(true);
    await fetch(`/api/events/${params.id}/rsvp`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setRsvping(false);
  };

  const submitReview = async () => {
    if (!data) return;
    setSavingReview(true);
    await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poi_id: data.event.venuePoiId,
        venue_name: data.event.venueName,
        venue_category: data.event.venueCategory,
        rating: reviewRating,
        comment: reviewComment || undefined,
      }),
    });
    setReviewComment("");
    await load();
    setSavingReview(false);
  };

  if (!session.data?.user) {
    return (
      <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center">
        <Link href="/login" className="rounded-2xl bg-[#172019] px-6 py-3 text-sm font-black text-[#fffaf0]">Sign in</Link>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center text-[#899083] font-semibold">Loading...</div>;
  if (!data) return <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center text-[#8a3f38] font-black">Event not found</div>;

  const { event, invitees, myStatus, isCreator } = data;
  const goingCount = invitees.filter((i) => i.status === "going").length;
  const myExistingReview = reviews.find((r) => r.userId === session.data!.user.id);

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <header className="sticky top-0 z-10 border-b border-[#1b271f]/10 bg-[#fffaf0]/90 backdrop-blur-md px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/events" className="text-sm font-black text-[#4b554c] hover:text-[#172019] transition">← Events</Link>
          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8 space-y-6">
        {/* Header card */}
        <section className="rounded-[2rem] bg-[#172019] text-[#fffaf0] p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d79c52]">{fmtDate(event.startsAt)}</p>
          <h1 className="font-serif text-4xl font-black tracking-[-0.04em] mt-3">{event.title}</h1>
          {event.description && <p className="text-base font-semibold text-[#e9dfc8] leading-7 mt-4">{event.description}</p>}
          <div className="mt-5 flex items-center gap-2">
            <Avatar image={event.creatorImage} name={event.creatorName} size={28} />
            <p className="text-sm font-bold">
              Hosted by <span className="text-[#d7c9a8]">{event.creatorName}</span>
              {event.creatorUsername && <span className="text-[#d7c9a8]/60 ml-1">@{event.creatorUsername}</span>}
            </p>
          </div>
        </section>

        {/* Venue */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f]">Venue</p>
          <h2 className="font-serif text-2xl font-black tracking-[-0.04em] text-[#172019] mt-2">{event.venueName}</h2>
          {event.venueAddress && <p className="text-sm font-bold text-[#536055] mt-1">{event.venueAddress}</p>}
          {event.venueCategory && <p className="text-xs font-bold text-[#667064] mt-1">{event.venueCategory}</p>}
          {event.venueLat && event.venueLng && (
            <a
              href={`https://maps.google.com/?q=${event.venueLat},${event.venueLng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs font-black text-[#1f6b5d] hover:underline"
            >
              Open in maps →
            </a>
          )}
          {avgRating !== null && (
            <div className="mt-4 pt-4 border-t border-[#1b271f]/10 flex items-center gap-3">
              <span className="text-2xl font-black text-[#172019]">{avgRating.toFixed(1)}</span>
              <span className="text-[#d79c52]">{"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}</span>
              <span className="text-xs font-bold text-[#667064]">{reviews.length} review{reviews.length === 1 ? "" : "s"}</span>
            </div>
          )}
        </section>

        {/* RSVP */}
        {!isCreator && (
          <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f] mb-3">
              {myStatus ? `You're ${myStatus}` : "Will you be there?"}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["going", "maybe", "declined"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => rsvp(s)}
                  disabled={rsvping}
                  className={`rounded-2xl py-3 text-sm font-black transition disabled:opacity-60 ${
                    myStatus === s
                      ? s === "going" ? "bg-[#1f6b5d] text-[#fffaf0]"
                      : s === "maybe" ? "bg-[#d79c52] text-[#172019]"
                      : "bg-[#8a3f38] text-[#fffaf0]"
                      : "border border-[#1b271f]/10 bg-[#fffaf0] text-[#4b554c] hover:border-[#172019]"
                  }`}
                >
                  {s === "going" ? "✓ Going" : s === "maybe" ? "Maybe" : "Can't make it"}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Invitees */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f] mb-4">
            {goingCount} going · {invitees.length} invited
          </p>
          {invitees.length === 0 ? (
            <p className="text-sm font-semibold text-[#667064]">No one invited yet.</p>
          ) : (
            <div className="space-y-2">
              {invitees.map((i) => (
                <div key={i.id} className="flex items-center gap-3">
                  <Avatar image={i.image} name={i.name} size={36} />
                  <div className="flex-1">
                    <p className="font-black text-sm text-[#172019]">{i.name}</p>
                    {i.username && <p className="text-xs text-[#667064]">@{i.username}</p>}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                    i.status === "going" ? "bg-[#e8f0e7] text-[#1f6b5d]" :
                    i.status === "maybe" ? "bg-[#d79c52]/20 text-[#8a6d2f]" :
                    i.status === "declined" ? "bg-[#b6522b]/10 text-[#8a3f38]" :
                    "bg-[#eadfca] text-[#667064]"
                  }`}>
                    {i.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f] mb-4">Reviews of this venue</p>

          {/* Write review */}
          <div className="rounded-2xl bg-[#eadfca]/40 p-4 mb-4">
            <p className="text-sm font-black text-[#172019] mb-2">
              {myExistingReview ? "Update your review" : "Leave a review"}
            </p>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReviewRating(n)}
                  className={`text-3xl transition ${n <= reviewRating ? "text-[#d79c52]" : "text-[#d8ccb6]"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder={myExistingReview?.comment ?? "What did you think?"}
              rows={2}
              className="w-full rounded-xl bg-[#fffaf0] border border-[#1b271f]/10 px-3 py-2 text-sm font-bold text-[#172019] outline-none focus:ring-2 focus:ring-[#d79c52]/40 resize-none"
            />
            <button
              onClick={submitReview}
              disabled={savingReview}
              className="mt-2 rounded-2xl bg-[#172019] px-5 py-2 text-xs font-black text-[#fffaf0] hover:bg-[#2b372e] transition disabled:opacity-60"
            >
              {savingReview ? "Saving..." : myExistingReview ? "Update review" : "Post review"}
            </button>
          </div>

          {reviews.length === 0 ? (
            <p className="text-sm font-semibold text-[#667064]">Be the first to review this spot.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="flex gap-3">
                  <Avatar image={r.userImage} name={r.userName} size={36} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm text-[#172019]">{r.userName}</p>
                      <span className="text-[#d79c52]">{"★".repeat(r.rating)}</span>
                    </div>
                    {r.comment && <p className="text-sm font-semibold text-[#536055] mt-1 leading-6">{r.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

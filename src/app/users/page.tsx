"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";

type Profile = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
};

type Friend = {
  friendshipId: number;
  friendId: string;
  friendName: string;
  friendEmail: string;
  friendUsername: string | null;
  friendImage: string | null;
  friendIntents: string[] | null;
  friendSocialMode: string | null;
  friendAvailability: string[] | null;
  friendBio: string | null;
};

type FriendRequest = {
  id: number;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterUsername: string | null;
  requesterImage: string | null;
  createdAt: string;
};

type Suggestion = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  intents: string[] | null;
  social_mode: string | null;
  bio: string | null;
  match_score: number;
};

type SearchResult = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
};

const INTENT_LABELS: Record<string, string> = {
  work: "Deep work",
  supper: "Late supper",
  date: "Low-pressure date",
  lunch: "Office lunch",
  friend: "Friend hangs",
};

const COLORS = ["#1f6b5d", "#8a6d2f", "#b6522b", "#2f607f", "#8a3f38", "#c7812f"];
const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

function Avatar({ image, name, size = 48, id }: { image: string | null; name: string; size?: number; id: string }) {
  const color = COLORS[id.charCodeAt(0) % COLORS.length];
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="grid place-items-center rounded-full font-black text-[#fffaf0] flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.32 }}
    >
      {initials(name)}
    </div>
  );
}

export default function UsersPage() {
  const session = useSession();
  const user = session.data?.user;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"suggested" | "friends" | "requests" | "find">("suggested");
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [fr, rq, sg, pr] = await Promise.all([
      fetch("/api/friends").then((r) => r.json()).catch(() => []),
      fetch("/api/friends/requests").then((r) => r.json()).catch(() => []),
      fetch("/api/friends/suggestions").then((r) => r.json()).catch(() => []),
      fetch("/api/user/profile").then((r) => r.json()).catch(() => null),
    ]);
    setFriends(Array.isArray(fr) ? fr : []);
    setRequests(Array.isArray(rq) ? rq : []);
    setSuggestions(Array.isArray(sg) ? sg : []);
    setProfile(pr);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) loadAll();
  }, [user, loadAll]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!searchEmail || searchEmail.length < 2) { setSearchResults([]); return; }
      setSearching(true);
      const res = await fetch(`/api/users/search?email=${encodeURIComponent(searchEmail)}`);
      setSearchResults(await res.json());
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchEmail]);

  const sendRequest = async (addresseeEmail: string) => {
    setSending(addresseeEmail);
    await fetch("/api/friends", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresseeEmail }),
    });
    setSent((prev) => new Set(prev).add(addresseeEmail));
    setSending(null);
    loadAll();
  };

  const respondToRequest = async (id: number, status: "accepted" | "declined") => {
    await fetch(`/api/friends/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadAll();
  };

  const removeFriend = async (id: number) => {
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    loadAll();
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center">
        <div className="text-center">
          <p className="font-black text-[#172019] text-lg mb-4">Sign in to see your friends</p>
          <Link href="/login" className="rounded-2xl bg-[#172019] px-6 py-3 text-sm font-black text-[#fffaf0]">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <header className="sticky top-0 z-10 border-b border-[#1b271f]/10 bg-[#fffaf0]/90 backdrop-blur-md px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#172019] text-sm font-black text-[#fff6df]">B</span>
            <span className="text-sm font-black uppercase tracking-[0.24em] text-[#172019]">Baiizy</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="rounded-2xl border border-[#1b271f]/10 px-4 py-2 text-xs font-black text-[#4b554c] hover:border-[#172019] hover:text-[#172019] transition"
            >
              Settings
            </Link>
            <Link href="/settings">
              <Avatar image={profile.image} name={profile.name} size={36} id={profile.id} />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {/* Profile card */}
        <div className="rounded-[2rem] bg-[#172019] p-6 text-[#fffaf0] mb-6">
          <div className="flex items-start gap-4">
            <Avatar image={profile.image} name={profile.name} size={64} id={profile.id} />
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-2xl font-black tracking-[-0.04em]">{profile.name}</h1>
              {profile.username && <p className="text-sm text-[#d7c9a8]">@{profile.username}</p>}
              <p className="text-xs text-[#d7c9a8]/70 mt-1">{profile.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/settings" className="rounded-full bg-[#d79c52] px-3 py-1 text-xs font-black text-[#172019]">
                  Settings & photo
                </Link>
                <Link href="/onboarding" className="rounded-full bg-[#fffaf0]/10 px-3 py-1 text-xs font-black text-[#fffaf0]">
                  Edit preferences
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0]/70 p-1 mb-6 overflow-x-auto">
          {(["suggested", "friends", "requests", "find"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 min-w-fit rounded-xl px-3 py-2.5 text-sm font-black transition whitespace-nowrap ${
                tab === t ? "bg-[#172019] text-[#fffaf0]" : "text-[#4b554c] hover:text-[#172019]"
              }`}
            >
              {t === "suggested" && "✨ Suggested"}
              {t === "friends" && `Friends (${friends.length})`}
              {t === "requests" && `Requests${requests.length > 0 ? ` (${requests.length})` : ""}`}
              {t === "find" && "Find"}
            </button>
          ))}
        </div>

        {tab === "suggested" && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#536055] mb-4">
              People with similar preferences, ranked by match.
            </p>
            {loading ? (
              <div className="text-center py-12 text-[#899083] font-semibold">Finding people...</div>
            ) : suggestions.length === 0 ? (
              <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/70 p-8 text-center">
                <p className="font-black text-[#172019] text-lg">No matches yet</p>
                <p className="text-sm font-semibold text-[#667064] mt-2">
                  Once more people complete onboarding, we&apos;ll suggest matches.
                </p>
              </div>
            ) : (
              suggestions.map((s) => {
                const matchPct = Math.round(s.match_score * 100);
                const alreadySent = sent.has(s.email);
                return (
                  <div key={s.id} className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-start gap-4">
                      <Avatar image={s.image} name={s.name} size={48} id={s.id} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-[#172019]">{s.name}</p>
                          {s.username && <p className="text-xs font-bold text-[#667064]">@{s.username}</p>}
                          <span className="rounded-full bg-[#d79c52] px-2.5 py-0.5 text-xs font-black text-[#172019]">
                            {matchPct}% match
                          </span>
                        </div>
                        {s.bio && <p className="text-sm font-semibold text-[#536055] mt-2">{s.bio}</p>}
                        {s.intents && s.intents.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {s.intents.map((intent) => (
                              <span key={intent} className="rounded-full bg-[#e8f0e7] px-2.5 py-0.5 text-xs font-black text-[#1f6b5d]">
                                {INTENT_LABELS[intent] ?? intent}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => sendRequest(s.email)}
                        disabled={alreadySent || sending === s.email}
                        className={`rounded-2xl px-4 py-2 text-xs font-black transition flex-shrink-0 ${
                          alreadySent ? "bg-[#e8f0e7] text-[#1f6b5d]" : "bg-[#172019] text-[#fffaf0] hover:bg-[#2b372e]"
                        } disabled:opacity-60`}
                      >
                        {alreadySent ? "Sent ✓" : sending === s.email ? "..." : "Add"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "friends" && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12 text-[#899083] font-semibold">Loading...</div>
            ) : friends.length === 0 ? (
              <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/70 p-8 text-center">
                <p className="font-black text-[#172019] text-lg">No friends yet</p>
                <p className="text-sm font-semibold text-[#667064] mt-2">Check <strong>Suggested</strong>.</p>
              </div>
            ) : (
              friends.map((f) => (
                <div key={f.friendshipId} className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-5 shadow-sm backdrop-blur">
                  <div className="flex items-start gap-4">
                    <Avatar image={f.friendImage} name={f.friendName} size={48} id={f.friendId} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-[#172019]">{f.friendName}</p>
                        {f.friendUsername && <p className="text-xs font-bold text-[#667064]">@{f.friendUsername}</p>}
                      </div>
                      <p className="text-xs text-[#667064] mt-0.5">{f.friendEmail}</p>
                      {f.friendBio && <p className="text-sm font-semibold text-[#536055] mt-2">{f.friendBio}</p>}
                      {f.friendIntents && f.friendIntents.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {f.friendIntents.map((intent) => (
                            <span key={intent} className="rounded-full bg-[#e8f0e7] px-2.5 py-0.5 text-xs font-black text-[#1f6b5d]">
                              {INTENT_LABELS[intent] ?? intent}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeFriend(f.friendshipId)} className="text-xs font-black text-[#899083] hover:text-[#b6522b] transition flex-shrink-0">
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "requests" && (
          <div className="space-y-3">
            {requests.length === 0 ? (
              <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/70 p-8 text-center">
                <p className="font-semibold text-[#667064]">No pending requests</p>
              </div>
            ) : (
              requests.map((req) => (
                <div key={req.id} className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-5 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-4">
                    <Avatar image={req.requesterImage} name={req.requesterName} size={48} id={req.requesterId} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-[#172019]">{req.requesterName}</p>
                        {req.requesterUsername && <p className="text-xs font-bold text-[#667064]">@{req.requesterUsername}</p>}
                      </div>
                      <p className="text-xs text-[#667064]">{req.requesterEmail}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => respondToRequest(req.id, "accepted")} className="rounded-2xl bg-[#1f6b5d] px-4 py-2 text-xs font-black text-[#fffaf0] hover:bg-[#255f55] transition">
                        Accept
                      </button>
                      <button onClick={() => respondToRequest(req.id, "declined")} className="rounded-2xl border border-[#1b271f]/10 px-4 py-2 text-xs font-black text-[#4b554c] hover:border-[#b6522b] hover:text-[#b6522b] transition">
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "find" && (
          <div>
            <div className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-1 shadow-sm backdrop-blur mb-4">
              <input
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Search by email, username, or name..."
                className="w-full rounded-[1.2rem] bg-transparent px-4 py-3 text-sm font-bold text-[#172019] outline-none placeholder:text-[#899083]"
              />
            </div>
            {searching && <p className="text-sm font-semibold text-[#899083] text-center py-4">Searching...</p>}
            <div className="space-y-3">
              {searchResults.map((result) => {
                const alreadySent = sent.has(result.email);
                const alreadyFriend = friends.some((f) => f.friendId === result.id);
                return (
                  <div key={result.id} className="rounded-[1.5rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-4 shadow-sm backdrop-blur flex items-center gap-4">
                    <Avatar image={result.image} name={result.name} size={44} id={result.id} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-[#172019]">{result.name}</p>
                        {result.username && <p className="text-xs font-bold text-[#667064]">@{result.username}</p>}
                      </div>
                      <p className="text-xs text-[#667064]">{result.email}</p>
                    </div>
                    {alreadyFriend ? (
                      <span className="text-xs font-black text-[#1f6b5d]">Friends ✓</span>
                    ) : (
                      <button
                        onClick={() => sendRequest(result.email)}
                        disabled={alreadySent || sending === result.email}
                        className={`rounded-2xl px-4 py-2 text-xs font-black transition ${
                          alreadySent ? "bg-[#e8f0e7] text-[#1f6b5d]" : "bg-[#172019] text-[#fffaf0] hover:bg-[#2b372e]"
                        } disabled:opacity-60`}
                      >
                        {alreadySent ? "Sent ✓" : sending === result.email ? "..." : "Add"}
                      </button>
                    )}
                  </div>
                );
              })}
              {!searching && searchEmail.length >= 2 && searchResults.length === 0 && (
                <p className="text-sm font-semibold text-[#899083] text-center py-4">No users found</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

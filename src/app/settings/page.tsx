"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "@/lib/auth-client";

type Profile = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
};

const COLORS = ["#1f6b5d", "#8a6d2f", "#b6522b", "#2f607f", "#8a3f38", "#c7812f"];
const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

export default function SettingsPage() {
  const session = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [savingName, setSavingName] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [nameMsg, setNameMsg] = useState("");
  const [usernameMsg, setUsernameMsg] = useState("");

  const loadProfile = async () => {
    const data = await fetch("/api/user/profile").then((r) => r.json());
    setProfile(data);
    setName(data?.name ?? "");
    setUsername(data?.username ?? "");
  };

  useEffect(() => {
    if (session.data?.user) loadProfile();
  }, [session.data?.user]);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadMsg({ type: "err", text: "File too large (max 5 MB)" });
      return;
    }

    setUploading(true);
    setUploadMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/user/avatar", { method: "POST", body: form });
    const data = await res.json();
    if (res.ok) {
      setUploadMsg({ type: "ok", text: "Photo updated" });
      await loadProfile();
    } else {
      setUploadMsg({ type: "err", text: data.error ?? "Upload failed" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveName = async () => {
    setSavingName(true);
    setNameMsg("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setNameMsg("Saved");
      await loadProfile();
      setTimeout(() => setNameMsg(""), 2000);
    }
    setSavingName(false);
  };

  const saveUsername = async () => {
    setSavingUsername(true);
    setUsernameError("");
    setUsernameMsg("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (res.ok) {
      setUsernameMsg("Saved");
      await loadProfile();
      setTimeout(() => setUsernameMsg(""), 2000);
    } else {
      setUsernameError(data.error ?? "Failed");
    }
    setSavingUsername(false);
  };

  if (!session.data?.user) {
    return (
      <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center">
        <Link href="/login" className="rounded-2xl bg-[#172019] px-6 py-3 text-sm font-black text-[#fffaf0]">
          Sign in
        </Link>
      </div>
    );
  }

  if (!profile) {
    return <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center text-[#899083] font-semibold">Loading...</div>;
  }

  const color = COLORS[profile.id.charCodeAt(0) % COLORS.length];

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <header className="sticky top-0 z-10 border-b border-[#1b271f]/10 bg-[#fffaf0]/90 backdrop-blur-md px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/users" className="flex items-center gap-2 text-sm font-black text-[#4b554c] hover:text-[#172019] transition">
            ← Back
          </Link>
          <h1 className="text-sm font-black uppercase tracking-[0.24em] text-[#172019]">Settings</h1>
          <div className="w-12" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8 space-y-6">
        {/* Photo section */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <h2 className="font-serif text-2xl font-black tracking-[-0.04em] text-[#172019] mb-1">Profile photo</h2>
          <p className="text-sm font-semibold text-[#667064] mb-6">JPEG, PNG, WebP, or GIF. Up to 5 MB.</p>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative flex-shrink-0">
              {profile.image ? (
                <img
                  src={profile.image}
                  alt={profile.name}
                  className="size-32 rounded-full object-cover border-4 border-[#fffaf0] shadow-[0_14px_40px_rgba(23,32,25,0.18)]"
                />
              ) : (
                <div
                  className="size-32 rounded-full grid place-items-center text-3xl font-black text-[#fffaf0] border-4 border-[#fffaf0] shadow-[0_14px_40px_rgba(23,32,25,0.18)]"
                  style={{ backgroundColor: color }}
                >
                  {initials(profile.name)}
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/60 grid place-items-center text-[#fffaf0] text-xs font-black">
                  Uploading...
                </div>
              )}
            </div>

            <div className="flex-1 w-full">
              <button
                onClick={onPickFile}
                disabled={uploading}
                className="w-full sm:w-auto rounded-2xl bg-[#172019] px-6 py-3 text-sm font-black text-[#fffaf0] transition hover:bg-[#2b372e] disabled:opacity-60"
              >
                {profile.image ? "Change photo" : "Upload photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onFileChange}
              />
              {uploadMsg && (
                <p className={`mt-3 text-sm font-black ${uploadMsg.type === "ok" ? "text-[#1f6b5d]" : "text-[#8a3f38]"}`}>
                  {uploadMsg.type === "ok" ? "✓ " : ""}{uploadMsg.text}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Name section */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <h2 className="font-serif text-2xl font-black tracking-[-0.04em] text-[#172019] mb-1">Display name</h2>
          <p className="text-sm font-semibold text-[#667064] mb-4">What friends see when you show up in their suggestions.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#172019] outline-none focus:ring-2 focus:ring-[#d79c52]/40"
            />
            <button
              onClick={saveName}
              disabled={savingName || name.trim().length === 0 || name === profile.name}
              className="rounded-2xl bg-[#172019] px-6 py-3 text-sm font-black text-[#fffaf0] transition hover:bg-[#2b372e] disabled:opacity-40"
            >
              {savingName ? "Saving..." : "Save"}
            </button>
          </div>
          {nameMsg && <p className="mt-2 text-sm font-black text-[#1f6b5d]">✓ {nameMsg}</p>}
        </section>

        {/* Username section */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <h2 className="font-serif text-2xl font-black tracking-[-0.04em] text-[#172019] mb-1">Username</h2>
          <p className="text-sm font-semibold text-[#667064] mb-4">
            3-20 characters: lowercase letters, numbers, underscore. Must be unique.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-4 focus-within:ring-2 focus-within:ring-[#d79c52]/40">
              <span className="text-sm font-black text-[#899083]">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="yourhandle"
                className="flex-1 bg-transparent py-3 pl-1 text-sm font-bold text-[#172019] outline-none placeholder:text-[#899083]"
              />
            </div>
            <button
              onClick={saveUsername}
              disabled={savingUsername || username.length < 3 || username === profile.username}
              className="rounded-2xl bg-[#172019] px-6 py-3 text-sm font-black text-[#fffaf0] transition hover:bg-[#2b372e] disabled:opacity-40"
            >
              {savingUsername ? "Saving..." : "Save"}
            </button>
          </div>
          {usernameError && <p className="mt-2 text-sm font-black text-[#8a3f38]">{usernameError}</p>}
          {usernameMsg && <p className="mt-2 text-sm font-black text-[#1f6b5d]">✓ {usernameMsg}</p>}
        </section>

        {/* Read-only info */}
        <section className="rounded-[2rem] border border-[#1b271f]/10 bg-[#fffaf0]/82 p-6 shadow-sm backdrop-blur">
          <h2 className="font-serif text-2xl font-black tracking-[-0.04em] text-[#172019] mb-4">Account</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6d2f]">Email</p>
                <p className="font-bold text-[#172019] mt-1">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6d2f]">Preferences</p>
                <p className="text-sm font-semibold text-[#536055] mt-1">What brings you out, social style, availability</p>
              </div>
              <Link
                href="/onboarding"
                className="rounded-2xl border border-[#172019]/20 px-4 py-2 text-xs font-black text-[#172019] hover:bg-[#172019] hover:text-[#fffaf0] transition"
              >
                Edit
              </Link>
            </div>
          </div>
        </section>

        {/* Sign out */}
        <section className="rounded-[2rem] border border-[#b6522b]/20 bg-[#fffaf0]/60 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-[#172019]">Sign out</h2>
              <p className="text-sm font-semibold text-[#667064] mt-1">You&apos;ll need to log in again to see your friends.</p>
            </div>
            <button
              onClick={() => signOut().then(() => router.push("/login"))}
              className="rounded-2xl bg-[#8a3f38] px-5 py-3 text-sm font-black text-[#fffaf0] transition hover:bg-[#6e322d] flex-shrink-0"
            >
              Sign out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

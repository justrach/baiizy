"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, signUp } from "@/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/users";

  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "in") {
      const res = await signIn.email({ email, password, callbackURL: next });
      if (res.error) setError(res.error.message ?? "Sign in failed");
      else router.push(next);
    } else {
      const res = await signUp.email({ name, email, password, callbackURL: "/onboarding" });
      if (res.error) setError(res.error.message ?? "Sign up failed");
      else router.push("/onboarding");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-3 mb-10">
          <span className="grid size-10 place-items-center rounded-full bg-[#172019] text-sm font-black text-[#fff6df]">B</span>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#172019]">Baiizy</p>
            <p className="text-xs font-semibold text-[#667064]">intent-aware places</p>
          </div>
        </Link>

        <div className="rounded-[2rem] border border-[#1b271f]/10 bg-white/70 p-6 shadow-[0_18px_70px_rgba(44,37,24,0.1)] backdrop-blur">
          {/* Mode toggle */}
          <div className="flex gap-1 rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] p-1 mb-6">
            <button
              onClick={() => setMode("in")}
              className={`flex-1 rounded-xl py-2 text-sm font-black transition ${mode === "in" ? "bg-[#172019] text-[#fffaf0]" : "text-[#4b554c]"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode("up")}
              className={`flex-1 rounded-xl py-2 text-sm font-black transition ${mode === "up" ? "bg-[#172019] text-[#fffaf0]" : "text-[#4b554c]"}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handle} className="space-y-3">
            {mode === "up" && (
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#172019] outline-none focus:ring-2 focus:ring-[#d79c52]/40"
              />
            )}
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#172019] outline-none focus:ring-2 focus:ring-[#d79c52]/40"
            />
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (6+ characters)"
              minLength={6}
              className="w-full rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#172019] outline-none focus:ring-2 focus:ring-[#d79c52]/40"
            />

            {error && (
              <p className="rounded-2xl bg-[#b6522b]/10 px-4 py-3 text-sm font-black text-[#8a3f38]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#172019] py-3 text-sm font-black text-[#fffaf0] transition hover:bg-[#2b372e] disabled:opacity-60"
            >
              {loading ? "..." : mode === "in" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs font-semibold text-[#899083] mt-4">
          <Link href="/maps" className="hover:text-[#172019] transition">
            Continue without account →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center px-5 py-12">
          <div className="rounded-[2rem] border border-[#1b271f]/10 bg-white/70 p-6 text-sm font-black text-[#172019] shadow-[0_18px_70px_rgba(44,37,24,0.1)]">
            Loading sign in...
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

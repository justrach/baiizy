"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type IntentKey = "work" | "supper" | "date" | "lunch" | "friend";

type Suggestion = {
  poi_id: string;
  display: string;
  subtitle: string;
  latitude: number;
  longitude: number;
};

const INTENTS: { key: IntentKey; label: string; emoji: string; detail: string }[] = [
  { key: "work", label: "Deep work", emoji: "💻", detail: "Quiet cafes, focus sprints, standing desks" },
  { key: "lunch", label: "Office lunch", emoji: "🥗", detail: "Quick, cheap, repeatable with colleagues" },
  { key: "supper", label: "Late supper", emoji: "🍜", detail: "After-work noodles, no planning required" },
  { key: "date", label: "Low-pressure dates", emoji: "🌿", detail: "One drink, graceful exits, optional second stop" },
  { key: "friend", label: "Friend hangs", emoji: "📚", detail: "Bookshops, craft tables, Sunday walks" },
];

const SOCIAL_MODES = [
  { value: "solo-friendly", label: "Side by side", detail: "I like being near people while doing my own thing" },
  { value: "small-group", label: "Intimate groups", detail: "Two to four people, real conversation" },
  { value: "flexible", label: "Flexible", detail: "Depends on the day — I can do either" },
];

const AVAILABILITY = [
  { value: "weekday-morning", label: "Weekday mornings" },
  { value: "weekday-lunch", label: "Weekday lunch" },
  { value: "weekday-evening", label: "Weekday evenings" },
  { value: "weekend-morning", label: "Weekend mornings" },
  { value: "weekend-afternoon", label: "Weekend afternoons" },
  { value: "late-night", label: "Late nights" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [intents, setIntents] = useState<IntentKey[]>([]);
  const [socialMode, setSocialMode] = useState("flexible");
  const [availability, setAvailability] = useState<string[]>([]);
  const [neighborhoodQuery, setNeighborhoodQuery] = useState("");
  const [neighborhood, setNeighborhood] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const toggleIntent = (key: IntentKey) =>
    setIntents((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const toggleAvailability = (val: string) =>
    setAvailability((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);

  // Debounced autocomplete
  useEffect(() => {
    if (!neighborhoodQuery || neighborhoodQuery.length < 2) {
      return;
    }
    // Don't search again once a suggestion is selected and the query matches
    if (neighborhood && neighborhoodQuery === neighborhood.display) {
      return;
    }

    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/grab/autocomplete?q=${encodeURIComponent(neighborhoodQuery)}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setShowDropdown(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [neighborhoodQuery, neighborhood]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pickSuggestion = (s: Suggestion) => {
    setNeighborhood(s);
    setNeighborhoodQuery(s.display);
    setShowDropdown(false);
    setSuggestions([]);
  };

  const handleFinish = async () => {
    setSaving(true);
    await fetch("/api/user/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intents,
        socialMode,
        availability,
        neighborhood: neighborhood?.display ?? neighborhoodQuery ?? null,
        neighborhoodLat: neighborhood?.latitude,
        neighborhoodLng: neighborhood?.longitude,
        neighborhoodPoiId: neighborhood?.poi_id,
        bio,
      }),
    });
    router.push("/users");
  };

  const steps = ["What brings you out?", "Your social style", "When are you free?", "A little about you"];
  const totalSteps = steps.length;

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-10">
          <span className="grid size-10 place-items-center rounded-full bg-[#172019] text-sm font-black text-[#fff6df]">B</span>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#172019]">Baiizy</p>
            <p className="text-xs font-semibold text-[#667064]">let&apos;s set you up</p>
          </div>
        </div>

        <div className="flex gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= step ? "bg-[#172019]" : "bg-[#d8ccb6]"}`}
            />
          ))}
        </div>

        <div className="rounded-[2rem] border border-[#1b271f]/10 bg-white/70 p-6 shadow-[0_18px_70px_rgba(44,37,24,0.1)] backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#b6522b] mb-3">
            Step {step + 1} of {totalSteps}
          </p>
          <h1 className="font-serif text-3xl font-black tracking-[-0.05em] text-[#172019] mb-6">
            {steps[step]}
          </h1>

          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#536055] mb-4">Pick everything that sounds like you.</p>
              {INTENTS.map((intent) => {
                const active = intents.includes(intent.key);
                return (
                  <button
                    key={intent.key}
                    onClick={() => toggleIntent(intent.key)}
                    className={`w-full flex items-start gap-4 rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-[#172019] bg-[#172019] text-[#fffaf0]"
                        : "border-[#1b271f]/10 bg-[#fffaf0]/60 text-[#172019] hover:border-[#b6522b]"
                    }`}
                  >
                    <span className="text-2xl">{intent.emoji}</span>
                    <div>
                      <p className="font-black">{intent.label}</p>
                      <p className={`text-sm font-semibold ${active ? "text-[#d7c9a8]" : "text-[#667064]"}`}>
                        {intent.detail}
                      </p>
                    </div>
                    {active && <span className="ml-auto text-[#d79c52] font-black">✓</span>}
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#536055] mb-4">How do you usually like to hang?</p>
              {SOCIAL_MODES.map((mode) => {
                const active = socialMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    onClick={() => setSocialMode(mode.value)}
                    className={`w-full flex items-start gap-4 rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-[#1f6b5d] bg-[#1f6b5d] text-[#fffaf0]"
                        : "border-[#1b271f]/10 bg-[#fffaf0]/60 text-[#172019] hover:border-[#1f6b5d]"
                    }`}
                  >
                    <div>
                      <p className="font-black">{mode.label}</p>
                      <p className={`text-sm font-semibold ${active ? "text-[#d7c9a8]" : "text-[#667064]"}`}>
                        {mode.detail}
                      </p>
                    </div>
                    {active && <span className="ml-auto text-[#d79c52] font-black">✓</span>}
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm font-semibold text-[#536055] mb-4">Select all that apply — this helps friends find you.</p>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABILITY.map((slot) => {
                  const active = availability.includes(slot.value);
                  return (
                    <button
                      key={slot.value}
                      onClick={() => toggleAvailability(slot.value)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-black text-left transition ${
                        active
                          ? "border-[#d79c52] bg-[#d79c52] text-[#172019]"
                          : "border-[#1b271f]/10 bg-[#fffaf0]/60 text-[#4b554c] hover:border-[#d79c52]"
                      }`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div ref={wrapperRef} className="relative">
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f] mb-2">
                  Your neighborhood (optional)
                </label>
                <input
                  value={neighborhoodQuery}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setNeighborhoodQuery(nextValue);
                    setNeighborhood(null); // clear pin when user types
                    if (nextValue.length < 2) {
                      setSuggestions([]);
                      setShowDropdown(false);
                    }
                  }}
                  onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                  placeholder="e.g. Tiong Bahru, Marina Bay, Orchard"
                  className="w-full rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#172019] outline-none focus:ring-2 focus:ring-[#d79c52]/40"
                />

                {neighborhood && (
                  <p className="mt-2 text-xs font-black text-[#1f6b5d]">
                    ✓ Pinned at {neighborhood.latitude.toFixed(4)}, {neighborhood.longitude.toFixed(4)}
                  </p>
                )}

                {showDropdown && (suggestions.length > 0 || searching) && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-2xl border border-[#1b271f]/15 bg-[#fffaf0] shadow-[0_24px_60px_rgba(44,37,24,0.18)] overflow-hidden max-h-72 overflow-y-auto">
                    {searching && (
                      <div className="px-4 py-3 text-xs font-semibold text-[#899083]">Searching...</div>
                    )}
                    {suggestions.map((s) => (
                      <button
                        key={s.poi_id}
                        type="button"
                        onClick={() => pickSuggestion(s)}
                        className="w-full text-left px-4 py-3 hover:bg-[#eadfca]/50 transition border-b border-[#1b271f]/5 last:border-0"
                      >
                        <p className="font-black text-sm text-[#172019]">{s.display}</p>
                        {s.subtitle && <p className="text-xs text-[#667064] mt-0.5">{s.subtitle}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f] mb-2">
                  One line about you (optional)
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Designer who needs a standing lunch crew and hates making plans"
                  rows={3}
                  className="w-full rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#172019] outline-none focus:ring-2 focus:ring-[#d79c52]/40 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] px-5 py-3 text-sm font-black text-[#4b554c] transition hover:border-[#172019]"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && intents.length === 0}
              className="rounded-2xl bg-[#172019] px-6 py-3 text-sm font-black text-[#fffaf0] transition hover:bg-[#2b372e] disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="rounded-2xl bg-[#1f6b5d] px-6 py-3 text-sm font-black text-[#fffaf0] transition hover:bg-[#255f55] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Finish setup →"}
            </button>
          )}
        </div>

        <p className="text-center text-xs font-semibold text-[#899083] mt-6">
          You can update these anytime from your profile.
        </p>
      </div>
    </div>
  );
}

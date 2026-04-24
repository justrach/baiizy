import { generateObject, tool } from "ai";
import { z } from "zod";


type Place = {
  poi_id: string;
  name: string;
  address: string;
  category: string;
  lat?: number | null;
  lng?: number | null;
  neighborhood?: string | null;
  distance?: number | null;
};

async function searchGrab(keyword: string, lat: number, lng: number, limit = 6): Promise<Place[]> {
  const apiKey = process.env.GRAB_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("[agent] GRAB_MAPS_API_KEY missing");
    return [];
  }

  const q = new URLSearchParams({ keyword, country: "SGP", location: `${lat},${lng}`, limit: String(limit) });
  const url = `https://maps.grab.com/api/v1/maps/poi/v1/search?${q}`;
  console.log(`[agent] Grab search: keyword="${keyword}" loc=${lat},${lng}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[agent] Grab ${res.status}: ${text.slice(0, 200)}`);
      return [];
    }

    const data = (await res.json()) as { places?: Array<Record<string, unknown>> };
    console.log(`[agent] Grab "${keyword}" returned ${data.places?.length ?? 0} places`);
    return (data.places ?? []).map((p) => {
      const loc = p.location as { latitude?: number; longitude?: number } | undefined;
      const admin = (p.administrative_areas ?? []) as { type: string; name: string }[];
      return {
        poi_id: String(p.poi_id),
        name: String(p.name ?? ""),
        address: String(p.formatted_address ?? ""),
        category: String(p.category ?? p.business_type ?? ""),
        lat: loc?.latitude ?? null,
        lng: loc?.longitude ?? null,
        neighborhood: admin.find((a) => a.type === "Neighborhood")?.name ?? null,
        distance: typeof p.distance === "number" ? (p.distance as number) : null,
      };
    });
  } catch (e) {
    console.error(`[agent] Grab fetch failed for "${keyword}":`, e);
    return [];
  }
}

const RecommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        poi_id: z.string().describe("The poi_id from the candidates"),
        name: z.string(),
        category: z.string(),
        matchingIntent: z.enum(["work", "supper", "date", "lunch", "friend"]),
        whyItFits: z.string().describe("1-2 sentences grounded in the user's preferences. No filler."),
        suggestedMove: z.string().describe("A concrete low-pressure action the user could take. Max 1 sentence."),
        matchScore: z.number().min(0).max(100).describe("How well this fits, 0-100"),
      }),
    )
    .min(1)
    .max(5),
});

export type AgentInput = {
  intents: string[];
  socialMode: string;
  availability: string[];
  neighborhood: string | null;
  bio: string | null;
  currentLat: number;
  currentLng: number;
  focusIntent?: string;
};

// Broader keyword map so recommendations aren't all bookstores etc.
const INTENT_KEYWORDS: Record<string, string[]> = {
  work: ["cafe", "coworking"],
  lunch: ["lunch", "hawker"],
  supper: ["supper", "noodle"],
  date: ["wine bar", "dessert"],
  friend: ["cafe", "bar"],
};

// Human-readable label so the AI describes recs in the user's language, not DB keys
const INTENT_LABEL: Record<string, string> = {
  work: "a deep-work spot",
  lunch: "a lunch",
  supper: "a late supper",
  date: "a low-pressure date",
  friend: "a friend hang",
};

const MAX_CANDIDATES_TO_LLM = 10;
const GRAB_LIMIT_PER_KEYWORD = 6;
const AGENT_TIMEOUT_MS = 20_000;
const MAX_RADIUS_KM = 3;     // never return a "nearest" place further than this
const MIN_CANDIDATES = 2;    // fewer close results is OK; don't pad with far ones

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function recommendPlaces(input: AgentInput) {
  const intents = input.focusIntent
    ? [input.focusIntent]
    : input.intents.length > 0
    ? input.intents.slice(0, 2)
    : ["friend"];

  // Fetch candidates
  const rawCandidates: (Place & { sourceIntent?: string; distanceKm?: number })[] = [];
  const seen = new Set<string>();
  for (const intent of intents) {
    const keywords = (INTENT_KEYWORDS[intent] ?? [intent]).slice(0, 2);
    for (const keyword of keywords) {
      try {
        const list = await searchGrab(keyword, input.currentLat, input.currentLng, GRAB_LIMIT_PER_KEYWORD);
        for (const p of list) {
          if (seen.has(p.poi_id)) continue;
          seen.add(p.poi_id);
          const distanceKm =
            p.lat !== null && p.lng !== null
              ? haversineKm({ lat: input.currentLat, lng: input.currentLng }, { lat: p.lat as number, lng: p.lng as number })
              : Infinity;
          rawCandidates.push({ ...p, sourceIntent: intent, distanceKm });
        }
      } catch (e) {
        console.warn(`Grab search failed for "${keyword}":`, e);
      }
    }
  }

  if (rawCandidates.length === 0) {
    return { recommendations: [], candidatesFound: 0 };
  }

  // Grab's keyword search ranks by relevance, not distance — apply a hard cap
  // so we never recommend e.g. a Jurong spot to a user in Holland Village.
  let candidates = rawCandidates
    .filter((c) => c.distanceKm !== undefined && c.distanceKm <= MAX_RADIUS_KM)
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  if (candidates.length < MIN_CANDIDATES) {
    // Below minimum — take the closest few even if they're beyond the cap, so we
    // at least return something. Cap at 10km absolute max.
    candidates = [...rawCandidates]
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      .filter((c) => (c.distanceKm ?? Infinity) <= 10)
      .slice(0, MIN_CANDIDATES);
  }

  if (candidates.length === 0) {
    return { recommendations: [], candidatesFound: 0 };
  }

  const candidateText = candidates
    .slice(0, MAX_CANDIDATES_TO_LLM)
    .map((c, i) => {
      const dist = c.distanceKm !== undefined && c.distanceKm !== Infinity
        ? `${c.distanceKm.toFixed(1)}km`
        : "?";
      return `${i + 1}. [${c.poi_id}] ${c.name} (${c.category}) — ${c.neighborhood ?? ""} · ${dist} · tag:${c.sourceIntent ?? ""}`;
    })
    .join("\n");


  const focusLabel = INTENT_LABEL[intents[0]] ?? intents[0];
  const isFocus = !!input.focusIntent;

  // When a focus intent is active, ONLY reason about that intent —
  // do not mix the user's other saved intents into the recommendation text.
  const userLine = isFocus
    ? `USER: looking_for="${focusLabel}" · style=${input.socialMode}${input.bio ? ` · bio="${input.bio}"` : ""}`
    : `USER: looking_for="${focusLabel}" · style=${input.socialMode} · avail=${input.availability.join(",") || "flex"}${input.bio ? ` · bio="${input.bio}"` : ""}`;

  const prompt = `Pick the top 3 places for ${focusLabel}. Only recommend places that genuinely fit ${focusLabel} — ignore candidates that don't match even if they're good for something else.

${userLine}

CANDIDATES:
${candidateText}

For each pick:
- whyItFits: ONE sentence, grounded in why this spot works for ${focusLabel}. No generic filler, no cross-referencing other intents.
- suggestedMove: ONE concrete sentence — what to do/say (e.g. "Text them: coffee at 10, leave by noon").
- matchScore: 0-100 (how well it fits ${focusLabel} specifically).
- matchingIntent: must equal "${intents[0]}"`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
  let object;
  try {
    const result = await generateObject({
      model: "openai/gpt-5.4-nano",
      schema: RecommendationSchema,
      prompt,
      abortSignal: controller.signal,
      providerOptions: {
        // Fall back to fast reliable models if kimi-k2.6 fails / is slow / doesn't exist
        gateway: {
          models: ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5", "google/gemini-2.5-flash"],
        },
      },
    });
    object = result.object;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("AI agent timed out after 20s — try again.");
    }
    throw err;
  } finally {
    clearTimeout(t);
  }

  const enriched = object.recommendations.map((r) => {
    const match = candidates.find((c) => c.poi_id === r.poi_id);
    return {
      ...r,
      address: match?.address ?? "",
      lat: match?.lat ?? null,
      lng: match?.lng ?? null,
      neighborhood: match?.neighborhood ?? null,
    };
  });

  return { recommendations: enriched, candidatesFound: candidates.length };
}

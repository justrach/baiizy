import { generateObject, tool } from "ai";
import { z } from "zod";

const INTENT_KEYWORDS: Record<string, string[]> = {
  work: ["quiet cafe", "coworking cafe", "study cafe"],
  lunch: ["lunch", "lunch spot", "cheap eats"],
  supper: ["late night food", "supper", "24 hour"],
  date: ["wine bar", "dessert", "romantic restaurant"],
  friend: ["bookstore cafe", "casual cafe", "tea house"],
};

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

const INTENT_KEYWORDS_SIMPLE: Record<string, string[]> = {
  work: ["cafe"],
  lunch: ["lunch"],
  supper: ["restaurant"],
  date: ["wine bar"],
  friend: ["bookstore"],
};
const MAX_CANDIDATES_TO_LLM = 8;
const GRAB_LIMIT_PER_INTENT = 4;
const AGENT_TIMEOUT_MS = 20_000;

export async function recommendPlaces(input: AgentInput) {
  const intents = input.focusIntent
    ? [input.focusIntent]
    : input.intents.length > 0
    ? input.intents.slice(0, 2) // 2 intents max, not 3 — fewer grab calls
    : ["friend"];

  const candidates: Place[] = [];
  const seen = new Set<string>();
  for (const intent of intents) {
    const keyword = (INTENT_KEYWORDS_SIMPLE[intent] ?? [intent])[0];
    try {
      const list = await searchGrab(keyword, input.currentLat, input.currentLng, GRAB_LIMIT_PER_INTENT);
      for (const p of list) {
        if (!seen.has(p.poi_id)) {
          seen.add(p.poi_id);
          candidates.push({ ...p, sourceIntent: intent } as Place & { sourceIntent: string });
        }
      }
    } catch (e) {
      console.warn(`Grab search failed for "${keyword}":`, e);
    }
  }

  if (candidates.length === 0) {
    return { recommendations: [], candidatesFound: 0 };
  }

  // Terser candidate list — saves tokens → faster generation
  const candidateText = candidates
    .slice(0, MAX_CANDIDATES_TO_LLM)
    .map((c: Place & { sourceIntent?: string }, i) =>
      `${i + 1}. [${c.poi_id}] ${c.name} (${c.category}) — ${c.neighborhood ?? ""} · for:${c.sourceIntent ?? ""}`,
    )
    .join("\n");

  // Compact prompt — was ~1800 tokens, now ~400
  const prompt = `Pick the top 3 places for this user from the candidates.

USER: intents=${input.intents.join("+")} · mode=${input.socialMode} · avail=${input.availability.join(",") || "flex"} · looking_for=${intents.join("+")}${input.bio ? ` · bio="${input.bio}"` : ""}

CANDIDATES:
${candidateText}

For each: grounded whyItFits (1 sentence, reference their profile, no filler), concrete suggestedMove (1 sentence action), matchScore 0-100.`;

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

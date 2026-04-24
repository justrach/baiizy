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
  if (!apiKey) return [];

  const q = new URLSearchParams({ keyword, country: "SGP", location: `${lat},${lng}`, limit: String(limit) });
  const res = await fetch(`https://maps.grab.com/api/v1/maps/poi/v1/search?${q}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { places?: Array<Record<string, unknown>> };
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

export async function recommendPlaces(input: AgentInput) {
  const intents = input.focusIntent
    ? [input.focusIntent]
    : input.intents.length > 0
    ? input.intents
    : ["friend"];

  // Pull candidates from Grab for each intent in parallel
  const candidateLists = await Promise.all(
    intents.flatMap((intent) => {
      const keywords = INTENT_KEYWORDS[intent] ?? [intent];
      return keywords.map((kw) => searchGrab(kw, input.currentLat, input.currentLng, 4));
    }),
  );

  // Deduplicate by poi_id
  const seen = new Set<string>();
  const candidates: Place[] = [];
  for (const list of candidateLists) {
    for (const p of list) {
      if (!seen.has(p.poi_id)) {
        seen.add(p.poi_id);
        candidates.push(p);
      }
    }
  }

  if (candidates.length === 0) {
    return { recommendations: [], candidatesFound: 0 };
  }

  const candidateText = candidates
    .slice(0, 20)
    .map((c, i) => `${i + 1}. [${c.poi_id}] ${c.name} — ${c.category} — ${c.neighborhood ?? "unknown area"} — ${c.address}`)
    .join("\n");

  const prompt = `You are a social concierge helping a user find places worth hanging out at.

The user wants to be matched with places that fit the SOCIAL and PRACTICAL shape of what they asked for, not just the literal keyword.

USER PROFILE:
- Intents they care about: ${input.intents.join(", ") || "none"}
- Social style: ${input.socialMode}
- Availability: ${input.availability.join(", ") || "flexible"}
- Neighborhood: ${input.neighborhood ?? "unspecified"}
- Bio: ${input.bio ?? "none"}
- Currently looking for: ${intents.join(", ")}

CANDIDATE PLACES (from Grab, within ~1km of the user):
${candidateText}

Pick the top 3-5 that best match the user's preferences. For each, explain the fit grounded in their actual profile (e.g. reference their social style, availability, or stated intents). Avoid generic filler. Include a suggestedMove that's low-pressure and concrete ("Do a 90-minute focus block here Tuesday morning").

Return a matchScore from 0-100 for each — weight categorical fit heaviest, then distance/area fit.`;

  const { object } = await generateObject({
    model: "deepseek/deepseek-v4-pro",
    schema: RecommendationSchema,
    prompt,
  });

  // Merge AI output back with candidate coordinates so the frontend can display them
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

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { auth } from "@/lib/auth";
import { recommendPlaces } from "@/lib/agent";

const SG_DEFAULT = { lat: 1.3521, lng: 103.8198 };

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const focusIntent = searchParams.get("intent") ?? undefined;
  const customQuery = searchParams.get("q")?.trim() ?? undefined;

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1);

  if (!prefs) {
    return Response.json(
      { error: "Please complete onboarding first", recommendations: [] },
      { status: 400 },
    );
  }

  // Pick the freshest cached location. Live > neighborhood > SG default.
  const hasLive = prefs.currentLat !== null && prefs.currentLng !== null;
  const hasHood = prefs.neighborhoodLat !== null && prefs.neighborhoodLng !== null;

  const source: "live" | "neighborhood" | "default" = hasLive ? "live" : hasHood ? "neighborhood" : "default";
  const lat = hasLive ? prefs.currentLat! : hasHood ? prefs.neighborhoodLat! : SG_DEFAULT.lat;
  const lng = hasLive ? prefs.currentLng! : hasHood ? prefs.neighborhoodLng! : SG_DEFAULT.lng;

  // How stale is the cached live location?
  const ageMinutes = hasLive && prefs.currentLocationUpdatedAt
    ? Math.round((Date.now() - new Date(prefs.currentLocationUpdatedAt).getTime()) / 60_000)
    : null;

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      {
        error: "AI_GATEWAY_API_KEY not configured. Add it to .env.local from your Vercel AI Gateway dashboard.",
        recommendations: [],
      },
      { status: 500 },
    );
  }

  try {
    const result = await recommendPlaces({
      intents: prefs.intents as string[],
      socialMode: prefs.socialMode,
      availability: prefs.availability as string[],
      neighborhood: prefs.neighborhood,
      bio: prefs.bio,
      currentLat: lat,
      currentLng: lng,
      focusIntent,
      customQuery,
    });

    return Response.json({
      ...result,
      usingLiveLocation: source === "live",
      location: {
        lat,
        lng,
        source,
        ageMinutes,
        neighborhoodLabel: prefs.neighborhood,
      },
    });
  } catch (err) {
    console.error("Recommendation failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Agent failed", recommendations: [] },
      { status: 500 },
    );
  }
}

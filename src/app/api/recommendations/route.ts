import { headers } from "next/headers";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { recommendPlaces } from "@/lib/agent";

const SG_DEFAULT = { lat: 1.3521, lng: 103.8198 };

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const focusIntent = searchParams.get("intent") ?? undefined;
  const customQuery = searchParams.get("q")?.trim() ?? undefined;
  const friendIdsRaw = searchParams.get("friends") ?? "";
  const friendIds = friendIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);

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

  let friendLocations: Array<{ userId: string; name: string; image: string | null; lat: number; lng: number }> = [];
  if (friendIds.length > 0) {
    const rows = await db
      .select({
        userId: user.id,
        name: user.name,
        image: user.image,
        lat: userPreferences.currentLat,
        lng: userPreferences.currentLng,
      })
      .from(user)
      .innerJoin(userPreferences, eq(userPreferences.userId, user.id))
      .where(
        and(
          inArray(user.id, friendIds),
          isNotNull(userPreferences.currentLat),
          isNotNull(userPreferences.currentLng),
        ),
      );
    friendLocations = rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      image: r.image,
      lat: r.lat!,
      lng: r.lng!,
    }));
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
      friends: friendLocations,
    });

    return Response.json({
      ...result,
      usingLiveLocation: source === "live",
      friendsIncluded: friendLocations.map((f) => ({ userId: f.userId, name: f.name, image: f.image })),
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

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { auth } from "@/lib/auth";
import { recommendPlaces } from "@/lib/agent";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const focusIntent = searchParams.get("intent") ?? undefined;

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1);

  if (!prefs) {
    return Response.json({ error: "Please complete onboarding first", recommendations: [] }, { status: 400 });
  }

  // Prefer live GPS; fall back to neighborhood pin; final fallback Singapore
  const lat = prefs.currentLat ?? prefs.neighborhoodLat ?? 1.3521;
  const lng = prefs.currentLng ?? prefs.neighborhoodLng ?? 103.8198;

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({
      error: "AI_GATEWAY_API_KEY not configured. Add it to .env.local from your Vercel AI Gateway dashboard.",
      recommendations: [],
    }, { status: 500 });
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
    });

    return Response.json({
      ...result,
      usingLiveLocation: prefs.currentLat !== null,
      location: { lat, lng },
    });
  } catch (err) {
    console.error("Recommendation failed:", err);
    return Response.json({ error: err instanceof Error ? err.message : "Agent failed", recommendations: [] }, { status: 500 });
  }
}

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { auth } from "@/lib/auth";
import { embed } from "@/lib/embeddings";
import postgres from "postgres";

const INTENT_TEXT: Record<string, string> = {
  work: "quiet cafes for deep focused work and laptop sessions",
  supper: "late night suppers and casual dinners with friends",
  date: "low-pressure date spots for meaningful conversation",
  lunch: "quick office lunches with colleagues",
  friend: "low-pressure friend hangs, bookstores, walks",
};

const MODE_TEXT: Record<string, string> = {
  "solo-friendly": "prefers parallel play and being side by side while doing own thing",
  "small-group": "prefers intimate small groups with real conversation",
  "flexible": "flexible — can do either parallel play or group hangs",
};

function buildProfileText(prefs: {
  intents: string[];
  socialMode: string;
  availability: string[];
  neighborhood: string | null;
  bio: string | null;
}) {
  const intentLines = prefs.intents.map((i) => INTENT_TEXT[i] ?? i).join(". ");
  const modeLine = MODE_TEXT[prefs.socialMode] ?? prefs.socialMode;
  const availLine = prefs.availability.length ? `Available: ${prefs.availability.join(", ")}` : "";
  const hoodLine = prefs.neighborhood ? `Neighborhood: ${prefs.neighborhood}` : "";
  const bioLine = prefs.bio ?? "";
  return [intentLines, modeLine, availLine, hoodLine, bioLine].filter(Boolean).join(". ");
}

function getRawClient() {
  const url = process.env.DATABASE_URL!;
  const clean = url.replace(/[?&]sslrootcert=[^&]*/g, "").replace(/[?&]sslmode=[^&]*/g, "").replace(/[?]$/, "");
  return postgres(clean, { ssl: "require" });
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1);

  return Response.json(prefs ?? null);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    intents?: string[];
    socialMode?: string;
    availability?: string[];
    neighborhood?: string;
    neighborhoodLat?: number;
    neighborhoodLng?: number;
    neighborhoodPoiId?: string;
    bio?: string;
  };

  const validIntents = ["work", "supper", "date", "lunch", "friend"];
  const intents = (body.intents ?? []).filter((i) => validIntents.includes(i));
  const availability = body.availability ?? [];
  const socialMode = body.socialMode ?? "flexible";
  const neighborhood = body.neighborhood ?? null;
  const neighborhoodLat = typeof body.neighborhoodLat === "number" ? body.neighborhoodLat : null;
  const neighborhoodLng = typeof body.neighborhoodLng === "number" ? body.neighborhoodLng : null;
  const neighborhoodPoiId = body.neighborhoodPoiId ?? null;
  const bio = body.bio ?? null;

  const profileText = buildProfileText({ intents, socialMode, availability, neighborhood, bio });
  let embedding: number[] | null = null;
  try {
    embedding = await embed(profileText);
  } catch (e) {
    console.error("Embedding failed:", e);
  }

  await db
    .insert(userPreferences)
    .values({
      userId: session.user.id,
      intents,
      socialMode,
      availability,
      neighborhood,
      neighborhoodLat,
      neighborhoodLng,
      neighborhoodPoiId,
      bio,
      onboardingCompleted: true,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        intents,
        socialMode,
        availability,
        neighborhood,
        neighborhoodLat,
        neighborhoodLng,
        neighborhoodPoiId,
        bio,
        onboardingCompleted: true,
        updatedAt: new Date(),
      },
    });

  if (embedding) {
    const sql = getRawClient();
    const vecStr = `[${embedding.join(",")}]`;
    await sql`UPDATE user_preferences SET embedding = ${vecStr}::vector WHERE user_id = ${session.user.id}`;
    await sql.end();
  }

  return Response.json({ ok: true });
}

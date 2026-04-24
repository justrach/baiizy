import { headers } from "next/headers";
import { eq, and, or } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { userPreferences, friendships } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { embed } from "@/lib/embeddings";
import postgres from "postgres";

const FAKES = [
  {
    name: "Maya Lim",
    username: "maya_l",
    email: "maya.fake@baiizy.test",
    lat: 1.2834, lng: 103.8607, // Marina Bay
    neighborhood: "Marina Bay",
    bio: "Product designer. Always down for a quiet cafe and a walk after.",
    intents: ["work", "friend"],
    socialMode: "solo-friendly",
    availability: ["weekday-morning", "weekday-evening"],
  },
  {
    name: "Jonas Tan",
    username: "jonast",
    email: "jonas.fake@baiizy.test",
    lat: 1.2855, lng: 103.8365, // Tiong Bahru
    neighborhood: "Tiong Bahru",
    bio: "Runs a studio. Bookstore cafe every Sunday.",
    intents: ["friend", "work"],
    socialMode: "flexible",
    availability: ["weekend-morning", "weekend-afternoon"],
  },
  {
    name: "Priya Rao",
    username: "priya_rao",
    email: "priya.fake@baiizy.test",
    lat: 1.3036, lng: 103.8318, // Orchard
    neighborhood: "Orchard",
    bio: "Recruiter. Standing Wednesday lunch crew, no exceptions.",
    intents: ["lunch", "work"],
    socialMode: "small-group",
    availability: ["weekday-lunch"],
  },
  {
    name: "Theo Nguyen",
    username: "theo",
    email: "theo.fake@baiizy.test",
    lat: 1.3181, lng: 103.8863, // Geylang
    neighborhood: "Geylang",
    bio: "Chef. Late suppers, no plans, show up.",
    intents: ["supper", "friend"],
    socialMode: "small-group",
    availability: ["late-night"],
  },
  {
    name: "Leah Chen",
    username: "leahc",
    email: "leah.fake@baiizy.test",
    lat: 1.3036, lng: 103.8099, // Dempsey
    neighborhood: "Dempsey",
    bio: "Writer. One-drink first meets, optional dessert walk.",
    intents: ["date", "friend"],
    socialMode: "small-group",
    availability: ["weekday-evening", "weekend-afternoon"],
  },
  {
    name: "Marcus Wee",
    username: "marcus_w",
    email: "marcus.fake@baiizy.test",
    lat: 1.3006, lng: 103.9107, // East Coast Park
    neighborhood: "East Coast",
    bio: "Sunset walks at Harbor Steps. Always up for tea.",
    intents: ["friend"],
    socialMode: "solo-friendly",
    availability: ["weekend-morning", "weekend-afternoon"],
  },
];

const INTENT_TEXT: Record<string, string> = {
  work: "quiet cafes for deep focused work and laptop sessions",
  supper: "late night suppers and casual dinners with friends",
  date: "low-pressure date spots for meaningful conversation",
  lunch: "quick office lunches with colleagues",
  friend: "low-pressure friend hangs, bookstores, walks",
};
const MODE_TEXT: Record<string, string> = {
  "solo-friendly": "prefers parallel play and being side by side",
  "small-group": "prefers intimate small groups",
  "flexible": "flexible — can do either",
};

function newId(prefix = "") {
  return prefix + randomBytes(16).toString("hex").slice(0, 24);
}

function getRawClient() {
  const url = process.env.DATABASE_URL!;
  const clean = url.replace(/[?&]sslrootcert=[^&]*/g, "").replace(/[?&]sslmode=[^&]*/g, "").replace(/[?]$/, "");
  return postgres(clean, { ssl: "require" });
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;
  const raw = getRawClient();
  const created: string[] = [];
  const linked: string[] = [];

  try {
    for (const f of FAKES) {
      // 1. Upsert the fake user (email is unique)
      const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, f.email)).limit(1);
      let fakeId: string;
      if (existing) {
        fakeId = existing.id;
      } else {
        fakeId = newId();
        await db.insert(user).values({
          id: fakeId,
          name: f.name,
          email: f.email,
          username: f.username,
          emailVerified: true,
          image: `https://i.pravatar.cc/200?u=${encodeURIComponent(f.username)}`,
        });
        created.push(f.name);
      }

      // 2. Upsert preferences + live location
      const profileText = [
        f.intents.map((i) => INTENT_TEXT[i] ?? i).join(". "),
        MODE_TEXT[f.socialMode] ?? f.socialMode,
        `Available: ${f.availability.join(", ")}`,
        `Neighborhood: ${f.neighborhood}`,
        f.bio,
      ].filter(Boolean).join(". ");

      let embedding: number[] | null = null;
      try { embedding = await embed(profileText); } catch { /* ignore */ }

      await db.insert(userPreferences).values({
        userId: fakeId,
        intents: f.intents,
        socialMode: f.socialMode,
        availability: f.availability,
        neighborhood: f.neighborhood,
        bio: f.bio,
        neighborhoodLat: f.lat,
        neighborhoodLng: f.lng,
        currentLat: f.lat,
        currentLng: f.lng,
        currentLocationUpdatedAt: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 6)), // within last 6h
        onboardingCompleted: true,
      }).onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          currentLat: f.lat,
          currentLng: f.lng,
          currentLocationUpdatedAt: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 6)),
          updatedAt: new Date(),
        },
      });

      if (embedding) {
        const vec = `[${embedding.join(",")}]`;
        await raw`UPDATE user_preferences SET embedding = ${vec}::vector WHERE user_id = ${fakeId}`;
      }

      // 3. Auto-accept friendship with current user
      const pair = await db
        .select({ id: friendships.id })
        .from(friendships)
        .where(
          or(
            and(eq(friendships.requesterId, uid), eq(friendships.addresseeId, fakeId)),
            and(eq(friendships.requesterId, fakeId), eq(friendships.addresseeId, uid)),
          ),
        )
        .limit(1);

      if (pair.length === 0) {
        await db.insert(friendships).values({
          requesterId: uid,
          addresseeId: fakeId,
          status: "accepted",
        });
        linked.push(f.name);
      }
    }
  } finally {
    await raw.end();
  }

  return Response.json({ ok: true, created, linked, total: FAKES.length });
}

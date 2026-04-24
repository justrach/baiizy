import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import postgres from "postgres";

let clientCached: ReturnType<typeof postgres> | null = null;
function getClient() {
  if (clientCached) return clientCached;
  const url = process.env.DATABASE_URL!;
  const clean = url.replace(/[?&]sslrootcert=[^&]*/g, "").replace(/[?&]sslmode=[^&]*/g, "").replace(/[?]$/, "");
  clientCached = postgres(clean, { ssl: "require" });
  return clientCached;
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getClient();
  const uid = session.user.id;

  // Rank other users by cosine similarity to current user's embedding,
  // excluding self and existing friendships
  const rows = await sql`
    WITH me AS (
      SELECT embedding FROM user_preferences WHERE user_id = ${uid} AND embedding IS NOT NULL
    )
    SELECT u.id, u.name, u.email, u.username, u.image, up.intents, up.social_mode, up.bio,
           1 - (up.embedding <=> (SELECT embedding FROM me)) AS match_score
    FROM "user" u
    INNER JOIN user_preferences up ON up.user_id = u.id
    WHERE u.id != ${uid}
      AND up.embedding IS NOT NULL
      AND u.id NOT IN (
        SELECT CASE WHEN requester_id = ${uid} THEN addressee_id ELSE requester_id END
        FROM friendships
        WHERE requester_id = ${uid} OR addressee_id = ${uid}
      )
    ORDER BY up.embedding <=> (SELECT embedding FROM me)
    LIMIT 10
  `;

  return Response.json(rows);
}

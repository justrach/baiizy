import { headers } from "next/headers";
import { ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim() ?? "";
  if (!email || email.length < 3) return Response.json([]);

  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, username: user.username, image: user.image })
    .from(user)
    .where(or(ilike(user.email, `%${email}%`), ilike(user.username, `%${email}%`), ilike(user.name, `%${email}%`)))
    .limit(8);

  return Response.json(rows.filter((r) => r.id !== session.user.id));
}

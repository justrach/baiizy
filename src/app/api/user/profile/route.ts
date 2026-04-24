import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email, username: user.username, image: user.image })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  return Response.json(row ?? null);
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { username?: string; name?: string };

  if (body.username !== undefined) {
    const username = body.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return Response.json({ error: "3-20 chars: lowercase letters, numbers, underscore only" }, { status: 400 });
    }
    // Check uniqueness
    const [taken] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.username, username), ne(user.id, session.user.id)))
      .limit(1);
    if (taken) return Response.json({ error: "Username is taken" }, { status: 409 });

    await db.update(user).set({ username, updatedAt: new Date() }).where(eq(user.id, session.user.id));
  }

  if (body.name !== undefined && body.name.trim().length > 0) {
    await db.update(user).set({ name: body.name.trim(), updatedAt: new Date() }).where(eq(user.id, session.user.id));
  }

  return Response.json({ ok: true });
}

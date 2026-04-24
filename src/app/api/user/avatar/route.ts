import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "file is required" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return Response.json({ error: "Only jpeg/png/webp/gif allowed" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Max 5 MB" }, { status: 400 });

  const ext = file.type.split("/")[1];
  const key = `avatars/${session.user.id}-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  await uploadToR2(key, buf, file.type);

  // Store the key — serve through our proxy at /api/images/<key>
  const imageUrl = `/api/images/${encodeURIComponent(key)}`;

  await db.update(user).set({ image: imageUrl, updatedAt: new Date() }).where(eq(user.id, session.user.id));

  return Response.json({ ok: true, url: imageUrl, key });
}

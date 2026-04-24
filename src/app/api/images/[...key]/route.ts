import { getFromR2 } from "@/lib/r2";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const fullKey = key.map((seg) => decodeURIComponent(seg)).join("/");

  try {
    const obj = await getFromR2(fullKey);
    if (!obj.Body) return new Response("Not found", { status: 404 });

    const stream = obj.Body as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": obj.ContentType ?? "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

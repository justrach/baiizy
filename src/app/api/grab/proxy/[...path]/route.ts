// Authenticated pass-through proxy for Grab maps assets (tiles, sprites, glyphs).
// When Grab's font service 502s (bug #15), we transparently fall back to
// Protomaps' public glyph server so labels still render.

const GRAB_BASE = "https://maps.grab.com";
const PROTOMAPS_FONTS = "https://protomaps.github.io/basemaps-assets/fonts";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 150;

// Grab's Roboto fontstacks don't exist on Protomaps — map them to Noto.
function mapFontstack(stack: string): string {
  const s = decodeURIComponent(stack).toLowerCase();
  if (s.includes("bold")) return "Noto Sans Bold";
  if (s.includes("medium")) return "Noto Sans Medium";
  if (s.includes("italic")) return "Noto Sans Italic";
  return "Noto Sans Regular";
}

async function fetchWithRetry(url: string, apiKey: string, accept: string): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    last = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: accept },
      cache: "no-store",
    });
    if (last.ok || last.status < 500) return last;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, BASE_BACKOFF_MS * 2 ** (attempt - 1)));
    }
  }
  return last!;
}

async function fontFallback(path: string[]): Promise<Response | null> {
  // path like: api/maps/tiles/v2/fonts/Roboto%20Regular/0-255.pbf
  const idx = path.findIndex((p) => p === "fonts");
  if (idx === -1 || idx + 2 >= path.length) return null;
  const stack = mapFontstack(path[idx + 1]);
  const range = path[idx + 2]; // e.g. "0-255.pbf"
  const url = `${PROTOMAPS_FONTS}/${encodeURIComponent(stack)}/${range}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const headers = new Headers();
  const ct = res.headers.get("content-type") ?? "application/x-protobuf";
  headers.set("content-type", ct);
  headers.set("cache-control", "public, max-age=86400");
  headers.set("x-baiizy-font-fallback", "protomaps");
  return new Response(res.body, { status: 200, headers });
}

async function forward(request: Request, path: string[]) {
  const apiKey = process.env.GRAB_MAPS_API_KEY;
  if (!apiKey) return new Response("Missing GRAB_MAPS_API_KEY", { status: 500 });

  const { search } = new URL(request.url);
  const upstream = `${GRAB_BASE}/${path.join("/")}${search}`;
  const accept = request.headers.get("accept") ?? "*/*";

  const res = await fetchWithRetry(upstream, apiKey, accept);

  // If Grab's font service is down but we're asking for a glyph, go to Protomaps
  if (res.status >= 500 && path.includes("fonts")) {
    const fb = await fontFallback(path);
    if (fb) return fb;
  }

  const headers = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("cache-control", "public, max-age=300");
  return new Response(res.body, { status: res.status, headers });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return forward(request, path);
}

export async function HEAD(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return forward(request, path);
}

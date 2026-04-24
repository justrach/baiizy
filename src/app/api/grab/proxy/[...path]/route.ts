// Authenticated pass-through proxy for Grab maps assets (tiles, sprites, glyphs).
// Lets the browser use Grab's vector style without exposing the Bearer token,
// and retries on transient 5xx to smooth over Grab's intermittent outages.

const GRAB_BASE = "https://maps.grab.com";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 150;

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

async function forward(request: Request, path: string[]) {
  const apiKey = process.env.GRAB_MAPS_API_KEY;
  if (!apiKey) return new Response("Missing GRAB_MAPS_API_KEY", { status: 500 });

  const { search } = new URL(request.url);
  const upstream = `${GRAB_BASE}/${path.join("/")}${search}`;
  const accept = request.headers.get("accept") ?? "*/*";

  const res = await fetchWithRetry(upstream, apiKey, accept);

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

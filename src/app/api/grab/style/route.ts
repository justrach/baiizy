const GRAB_BASE_URL = "https://maps.grab.com";
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 250;

async function fetchWithRetry(url: string, apiKey: string) {
  let lastStatus = 0;
  let lastBody = "";
  let lastContentType = "application/json";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    lastStatus = res.status;
    lastBody = await res.text();
    lastContentType = res.headers.get("content-type") ?? "application/json";

    // 2xx — success
    if (res.ok) return { status: lastStatus, body: lastBody, contentType: lastContentType };

    // Retry only transient upstream failures (5xx) — 4xx is the client's fault
    if (res.status < 500) break;

    if (attempt < MAX_ATTEMPTS) {
      const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  return { status: lastStatus, body: lastBody, contentType: lastContentType };
}

export async function GET(request: Request) {
  const apiKey = process.env.GRAB_MAPS_API_KEY;
  const { searchParams } = new URL(request.url);
  const theme = searchParams.get("theme") ?? "basic";

  if (!apiKey) {
    return Response.json(
      {
        configured: false,
        message: "Add GRAB_MAPS_API_KEY to .env.local, then restart npm run dev to fetch GrabMaps styles.",
      },
      { status: 401 },
    );
  }

  const upstream = `${GRAB_BASE_URL}/api/style.json?${new URLSearchParams({ theme }).toString()}`;
  const { status, body, contentType } = await fetchWithRetry(upstream, apiKey);

  // If all retries failed, return a friendly JSON error rather than Grab's raw text body
  if (status >= 500 || status === 0) {
    return Response.json(
      {
        error: "upstream-unavailable",
        message: `Style endpoint returned ${status} after ${MAX_ATTEMPTS} attempts. Grab appears to be throttling or having an outage — try again in a moment.`,
        status,
      },
      { status: 502 },
    );
  }

  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

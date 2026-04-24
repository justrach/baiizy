const GRAB_BASE_URL = "https://maps.grab.com";

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
  const response = await fetch(upstream, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

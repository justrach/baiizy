export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword")?.trim() ?? "";
  const lat = searchParams.get("lat") ?? "1.3521";
  const lng = searchParams.get("lng") ?? "103.8198";
  const limit = searchParams.get("limit") ?? "8";
  const country = searchParams.get("country") ?? "SGP";

  if (!keyword) return Response.json({ places: [] });

  const apiKey = process.env.GRAB_MAPS_API_KEY;
  if (!apiKey) return Response.json({ error: "GRAB_MAPS_API_KEY missing" }, { status: 500 });

  const q = new URLSearchParams({ keyword, country, location: `${lat},${lng}`, limit });
  const res = await fetch(`https://maps.grab.com/api/v1/maps/poi/v1/search?${q}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) return Response.json({ error: `Grab ${res.status}`, places: [] }, { status: 502 });

  const data = await res.json() as { places?: any[] };
  const places = (data.places ?? []).map((p: any) => ({
    poi_id: p.poi_id,
    name: p.name,
    address: p.formatted_address ?? "",
    category: p.category ?? p.business_type ?? "",
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    neighborhood: p.administrative_areas?.find((a: any) => a.type === "Neighborhood")?.name ?? null,
    openingHours: p.opening_hours ?? null,
    distance: p.distance ?? null,
  }));

  return Response.json({ places });
}

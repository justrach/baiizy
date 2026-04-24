const DEFAULT_LOCATION = "1.3521,103.8198"; // Singapore

type GrabPlace = {
  poi_id: string;
  name: string;
  short_name?: string;
  formatted_address?: string;
  location: { latitude: number; longitude: number };
  administrative_areas?: { type: string; name: string }[];
  category?: string;
  business_type?: string;
};

type AutocompleteResult = {
  poi_id: string;
  display: string;
  subtitle: string;
  latitude: number;
  longitude: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("q")?.trim() ?? "";
  if (keyword.length < 2) return Response.json({ results: [] });

  const apiKey = process.env.GRAB_MAPS_API_KEY;
  if (!apiKey) return Response.json({ error: "GRAB_MAPS_API_KEY missing" }, { status: 500 });

  const q = new URLSearchParams({
    keyword,
    country: searchParams.get("country") ?? "SGP",
    location: searchParams.get("location") ?? DEFAULT_LOCATION,
    limit: searchParams.get("limit") ?? "6",
  });

  const res = await fetch(`https://maps.grab.com/api/v1/maps/poi/v1/search?${q}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return Response.json({ error: `Grab returned ${res.status}`, results: [] }, { status: 502 });
  }

  const data = (await res.json()) as { places?: GrabPlace[] };
  const results: AutocompleteResult[] = (data.places ?? []).map((p) => {
    const neighborhood = p.administrative_areas?.find((a) => a.type === "Neighborhood")?.name;
    const municipality = p.administrative_areas?.find((a) => a.type === "Municipality")?.name;
    const subtitle = [neighborhood, municipality].filter(Boolean).join(" • ") || p.formatted_address || "";
    return {
      poi_id: p.poi_id,
      display: p.name,
      subtitle,
      latitude: p.location.latitude,
      longitude: p.location.longitude,
    };
  });

  return Response.json({ results });
}

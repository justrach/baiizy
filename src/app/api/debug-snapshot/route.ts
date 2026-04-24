import { GRAB_SNAPSHOT_STYLE } from "@/lib/fallback-style";

export async function GET() {
  const s = GRAB_SNAPSHOT_STYLE as unknown as {
    version?: number;
    name?: string;
    layers?: unknown[];
    sources?: Record<string, { tiles?: string[]; url?: string }>;
    sprite?: string;
    glyphs?: string;
    center?: number[];
    zoom?: number;
  };
  return Response.json({
    loaded: !!s,
    version: s.version,
    name: s.name,
    layers: s.layers?.length,
    sources: Object.keys(s.sources ?? {}),
    firstSourceTiles: s.sources?.grabmaptiles?.tiles?.[0],
    sprite: s.sprite,
    glyphs: s.glyphs,
    center: s.center,
    zoom: s.zoom,
  });
}

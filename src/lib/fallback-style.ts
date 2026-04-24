import type { StyleSpecification } from "maplibre-gl";
import grabSnapshotRaw from "./grab-style-snapshot.json";

/**
 * Cached Grab "urban-light-partner" style captured via kuri while the
 * endpoint was live. When Grab's /api/style.json 502s, we use this
 * snapshot and route tiles/sprite/glyphs through our authenticated
 * /api/grab/proxy endpoint so the Bearer token stays server-side.
 *
 * When Grab's tile infrastructure is also down, we fall back to the
 * warm Carto Voyager style as a last resort.
 */

function rewriteToProxy(url: string): string {
  // https://maps.grab.com/api/style.json?x=y  →  /api/grab/proxy/api/style.json?x=y
  return url.replace(/^https:\/\/maps\.grab\.com\//, "/api/grab/proxy/");
}

function rewriteStyle(style: StyleSpecification): StyleSpecification {
  const copy = JSON.parse(JSON.stringify(style)) as StyleSpecification & {
    sources: Record<string, { tiles?: string[]; url?: string }>;
    sprite?: string;
    glyphs?: string;
  };

  for (const src of Object.values(copy.sources ?? {})) {
    if (Array.isArray(src.tiles)) src.tiles = src.tiles.map(rewriteToProxy);
    if (typeof src.url === "string") src.url = rewriteToProxy(src.url);
  }
  if (typeof copy.sprite === "string") copy.sprite = rewriteToProxy(copy.sprite);
  if (typeof copy.glyphs === "string") copy.glyphs = rewriteToProxy(copy.glyphs);

  return copy as StyleSpecification;
}

/** The snapshotted Grab style rewritten to use our authenticated tile proxy. */
export const GRAB_SNAPSHOT_STYLE: StyleSpecification = rewriteStyle(
  grabSnapshotRaw as unknown as StyleSpecification,
);

/** Last-resort fallback when even Grab's tile infrastructure is unreachable. */
export const CARTO_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors · © CARTO",
    },
  },
  layers: [
    { id: "baiizy-bg", type: "background", paint: { "background-color": "#eadfca" } },
    {
      id: "carto-tiles",
      type: "raster",
      source: "carto",
      paint: {
        "raster-opacity": 1,
        "raster-saturation": -0.12,
        "raster-hue-rotate": 8,
      },
    },
  ],
};

export const FALLBACK_BEARING = 0;
export const FALLBACK_PITCH = 0;

type LoadResult = {
  style: StyleSpecification;
  fallback: boolean;
  fallbackKind?: "grab-snapshot" | "carto-raster";
  reason?: string;
};

/**
 * Try Grab's live style first. On failure, serve the snapshotted Grab
 * style (routed through our proxy). If that's obviously broken too,
 * callers can try Carto Voyager — but since the proxy lets tiles
 * survive a style-endpoint outage, we hand back the snapshot as the
 * primary fallback.
 */
export async function loadMapStyle(): Promise<LoadResult> {
  try {
    const res = await fetch("/api/grab/style?theme=basic", { cache: "no-store" });
    if (!res.ok) {
      return {
        style: GRAB_SNAPSHOT_STYLE,
        fallback: true,
        fallbackKind: "grab-snapshot",
        reason: `Grab style returned ${res.status} — using snapshot`,
      };
    }
    const data = await res.json();
    if (data && typeof data === "object" && "error" in data) {
      return {
        style: GRAB_SNAPSHOT_STYLE,
        fallback: true,
        fallbackKind: "grab-snapshot",
        reason: (data as { message?: string }).message ?? "Grab unavailable",
      };
    }
    return { style: data as StyleSpecification, fallback: false };
  } catch (e) {
    return {
      style: GRAB_SNAPSHOT_STYLE,
      fallback: true,
      fallbackKind: "grab-snapshot",
      reason: e instanceof Error ? e.message : "Network error",
    };
  }
}

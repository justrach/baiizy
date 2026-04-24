export type MapPoi = {
  id: string;
  name: string;
  category: "landmark" | "food" | "culture" | "nature" | "transit" | "viewpoint";
  coordinates: readonly [longitude: number, latitude: number];
  note: string;
};

export type MapThemeConcept = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  singaporeFit: string;
  palette: {
    background: string;
    water: string;
    land: string;
    park: string;
    road: string;
    building: string;
    label: string;
    accent: string;
  };
  visualStyle: {
    mood: string;
    baseMap: "light" | "dark" | "illustrated" | "editorial" | "minimal";
    linework: string;
    typography: string;
    poiTreatment: string;
    routeTreatment: string;
  };
  samplePois: readonly MapPoi[];
};

const marinaBayPois = [
  {
    id: "mbs",
    name: "Marina Bay Sands",
    category: "landmark",
    coordinates: [103.8607, 1.2834],
    note: "A strong skyline anchor for testing labels, photo pins, and arrival cards.",
  },
  {
    id: "gardens-by-the-bay",
    name: "Gardens by the Bay",
    category: "nature",
    coordinates: [103.8644, 1.2816],
    note: "Good for lush greens, dome icons, and walking-path contrast.",
  },
  {
    id: "merlion-park",
    name: "Merlion Park",
    category: "viewpoint",
    coordinates: [103.8545, 1.2868],
    note: "A waterfront meeting point with clear sightlines across the bay.",
  },
  {
    id: "esplanade",
    name: "Esplanade - Theatres on the Bay",
    category: "culture",
    coordinates: [103.8554, 1.2898],
    note: "Useful for cultural POI styling and night-event affordances.",
  },
  {
    id: "lau-pa-sat",
    name: "Lau Pa Sat",
    category: "food",
    coordinates: [103.8506, 1.2807],
    note: "A compact food marker near dense CBD streets and transit.",
  },
  {
    id: "raffles-place",
    name: "Raffles Place MRT",
    category: "transit",
    coordinates: [103.8515, 1.2841],
    note: "A central interchange marker for route previews and ETA labels.",
  },
] as const satisfies readonly MapPoi[];

export const mapThemeConcepts = [
  {
    id: "national-day-bright",
    name: "National Day Bright",
    tagline: "Singapore red-and-white with civic clarity.",
    description:
      "A crisp, celebratory map concept that uses red accents, white cards, and restrained neutral roads so key places around Marina Bay feel festive without becoming noisy.",
    singaporeFit:
      "Best for National Day, tourist discovery, SG60-style campaigns, and local pride moments around the bay.",
    palette: {
      background: "#fff7f4",
      water: "#f4fbff",
      land: "#ffffff",
      park: "#dff3df",
      road: "#f1c7c3",
      building: "#f6e4df",
      label: "#5f1717",
      accent: "#e60012",
    },
    visualStyle: {
      mood: "patriotic, clean, high-contrast",
      baseMap: "light",
      linework: "thin crimson arterials with soft blush neighborhood streets",
      typography: "bold uppercase section labels paired with compact readable POI labels",
      poiTreatment: "white circular pins with red glyphs and a small flag-ribbon selected state",
      routeTreatment: "solid red route with white casing and milestone dots",
    },
    samplePois: marinaBayPois,
  },
  {
    id: "garden-city-glow",
    name: "Garden City Glow",
    tagline: "Botanical greens, glassy water, and soft evening light.",
    description:
      "A nature-forward theme that makes parks, promenades, and waterfront walks feel prominent while keeping the CBD readable.",
    singaporeFit:
      "Works well for Gardens by the Bay itineraries, wellness walks, family plans, and scenic photo routes.",
    palette: {
      background: "#f5f4e8",
      water: "#bfe7e0",
      land: "#f7f2df",
      park: "#74b979",
      road: "#dfd3af",
      building: "#eadfc7",
      label: "#1e4631",
      accent: "#ff9f45",
    },
    visualStyle: {
      mood: "warm, lush, relaxed",
      baseMap: "illustrated",
      linework: "organic paths with slightly rounded road strokes",
      typography: "friendly serif display names with clear sans-serif detail labels",
      poiTreatment: "leaf-backed pins with amber highlights for selected stops",
      routeTreatment: "dotted garden-trail line with glowing waypoint blooms",
    },
    samplePois: marinaBayPois,
  },
  {
    id: "midnight-hawker",
    name: "Midnight Hawker",
    tagline: "Night-market energy for late plans and supper runs.",
    description:
      "A dark editorial style with neon food accents, deeper water, and high-signal POIs for restaurants, MRT stops, and walkable late-night clusters.",
    singaporeFit:
      "Designed for supper discovery, after-work hangouts, theatre nights, and nightlife routes from the CBD to the bay.",
    palette: {
      background: "#11161f",
      water: "#071f2f",
      land: "#161d29",
      park: "#173826",
      road: "#374154",
      building: "#202938",
      label: "#f8eed8",
      accent: "#ffb000",
    },
    visualStyle: {
      mood: "nocturnal, energetic, cinematic",
      baseMap: "dark",
      linework: "charcoal roads with selective neon hierarchy on primary streets",
      typography: "condensed display labels with warm cream supporting text",
      poiTreatment: "glowing food and culture pins with stronger halos at night",
      routeTreatment: "amber neon route with animated dash potential",
    },
    samplePois: marinaBayPois,
  },
  {
    id: "blueprint-bay",
    name: "Blueprint Bay",
    tagline: "Architectural precision for skyline and route planning.",
    description:
      "A technical, blueprint-inspired concept that emphasizes buildings, bridges, transit, and clean distance reading around the Marina Bay loop.",
    singaporeFit:
      "Useful for navigation-heavy flows, accessibility planning, venue logistics, and architectural walking tours.",
    palette: {
      background: "#eef6fb",
      water: "#cce8f6",
      land: "#f8fcff",
      park: "#d6efdf",
      road: "#8aa9bd",
      building: "#d7e4ec",
      label: "#16364a",
      accent: "#0077b6",
    },
    visualStyle: {
      mood: "precise, structured, calm",
      baseMap: "minimal",
      linework: "blueprint hairlines with stronger bridge and transit strokes",
      typography: "monospaced micro-labels with larger civic landmarks",
      poiTreatment: "square coordinate tags with small category ticks",
      routeTreatment: "measured cyan route with distance hash marks",
    },
    samplePois: marinaBayPois,
  },
  {
    id: "kopi-heritage",
    name: "Kopi Heritage",
    tagline: "Sepia warmth for stories, food, and old-new Singapore.",
    description:
      "An editorial heritage theme with paper tones, ink labels, and richer POI cards for explaining why each stop matters.",
    singaporeFit:
      "A strong match for guided walks, food trails, civic history, and mixed heritage-to-skyline itineraries.",
    palette: {
      background: "#f5ead6",
      water: "#b9d4d3",
      land: "#f1dfbf",
      park: "#a5b982",
      road: "#c29c68",
      building: "#dfc59d",
      label: "#4a301f",
      accent: "#b24b2a",
    },
    visualStyle: {
      mood: "nostalgic, textured, story-led",
      baseMap: "editorial",
      linework: "inked roads with subtle paper-grain contrast",
      typography: "warm serif landmark names with compact annotation text",
      poiTreatment: "numbered stamp pins for itinerary sequencing",
      routeTreatment: "hand-drawn sienna path with postcard-style stop numbers",
    },
    samplePois: marinaBayPois,
  },
  {
    id: "rain-kissed-transit",
    name: "Rain-Kissed Transit",
    tagline: "Cool monsoon tones with transport-first legibility.",
    description:
      "A cool, rainy-day concept that makes MRT access, sheltered walks, and short hops easy to scan while keeping attractions visually secondary.",
    singaporeFit:
      "Helpful for everyday commuting, wet-weather plans, airport-to-city flows, and accessibility-aware city exploration.",
    palette: {
      background: "#e9f0f2",
      water: "#8fc7d4",
      land: "#f4f7f7",
      park: "#b7d9bd",
      road: "#b7c4cb",
      building: "#dce5e8",
      label: "#20333a",
      accent: "#00a6a6",
    },
    visualStyle: {
      mood: "fresh, practical, weather-aware",
      baseMap: "light",
      linework: "soft grey road grid with clearer teal transit corridors",
      typography: "high-legibility sans labels tuned for quick glance reading",
      poiTreatment: "compact pins with transit-proximity badges",
      routeTreatment: "teal route with sheltered-walk segments shown as lighter dashes",
    },
    samplePois: marinaBayPois,
  },
] as const satisfies readonly MapThemeConcept[];

export type MapThemeConceptId = (typeof mapThemeConcepts)[number]["id"];

export const defaultMapThemeConceptId: MapThemeConceptId = "national-day-bright";

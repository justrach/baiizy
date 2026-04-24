export type IntentKey = "work" | "supper" | "date" | "lunch" | "friend";

export type IntentOption = {
  key: IntentKey;
  query: string;
  label: string;
  thesis: string;
  ranking: string[];
};

export type Place = {
  name: string;
  category: string;
  distance: string;
  eta: string;
  price: string;
  score: number;
  vibe: string;
  bestFor: string;
  why: string[];
  signals: { label: string; value: number }[];
  followThrough: {
    invitation: string;
    ritual: string;
    friction: string;
  };
  x: number;
  y: number;
  color: string;
};

export type PersonMatch = {
  name: string;
  initials: string;
  distance: string;
  availability: string;
  match: number;
  socialMode: string;
  wants: string;
  repeatSignal: string;
  opener: string;
  color: string;
};

export type SocialTable = {
  title: string;
  time: string;
  size: string;
  hostLine: string;
  ask: string;
  cadence: string;
};

export type LiveGrabPlace = {
  name: string;
  address: string;
  category: string;
  source: string;
};

export type LiveGrabSearch = {
  configured: boolean;
  mode: string;
  message?: string;
  request: {
    query: string;
    lat: number;
    lon: number;
    radius: number;
  };
  places: LiveGrabPlace[];
};

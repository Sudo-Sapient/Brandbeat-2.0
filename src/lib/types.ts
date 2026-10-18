// Shapes shared by the mock and (later) the real LLM endpoints.
// Production swaps src/lib/ai.ts for API calls; nothing else changes.

export type RGB = [number, number, number]; // 0..1

export type Brand = {
  name: string;
  category: string;
  description: string;
  assets: { name: string; kind: "logo" | "photo" | "pdf" }[];
  palette: RGB[]; // 4 colours, pulled from the logo when one is uploaded
};

export type Segment = {
  id: string;
  name: string;
  ages: string;
  when: string;
  wants: string;
  kept: boolean;
  custom?: boolean;
};

export type AakerKey = "product" | "organisation" | "person" | "symbol";
export type BrandMap = Record<AakerKey, { summary: string; traits: string[] }>;

export type Soundboard = {
  energy: number; // 0..100
  tempo: number; // BPM
  warmth: number; // 0..100
  vocals: number; // 0..100
  genres: string[];
  avoid: string[];
};

export type DaypartId = "morning" | "midday" | "evening";
export type Daypart = { id: DaypartId; label: string; start: number; end: number }; // minutes since midnight

export type Track = {
  id: string;
  title: string;
  desc: string;
  genre: string;
  bpm: number;
  energy: number;
  warmth: number;
  vocals: number;
  fit?: number;
  why?: string;
};

export type VibeSet = { tracks: Track[]; pinned: string[]; approved: boolean };

export type Promo = {
  id: string;
  title: string;
  script: string;
  voice: string;
  times: number[]; // minutes since midnight
  days: number[]; // 0 = Mon
};

export type Project = {
  step: number; // furthest step reached, 1..8
  brand: Brand;
  segments: Segment[];
  brandMap: BrandMap | null;
  soundboard: Soundboard | null;
  vibe: Record<DaypartId, VibeSet> | null;
  promos: Promo[];
  banned: string[];
};

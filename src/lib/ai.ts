// Mock "AI". Every function here becomes an LLM / API call in production with the same signature.
import { LIBRARY } from "./library";
import type { Brand, BrandMap, Daypart, DaypartId, Project, Promo, RGB, Segment, Soundboard, Track } from "./types";

export const DAYPARTS: Daypart[] = [
  { id: "morning", label: "Morning", start: 7 * 60, end: 11 * 60 },
  { id: "midday", label: "Midday", start: 11 * 60, end: 16 * 60 },
  { id: "evening", label: "Evening", start: 16 * 60, end: 22 * 60 },
];

export const CATEGORIES = ["Café / coffee", "Restaurant / bar", "Fashion retail", "Hotel / lobby", "Gym / studio", "Salon / spa", "Other"];

// Colours for a brand with no logo yet, chosen from its category (a gym shouldn't get café colours).
const CATEGORY_PALETTES: Record<string, RGB[]> = {
  "Café / coffee": [[0.122, 0.165, 0.267], [0.784, 0.333, 0.239], [0.541, 0.639, 0.6], [0.949, 0.91, 0.835]],
  "Restaurant / bar": [[0.227, 0.063, 0.125], [0.788, 0.635, 0.153], [0.122, 0.231, 0.184], [0.949, 0.827, 0.541]],
  "Fashion retail": [[0.082, 0.082, 0.082], [1.0, 0.353, 0.306], [0.357, 0.42, 0.549], [0.957, 0.776, 0.753]],
  "Hotel / lobby": [[0.078, 0.129, 0.239], [0.612, 0.42, 0.235], [0.165, 0.498, 0.502], [0.898, 0.827, 0.702]],
  "Gym / studio": [[0.067, 0.078, 0.094], [0.184, 0.42, 1.0], [0.541, 0.588, 0.639], [0.776, 0.957, 0.196]],
  "Salon / spa": [[0.231, 0.137, 0.251], [0.91, 0.627, 0.659], [0.639, 0.722, 0.627], [0.953, 0.933, 0.902]],
  "Other": [[0.114, 0.165, 0.353], [0.412, 0.624, 1.0], [0.498, 0.82, 0.725], [0.851, 0.831, 0.8]],
};
export const brandPalette = (b: Brand): RGB[] => (b.assets.some((x) => x.kind === "logo") ? b.palette : CATEGORY_PALETTES[b.category] ?? b.palette);

export const VOICES = ["Aria · warm, British", "Leo · calm, American", "Maya · bright, Australian", "Noah · deep, British"];

const think = (ms = 900) => new Promise((r) => setTimeout(r, ms));
const id = () => Math.random().toString(36).slice(2, 9);
const kind = (c: string) => (c.startsWith("Café") ? "cafe" : c.startsWith("Restaurant") ? "restaurant" : c.startsWith("Fashion") ? "fashion" : "generic");

// when each suggested group tends to be in (minutes since midnight)
const PEAKS: Record<string, [number, number][]> = {
  "Morning regulars": [[420, 540]],
  "Remote workers": [[600, 960]],
  "Weekend brunch groups": [[600, 780]],
  "After-work crowd": [[1020, 1200]],
  "Date night": [[1140, 1320]],
  "Family lunch": [[720, 900]],
  "Trend-led browsers": [[780, 1080]],
  "Considered shoppers": [[720, 840]],
  "Gift buyers": [[660, 1020]],
  "Regulars": [[420, 600], [1020, 1140]],
  "First-time visitors": [[660, 1080]],
  "Quick visits": [[720, 840]],
};

export async function suggestSegments(b: Brand): Promise<Segment[]> {
  await think();
  const s: Record<string, [string, string, string, string][]> = {
    cafe: [
      ["Morning regulars", "25–40", "Weekdays 7–9am", "Quick, friendly, the same order every day"],
      ["Remote workers", "22–35", "Late morning to mid afternoon", "Somewhere calm to focus for a few hours"],
      ["Weekend brunch groups", "25–45", "Sat–Sun 10am–1pm", "A lively table and something worth posting"],
    ],
    restaurant: [
      ["After-work crowd", "25–40", "Weekdays 5–8pm", "A drink and some energy after a long day"],
      ["Date night", "28–45", "Thu–Sat 7–10pm", "Intimacy, good lighting, no rush"],
      ["Family lunch", "30–55", "Weekends 12–3pm", "Relaxed, easy, nothing too loud"],
    ],
    fashion: [
      ["Trend-led browsers", "18–30", "Afternoons and Saturdays", "Discovery and a reason to stay longer"],
      ["Considered shoppers", "30–45", "Weekday lunchtimes", "Calm space to try things on"],
      ["Gift buyers", "25–55", "Weekends, holiday season", "Help deciding, quickly"],
    ],
    generic: [
      ["Regulars", "25–45", "Weekdays", "Familiarity and a warm welcome"],
      ["First-time visitors", "20–40", "Weekends", "A clear sense of what you're about"],
      ["Quick visits", "25–55", "Lunchtimes", "Fast, easy, pleasant"],
    ],
  };
  return s[kind(b.category)].map(([name, ages, when, wants]) => ({ id: id(), name, ages, when, wants, kept: true, peak: PEAKS[name] }));
}

export async function draftBrandMap(b: Brand, segs: Segment[]): Promise<BrandMap> {
  await think(1100);
  const k = kind(b.category);
  const who = segs.filter((s) => s.kept).map((s) => s.name.toLowerCase());
  const m: Record<string, BrandMap> = {
    cafe: {
      product: { summary: "Specialty coffee and simple, good food", traits: ["Specialty coffee", "Seasonal", "Handmade"] },
      organisation: { summary: "A local, independent shop that cares about craft", traits: ["Local", "Independent", "Craft"] },
      person: { summary: "Warm and unhurried, like a friend who remembers your order", traits: ["Warm", "Unhurried", "Friendly"] },
      symbol: { summary: `The ${b.name} name and the feel of the room`, traits: ["Natural light", "Ceramic cups", "Soft wood"] },
    },
    restaurant: {
      product: { summary: "Food and drink made to share", traits: ["Seasonal menu", "Natural wine", "Sharing plates"] },
      organisation: { summary: "Chef-led and proud of the neighbourhood", traits: ["Chef-led", "Neighbourhood", "Generous"] },
      person: { summary: "Confident, convivial, a little glamorous after dark", traits: ["Convivial", "Confident", "Glamorous"] },
      symbol: { summary: "Candlelight, the open kitchen, the clink of glasses", traits: ["Candlelight", "Open kitchen", "Brass"] },
    },
    fashion: {
      product: { summary: "Modern essentials with a point of view", traits: ["Modern", "Essentials", "Quality fabrics"] },
      organisation: { summary: "Design-led and trend-aware", traits: ["Design-led", "Trend-aware", "Sustainable"] },
      person: { summary: "Self-assured, stylish, never trying too hard", traits: ["Stylish", "Self-assured", "Playful"] },
      symbol: { summary: "Clean lines, bold windows, the logo on the bag", traits: ["Clean lines", "Bold windows", "Monochrome"] },
    },
    generic: {
      product: { summary: b.description.slice(0, 80) || "What you sell and how it's made", traits: ["Quality", "Care", "Consistency"] },
      organisation: { summary: "Who you are as a business", traits: ["Local", "Trusted"] },
      person: { summary: "If your brand were a person, they'd be…", traits: ["Welcoming", "Calm", "Confident"] },
      symbol: { summary: "The look and feel people remember", traits: ["Your logo", "Your space"] },
    },
  };
  const map = structuredClone(m[k]);
  if (who.length) map.person.summary += `, for ${who.slice(0, 2).join(" and ")}`;
  return map;
}

export async function draftSoundboard(b: Brand, map: BrandMap): Promise<Soundboard> {
  await think();
  const base: Record<string, Soundboard> = {
    cafe: { energy: 48, tempo: 92, warmth: 80, vocals: 35, genres: ["Bossa", "Lo-fi", "Acoustic", "Jazz"], avoid: ["Indie pop"] },
    restaurant: { energy: 52, tempo: 96, warmth: 78, vocals: 45, genres: ["Jazz", "Soul", "Neo-soul", "Downtempo"], avoid: ["Ambient"] },
    fashion: { energy: 70, tempo: 114, warmth: 52, vocals: 55, genres: ["French house", "Indie pop", "Neo-soul"], avoid: ["Classical crossover"] },
    generic: { energy: 55, tempo: 100, warmth: 65, vocals: 40, genres: ["Acoustic", "Jazz", "Downtempo"], avoid: [] },
  };
  const sb = { ...base[kind(b.category)] };
  if (b.category.startsWith("Gym")) Object.assign(sb, { energy: 80, tempo: 122, genres: ["French house", "Funk", "Indie pop"] });
  if (map.person.traits.some((t) => /calm|unhurried/i.test(t))) sb.energy -= 4;
  return sb;
}

const OFFSET: Record<DaypartId, { e: number; t: number; w: number }> = {
  morning: { e: -12, t: -8, w: 5 },
  midday: { e: 10, t: 8, w: -5 },
  evening: { e: -8, t: -6, w: 8 },
};

export function score(t: Track, sb: Soundboard, part: DaypartId) {
  const o = OFFSET[part];
  const d =
    (Math.abs(t.energy - (sb.energy + o.e)) / 100) * 0.35 +
    (Math.abs(t.bpm - (sb.tempo + o.t)) / 60) * 0.3 +
    (Math.abs(t.warmth - (sb.warmth + o.w)) / 100) * 0.2 +
    (Math.abs(t.vocals - sb.vocals) / 100) * 0.15 -
    (sb.genres.includes(t.genre) ? 0.08 : 0);
  return Math.max(40, Math.min(99, Math.round(100 - d * 220)));
}

function why(t: Track, map: BrandMap | null, part: Daypart) {
  const n = parseInt(t.id.slice(1)) || 0;
  const pick = <T,>(xs: T[]) => xs[n % xs.length];
  const person = map?.person.traits ?? ["welcoming"], org = map?.organisation.traits ?? ["local"], sym = map?.symbol.traits ?? ["your space"];
  const trait = pick(person).toLowerCase();
  const moment = { morning: "first coffees and slow starts", midday: "the lunchtime rush", evening: "the room winding down" }[part.id];
  const feel = t.energy < 45 ? "calm enough to talk over" : t.energy < 65 ? "keeps a steady pace" : "lifts the room";
  const voice = t.vocals < 15 ? "No vocals, so it sits under conversation" : t.vocals > 60 ? "A warm voice up front" : "Light vocals";
  return pick([
    `${t.desc} that feels ${trait}; ${feel} for ${moment}`,
    `${voice}; suits a ${org[n % org.length].toLowerCase()} place during ${moment}`,
    `Matches the ${sym[n % sym.length].toLowerCase()} feel; ${feel}`,
    `${feel[0].toUpperCase() + feel.slice(1)}, and ${trait} like your brand`,
  ]);
}

// Ranks the library for a daypart; `exclude` is never picked, `jitter` adds variety for regenerate.
export function rank(p: Pick<Project, "soundboard" | "brandMap" | "banned">, part: DaypartId, exclude: string[] = [], jitter = 0): Track[] {
  const sb = p.soundboard!;
  const dp = DAYPARTS.find((d) => d.id === part)!;
  return LIBRARY.filter((t) => !sb.avoid.includes(t.genre) && !p.banned.includes(t.id) && !exclude.includes(t.id))
    .map((t) => ({ ...t, fit: score(t, sb, part) + Math.random() * jitter, why: why(t, p.brandMap, dp) }))
    .sort((a, b) => b.fit - a.fit)
    .map((t) => ({ ...t, fit: Math.min(99, Math.round(t.fit)) }));
}

export async function pickVibe(p: Project, part: DaypartId, keep: Track[] = [], exclude: string[] = []): Promise<Track[]> {
  await think(700);
  const eligible = rank(p, part);
  const eligibleIds = new Set(eligible.map((t) => t.id));
  const pinned = [...new Map(keep.filter((t) => eligibleIds.has(t.id)).map((t) => [t.id, t])).values()].slice(0, 5);
  const picks = rank(p, part, [...exclude, ...pinned.map((t) => t.id)], exclude.length ? 8 : 0).slice(0, 5 - pinned.length);
  const selected = [...pinned, ...picks];
  // Prefer fresh matches; retain eligible previous songs if the catalogue is small.
  const ids = new Set(selected.map((t) => t.id));
  return [...selected, ...eligible.filter((t) => !ids.has(t.id)).slice(0, 5 - selected.length)];
}

export async function draftPromos(b: Brand): Promise<Promo[]> {
  await think();
  const n = b.name || "us";
  return [
    { id: id(), title: "Welcome", script: `Good morning, and welcome to ${n}. Take your time, we're glad you're here.`, voice: VOICES[0], times: [8 * 60], days: [0, 1, 2, 3, 4, 5, 6] },
    { id: id(), title: "Loyalty card", script: `Ask at the counter about the ${n} loyalty card. Every tenth visit is on us.`, voice: VOICES[0], times: [12 * 60 + 30, 15 * 60], days: [0, 1, 2, 3, 4] },
    { id: id(), title: "Weekend special", script: `This weekend at ${n}: something new on the menu. Ask the team what's good today.`, voice: VOICES[2], times: [10 * 60, 17 * 60], days: [4, 5, 6] },
    { id: id(), title: "Closing soon", script: `${n} closes in thirty minutes. Thanks for spending your day with us.`, voice: VOICES[1], times: [21 * 60 + 30], days: [0, 1, 2, 3, 4, 5, 6] },
  ];
}

// The playable schedule for one day: approved vibe songs first, then the next-best matches.
export function buildDay(p: Project, day: number) {
  return DAYPARTS.map((dp) => {
    const approved = p.vibe?.[dp.id].tracks.filter((t) => !p.banned.includes(t.id)) ?? [];
    const rest = rank(p, dp.id, approved.map((t) => t.id)).slice(0, 12);
    // ponytail: rotate by day so the week isn't identical; real scheduler would balance repeats across the week
    const more = [...rest.slice(day % 4), ...rest.slice(0, day % 4)].slice(0, 7);
    return { part: dp, tracks: (p.scheduleEdits?.[day]?.[dp.id] ?? [...approved, ...more]).filter((t) => !p.banned.includes(t.id)), promos: p.promos.filter((x) => x.days.includes(day) && x.times.some((m) => m >= dp.start && m < dp.end)) };
  });
}

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const fmtClock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

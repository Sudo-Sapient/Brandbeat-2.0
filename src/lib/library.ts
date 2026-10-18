import type { Track } from "./types";

// FPO music library. In production this is the licensed catalogue (or Lyria output) with the same fields.
// [title, desc, genre, bpm, energy, warmth, vocals]
const RAW: [string, string, string, number, number, number, number][] = [
  ["Golden Hour Haze", "Warm Rhodes, brushed kit", "Lo-fi", 84, 42, 88, 10],
  ["Linen Morning", "Nylon guitar, soft vocal", "Acoustic", 90, 48, 84, 60],
  ["Oat & Honey", "Lo-fi piano", "Lo-fi", 78, 35, 80, 0],
  ["Window Seat", "Bossa, upright bass", "Bossa", 92, 52, 79, 30],
  ["First Light", "Ambient strings", "Ambient", 72, 30, 74, 0],
  ["Sunday Paper", "Acoustic duo", "Acoustic", 86, 44, 86, 70],
  ["Copper Kettle", "Jazz guitar, light swing", "Jazz", 96, 54, 81, 0],
  ["Market Street", "Light funk, horns", "Funk", 104, 66, 70, 20],
  ["Citrus Peel", "Indie pop, claps", "Indie pop", 112, 72, 62, 80],
  ["Corner Table", "Neo-soul groove", "Neo-soul", 96, 58, 76, 70],
  ["Afternoon Glass", "French house, mellow", "French house", 118, 68, 58, 20],
  ["Long Lunch", "Jazz trio", "Jazz", 108, 60, 78, 0],
  ["Tram Lines", "Bossa nova, brushes", "Bossa", 100, 58, 80, 40],
  ["Low Lamps", "Downtempo, vinyl hiss", "Downtempo", 88, 46, 82, 10],
  ["Velvet Hour", "Late-night soul", "Soul", 82, 40, 86, 80],
  ["Moon Over Tile", "Slow bossa", "Bossa", 76, 34, 84, 30],
  ["Last Pour", "Ambient piano", "Ambient", 70, 28, 80, 0],
  ["Closing Credits", "Strings, slow fade", "Classical crossover", 64, 22, 76, 0],
  ["Night Bus Home", "Lo-fi soul", "Lo-fi", 80, 38, 83, 40],
  ["Paper Lanterns", "Kalimba and pads", "Ambient", 74, 32, 78, 0],
  ["Cobblestone", "Gypsy jazz, quick swing", "Jazz", 126, 74, 72, 0],
  ["Blue Awning", "Indie folk, whistles", "Acoustic", 102, 56, 82, 70],
  ["Saturday Racks", "Disco house, bright", "French house", 122, 82, 50, 40],
  ["Mirror Mirror", "Electro pop, glossy", "Indie pop", 116, 78, 44, 80],
  ["Runway Lights", "Minimal house", "French house", 124, 76, 40, 10],
  ["Silk Lining", "R&B, airy vocal", "Neo-soul", 92, 54, 70, 90],
  ["Fitting Room", "Chillwave", "Downtempo", 98, 50, 60, 30],
  ["Tailored", "Nu-jazz, vibraphone", "Jazz", 110, 62, 66, 0],
  ["Linen & Lime", "Tropical house", "French house", 114, 70, 64, 30],
  ["Second Glass", "Cocktail lounge", "Jazz", 94, 48, 80, 50],
  ["Candle Wax", "Slow soul ballad", "Soul", 72, 30, 90, 90],
  ["Ember Room", "Downtempo, cello", "Downtempo", 86, 42, 84, 0],
  ["Spice Route", "Afro-jazz groove", "Funk", 106, 70, 74, 20],
  ["Harbour Wind", "Acoustic guitar instrumental", "Acoustic", 88, 40, 86, 0],
  ["Sous Chef", "Funk breaks, organ", "Funk", 100, 68, 72, 0],
  ["Quiet Hour", "Felt piano", "Classical crossover", 66, 20, 82, 0],
  ["Neon Bloom", "Synth pop", "Indie pop", 120, 80, 42, 70],
  ["Morning Ritual", "Soft house, warm pads", "French house", 108, 52, 70, 10],
  ["Tidewater", "Bossa, flute", "Bossa", 94, 50, 82, 0],
  ["Basement Keys", "Neo-soul instrumental", "Neo-soul", 88, 50, 78, 0],
];

export const LIBRARY: Track[] = RAW.map(([title, desc, genre, bpm, energy, warmth, vocals], i) => ({
  id: `t${i}`,
  title,
  desc,
  genre,
  bpm,
  energy,
  warmth,
  vocals,
}));

export const GENRES = [...new Set(RAW.map((r) => r[2]))];

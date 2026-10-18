// Browser-only helpers: logo palette, FPO audio, voice preview.
import type { RGB, Track } from "./types";

const lum = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Dominant colours from a logo/photo, darkest first. Real, not mocked.
export async function extractPalette(file: File, fallback: RGB[]): Promise<RGB[]> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, 64, 64);
  const px = ctx.getImageData(0, 0, 64, 64).data;
  const buckets = new Map<number, { n: number; rgb: [number, number, number] }>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (r > 240 && g > 240 && b > 240) continue; // skip paper-white backgrounds
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) ?? { n: 0, rgb: [0, 0, 0] };
    e.n++;
    e.rgb[0] += r; e.rgb[1] += g; e.rgb[2] += b;
    buckets.set(key, e);
  }
  const picked: RGB[] = [];
  const distinct = (col: RGB) => picked.every((p) => Math.hypot(p[0] - col[0], p[1] - col[1], p[2] - col[2]) > 0.25);
  for (const { n, rgb } of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const col = rgb.map((v) => v / n / 255) as RGB;
    if (distinct(col)) picked.push(col);
    if (picked.length === 4) break;
  }
  // a one- or two-colour logo still needs four: tint its own colours first, then the fallback
  for (const c of [...picked]) {
    const tint = c.map((v) => v + (1 - v) * 0.75) as RGB;
    if (picked.length < 4 && distinct(tint)) picked.push(tint);
  }
  for (const f of fallback) if (picked.length < 4 && distinct(f)) picked.push(f);
  while (picked.length < 4) picked.push(fallback[picked.length]);
  return picked.sort((a, b) => lum(a) - lum(b));
}

// Lights the brand palette for a daypart: [base, highlight, accent] for the aurora shader.
export function lightFor(palette: RGB[], part: string): [RGB, RGB, RGB] {
  const [dark, m1, m2, light] = [...palette].sort((a, b) => lum(a) - lum(b));
  const mix = (a: RGB, b: RGB, t: number) => a.map((v, i) => v + (b[i] - v) * t) as RGB;
  if (part === "morning") return [mix(m1, light, 0.35), light, m2];
  if (part === "midday") return [m2, mix(light, [1, 1, 1], 0.4), mix(m1, m2, 0.3)];
  return [dark, m1, mix(m2, dark, 0.4)];
}

export const toHex = (c: RGB) => "#" + c.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");

/* ---------- FPO audio: a soft generated loop per track (stands in for real songs) ---------- */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export function setVolume(v: number) {
  if (master) master.gain.value = (v / 100) * 0.25;
}

export function stopFpo() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function playFpo(t: Track, volume = 70) {
  stopFpo();
  ctx ??= new AudioContext();
  void ctx.resume();
  if (!master) {
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  setVolume(volume);
  const ac = ctx, out = master;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3200 - t.warmth * 24; // warmer = mellower
  filter.connect(out);
  // key from the track id so each song sounds different
  const root = 196 * 2 ** ((parseInt(t.id.slice(1)) % 7) / 12);
  const chord = [1, 5 / 4, 3 / 2, 15 / 8, 2];
  const beat = 60 / t.bpm;
  let step = 0;
  const note = () => {
    const f = root * chord[(step * 3) % chord.length] * (step % 8 < 4 ? 1 : 0.75);
    const o = ac.createOscillator(), g = ac.createGain(), now = ac.currentTime;
    o.type = t.energy > 60 ? "triangle" : "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.5, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + beat * 1.8);
    o.connect(g).connect(filter);
    o.start(now);
    o.stop(now + beat * 2);
    step++;
  };
  note();
  // livelier songs play every beat, calmer ones every other beat
  timer = setInterval(note, beat * (t.energy > 50 ? 1000 : 2000));
}

/* ---------- Voice preview (stands in for Voicemaker) ---------- */
export function speak(text: string, voiceIndex = 0) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  if (voices.length) u.voice = voices[voiceIndex % voices.length];
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

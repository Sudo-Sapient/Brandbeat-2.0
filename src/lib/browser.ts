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
// The loop reads its settings on every note, so a fader can change tempo, warmth, energy or vocals while it plays.
// An analyser sits before the speakers, so meters and visuals show the real sound.
type Sound = Pick<Track, "id" | "bpm" | "energy" | "warmth" | "vocals">;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let filter: BiquadFilterNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let cur: Sound | null = null;
let step = 0;
let lastNote = 0;

export function setVolume(v: number) {
  if (master) master.gain.value = (v / 100) * 0.25;
}

export function stopFpo() {
  if (timer) clearInterval(timer);
  timer = null;
  cur = null;
}

const interval = (t: Sound) => (60 / t.bpm) * (t.energy > 50 ? 1000 : 2000); // livelier songs play every beat

function note() {
  if (!ctx || !filter || !cur) return;
  const t = cur, ac = ctx, beat = 60 / t.bpm, now = ac.currentTime;
  // key from the track id so each song sounds different
  const root = 196 * 2 ** ((parseInt(t.id.slice(1)) % 7) / 12);
  const chord = [1, 5 / 4, 3 / 2, 15 / 8, 2];
  const f = root * chord[(step * 3) % chord.length] * (step % 8 < 4 ? 1 : 0.75);
  const voice = (freq: number, type: OscillatorType, level: number, len: number) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(level, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + beat * len);
    o.connect(g).connect(filter!);
    o.start(now);
    o.stop(now + beat * (len + 0.2));
    return o;
  };
  voice(f, t.energy > 60 ? "triangle" : "sine", 0.5, 1.8);
  // a "singer": a higher line with vibrato, louder the more vocals the board asks for
  if (t.vocals > 15 && step % 2 === 0) {
    const o = voice(f * 2, "sine", (t.vocals / 100) * 0.35, 1.4);
    const lfo = ac.createOscillator(), depth = ac.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = 6;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(now);
    lfo.stop(now + beat * 1.6);
  }
  step++;
  lastNote = performance.now();
}

export function playFpo(t: Sound, volume = 70) {
  stopFpo();
  ctx ??= new AudioContext();
  void ctx.resume();
  if (!master) {
    master = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    master.connect(analyser).connect(ctx.destination);
  }
  setVolume(volume);
  filter?.disconnect();
  filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.connect(master);
  cur = { ...t };
  updateFpo(t);
  note();
  timer = setInterval(note, interval(cur));
}

// change the playing loop in place (fader moves); tempo or energy changes re-time the beat
export function updateFpo(patch: Partial<Sound>) {
  if (!cur || !filter || !ctx) return;
  const before = interval(cur);
  Object.assign(cur, patch);
  filter.frequency.setTargetAtTime(3200 - cur.warmth * 24, ctx.currentTime, 0.08); // warmer = mellower
  if (timer && interval(cur) !== before) {
    clearInterval(timer);
    timer = setInterval(note, interval(cur));
  }
}

let bins: Uint8Array<ArrayBuffer> | null = null;
// live levels for meters and visuals, 0..1: overall, low, mid, high, and a beat pulse that decays after each note
export function getLevels() {
  const out = { all: 0, low: 0, mid: 0, high: 0, beat: 0 };
  if (!analyser || !cur) return out;
  const buf = (bins ??= new Uint8Array(analyser.frequencyBinCount));
  analyser.getByteFrequencyData(buf);
  const avg = (a: number, b: number) => buf.slice(a, b).reduce((s, v) => s + v, 0) / ((b - a) * 255);
  out.low = avg(1, 8); out.mid = avg(8, 32); out.high = avg(32, 96); out.all = avg(1, 96);
  out.beat = Math.max(0, 1 - (performance.now() - lastNote) / 350);
  return out;
}

export const isFpoPlaying = () => !!cur;

/* ---------- Voice preview (stands in for Voicemaker) ---------- */
// onWord gets the character index of each word as it's spoken (browser voices report word boundaries;
// for voices that don't, words are paced out by length so the highlight still follows along)
// only the latest utterance may report: cancelling one fires its onend/onerror late, after the next has started
let currentUtterance: SpeechSynthesisUtterance | null = null;
export function speak(text: string, voiceIndex = 0, cb: { onWord?: (charIndex: number) => void; onEnd?: () => void } = {}) {
  if (!("speechSynthesis" in window)) { cb.onEnd?.(); return () => {}; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  currentUtterance = u;
  const live = () => currentUtterance === u;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  if (voices.length) u.voice = voices[voiceIndex % voices.length];
  u.rate = 0.95;
  let heard = false, fallback: ReturnType<typeof setTimeout> | null = null;
  u.onboundary = (e) => { if (live() && e.name === "word") { heard = true; cb.onWord?.(e.charIndex); } };
  u.onstart = () => {
    // no boundary events within half a second: pace the words ourselves
    fallback = setTimeout(function pace() {
      if (heard || !live()) return;
      const starts = [...text.matchAll(/\S+/g)].map((m) => m.index ?? 0);
      let i = 0;
      const nextWord = () => {
        if (heard || !live() || i >= starts.length) return;
        cb.onWord?.(starts[i]);
        const len = text.slice(starts[i]).split(/\s/)[0].length;
        i++;
        fallback = setTimeout(nextWord, 120 + len * 55);
      };
      nextWord();
    }, 500);
  };
  u.onend = u.onerror = () => { if (fallback) clearTimeout(fallback); if (live()) { currentUtterance = null; cb.onEnd?.(); } };
  speechSynthesis.speak(u);
  return () => {
    if (fallback) clearTimeout(fallback);
    if (live()) { currentUtterance = null; speechSynthesis.cancel(); }
  };
}

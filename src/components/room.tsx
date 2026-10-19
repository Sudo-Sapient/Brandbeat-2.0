"use client";
// "Who's in the room": each kept customer group is a colour of dots that walks in through the door
// when that group tends to visit, mills about, and drifts out again. A day slider (07:00–22:00) drives it.
import { useEffect, useRef, useState } from "react";
import { fmtClock } from "@/lib/ai";
import { Icon, reducedMotion } from "./ui";
import type { Segment } from "@/lib/types";

const OPEN = 7 * 60, CLOSE = 22 * 60;
const PER_GROUP = 16;

// when a group is likely in: its own peaks, or a guess from the words used to describe it
export function peaksFor(s: Segment): [number, number][] {
  if (s.peak?.length) return s.peak;
  const w = `${s.when} ${s.name}`.toLowerCase();
  const out: [number, number][] = [];
  if (/morning|breakfast|commut|7|8am|9am/.test(w)) out.push([7 * 60, 11 * 60]);
  if (/lunch|midday|noon/.test(w)) out.push([11 * 60 + 30, 14 * 60]);
  if (/afternoon/.test(w)) out.push([13 * 60, 17 * 60]);
  if (/evening|night|after work|dinner|5pm|6pm|7pm/.test(w)) out.push([17 * 60, 21 * 60 + 30]);
  return out.length ? out : [[OPEN, CLOSE]];
}
const presence = (s: Segment, m: number) => (peaksFor(s).some(([a, b]) => m >= a && m < b) ? 1 : 0.12);

type Dot = { g: string; x: number; y: number; vx: number; vy: number; tx: number; ty: number; leaving: boolean };
// somewhere to stand: anywhere in the room, away from the door
const spot = () => ({ tx: 0.15 + Math.random() * 0.8, ty: 0.14 + Math.random() * 0.72 });

export function Room({ segments, colours }: { segments: Segment[]; colours: Record<string, string> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [clock, setClock] = useState(OPEN);
  const [sweeping, setSweeping] = useState(true);
  const live = useRef({ clock: OPEN, shown: OPEN, kept: segments.filter((s) => s.kept), colours });
  live.current.kept = segments.filter((s) => s.kept);
  if (!sweeping) live.current.clock = clock;
  live.current.colours = colours;

  const timeEl = useRef<HTMLSpanElement>(null), scrubEl = useRef<HTMLInputElement>(null);

  // on arrival, play the day once so the room fills and empties in front of you.
  // The sweep writes the clock straight to the DOM; React only hears about the end.
  useEffect(() => {
    if (!sweeping) return;
    if (reducedMotion()) { setClock(13 * 60); setSweeping(false); return; }
    const start = performance.now(), from = OPEN, to = CLOSE - 1, dur = 6000;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const m = Math.round(from + (to - from) * k);
      live.current.clock = m;
      if (timeEl.current) timeEl.current.textContent = fmtClock(m);
      if (scrubEl.current) scrubEl.current.value = String(m);
      if (Math.floor(m / 30) !== Math.floor(live.current.shown / 30)) { live.current.shown = m; setClock(m); } // the "in now" line, twice an hour
      if (k < 1) raf = requestAnimationFrame(step);
      else { setSweeping(false); setClock(13 * 60); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sweeping]);

  useEffect(() => {
    const c = canvas.current!, ctx = c.getContext("2d")!;
    const dots: Dot[] = [];
    let raf = 0, last = performance.now();
    const rm = reducedMotion();
    const door = () => ({ x: 0.02, y: 0.5 + (Math.random() - 0.5) * 0.18 });
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dpr = Math.min(devicePixelRatio, 2), W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const { kept, clock: m } = live.current;
      // how many of each group should be here right now
      for (const s of kept) {
        const want = Math.round(PER_GROUP * presence(s, m));
        const here = dots.filter((d) => d.g === s.id && !d.leaving);
        if (here.length < want) { const d = door(), t = spot(); dots.push({ g: s.id, x: rm ? t.tx : d.x, y: rm ? t.ty : d.y, vx: 0, vy: 0, ...t, leaving: false }); }
        if (here.length > want) here[here.length - 1].leaving = true;
      }
      for (const d of dots) if (!kept.some((s) => s.id === d.g)) d.leaving = true;
      // move: wander inside, or head for the door when leaving
      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i];
        if (d.leaving) {
          d.vx += (0.0 - d.x) * 1.2 * dt; d.vy += (0.5 - d.y) * 1.2 * dt;
          if (d.x < 0.03 || rm) { dots.splice(i, 1); continue; }
        } else if (!rm) {
          // walk to your spot; once there, now and then wander to another
          d.vx += (d.tx - d.x) * 3 * dt; d.vy += (d.ty - d.y) * 3 * dt;
          if (Math.hypot(d.tx - d.x, d.ty - d.y) < 0.02 && Math.random() < dt * 0.25) Object.assign(d, spot());
        }
        d.vx *= 0.92; d.vy *= 0.92;
        if (!rm) { d.x += d.vx * dt; d.y += d.vy * dt; }
      }
      // draw: floor, door, people
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#181818";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 28 * dpr) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      ctx.fillStyle = "#699fff";
      ctx.fillRect(0, H * 0.38, 3 * dpr, H * 0.24);
      for (const d of dots) {
        ctx.globalAlpha = d.leaving ? 0.55 : 1;
        ctx.fillStyle = live.current.colours[d.g] ?? "#ffffff";
        ctx.beginPath(); ctx.arc(d.x * W, d.y * H, 5 * dpr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    // only animate while the room is on screen
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) { last = performance.now(); raf = requestAnimationFrame(frame); }
    });
    io.observe(c);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const kept = segments.filter((s) => s.kept);
  const busiest = [...kept].sort((a, b) => presence(b, clock) - presence(a, clock))[0];
  const inNow = kept.filter((s) => presence(s, clock) === 1);
  return (
    <section className="room" aria-label="Who is in the room across the day">
      <div className="room-head">
        <span className="room-time" ref={timeEl}>{fmtClock(clock)}</span>
        <span className="room-who" aria-live={sweeping ? "off" : "polite"}>
          {inNow.length ? <>In now: <b>{inNow.map((s) => s.name).join(", ")}</b></> : busiest ? <>Quiet. A few {busiest.name.toLowerCase()}.</> : "Keep a group to see your room."}
        </span>
        <button className="ic" onClick={() => setSweeping(true)} aria-label="Play the day again" title="Play the day again"><Icon id="refresh" /></button>
      </div>
      <canvas ref={canvas} className="room-floor" aria-hidden="true" />
      <div className="room-scrub">
        <label htmlFor="room-time" className="sr">Time of day</label>
        <input ref={scrubEl} id="room-time" type="range" min={OPEN} max={CLOSE - 1} value={clock} onChange={(e) => { setSweeping(false); setClock(+e.target.value); }} />
        <div className="room-axis"><span>07:00</span><span>11:00</span><span>16:00</span><span>22:00</span></div>
      </div>
      <ul className="room-key">
        {kept.map((s) => <li key={s.id}><i style={{ background: colours[s.id] }} />{s.name}</li>)}
      </ul>
    </section>
  );
}

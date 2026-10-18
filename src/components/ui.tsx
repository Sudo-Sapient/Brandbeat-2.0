"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useProject } from "@/lib/store";
import { lightFor } from "@/lib/browser";
import type { RGB } from "@/lib/types";

export const reducedMotion = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- icons: one drawn set, one stroke ---------- */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></symbol>
      <symbol id="i-pause" viewBox="0 0 24 24"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none" /></symbol>
      <symbol id="i-skip" viewBox="0 0 24 24"><path d="M5 5l9 7-9 7z" fill="currentColor" stroke="none" /><path d="M18 5v14" /></symbol>
      <symbol id="i-swap" viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3" /></symbol>
      <symbol id="i-pin" viewBox="0 0 24 24"><path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" /></symbol>
      <symbol id="i-ban" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M6.5 6.5l11 11" /></symbol>
      <symbol id="i-vol" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 9a4 4 0 010 6" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></symbol>
      <symbol id="i-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M19 12a7 7 0 11-2.05-4.95M19 4v4h-4" /></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
      <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></symbol>
      <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" /></symbol>
      <symbol id="i-back" viewBox="0 0 24 24"><path d="M20 12H5M11 6l-6 6 6 6" /></symbol>
      <symbol id="i-mic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></symbol>
    </svg>
  );
}
export const Icon = ({ id, size }: { id: string; size?: number }) => (
  <svg className="i" aria-hidden="true" style={size ? { width: size, height: size } : undefined}><use href={`#i-${id}`} /></svg>
);

/* ---------- app frame ---------- */
export const STEPS = [
  { n: 1, label: "Brand", href: "/setup/1" },
  { n: 2, label: "Customers", href: "/setup/2" },
  { n: 3, label: "Brand map", href: "/setup/3" },
  { n: 4, label: "Soundboard", href: "/setup/4" },
  { n: 5, label: "Vibe check", href: "/setup/5" },
  { n: 6, label: "Promos", href: "/setup/6" },
  { n: 7, label: "Week", href: "/week" },
  { n: 8, label: "Player", href: "/player" },
];

export function Shell({ step, crumbs, children }: { step?: number; crumbs?: { label: string; href?: string }[]; children: React.ReactNode }) {
  const { p } = useProject();
  const current = STEPS.find((s) => s.n === step);
  return (
    <div className="screen">
      <header className="top">
        <Link href="/" className="logo">brandbeat</Link>
        {p.brand.name && (
          <button className="venue" aria-label={`Switch venue, current: ${p.brand.name}`}>
            {p.brand.name} <Icon id="down" size={16} />
          </button>
        )}
        {crumbs ? (
          <ol className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <li key={c.label} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
              </li>
            ))}
          </ol>
        ) : (
          <>
            <ol className="steps" aria-label="Setup steps">
              {STEPS.map((s) => (
                <li key={s.n} className={s.n < (step ?? 0) ? "done" : undefined} aria-current={s.n === step ? "step" : undefined}>
                  {s.n <= p.step && s.n !== step ? <Link href={s.href}>{s.label}</Link> : s.label}
                </li>
              ))}
            </ol>
            {current && <span className="step-compact">Step {current.n} of 8 · {current.label}</span>}
          </>
        )}
      </header>
      {children}
    </div>
  );
}

/* ---------- one step page: headline, lede, body, proceed bar ---------- */
export function StepPage(props: {
  n: number;
  title: React.ReactNode;
  lede: string;
  children: React.ReactNode;
  next: { label: string; onClick: () => void; disabled?: boolean; status?: React.ReactNode };
  busy?: string[] | null;
}) {
  const prev = STEPS.find((s) => s.n === props.n - 1);
  return (
    <Shell step={props.n}>
      <div className="hero">
        <h1 className="serif">{props.title}</h1>
        <p>{props.lede}</p>
      </div>
      <div className="body">{props.children}</div>
      <div className="proceed">
        {props.busy ? <Thinking lines={props.busy} /> : <p aria-live="polite">{props.next.status}</p>}
        <div className="proceed-actions">
          {prev && <Link className="btn ghost" href={prev.href}><Icon id="back" size={16} />Back</Link>}
          <button className="btn" onClick={props.next.onClick} disabled={props.next.disabled || !!props.busy}>
            {props.next.label} <Icon id="arrow" size={16} />
          </button>
        </div>
      </div>
    </Shell>
  );
}

/* ---------- the AI at work: cycles plain-language status lines ---------- */
export function Thinking({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, lines.length - 1)), 700);
    return () => clearInterval(t);
  }, [lines]);
  useEffect(() => {
    if (ref.current && !reducedMotion()) gsap.fromTo(ref.current, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "expo.out" });
  }, [i]);
  return (
    <p className="thinking" role="status">
      <span className="pulse" aria-hidden="true" />
      <span ref={ref}>{lines[i]}</span>
    </p>
  );
}

/* ---------- Aurora: brand colours lit for the daypart; movement = energy, speed = tempo ---------- */
const FS = `precision mediump float;uniform vec2 r;uniform float t,warp;uniform vec3 c1,c2,c3;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=uv*2.2;
  float f=fbm(q+warp*fbm(q+t*.1)+t*.05);float g=fbm(q*1.4-t*.07);
  vec3 col=mix(c1,c2,smoothstep(.2,.8,f));col=mix(col,c3,smoothstep(.45,.9,g)*.85);
  gl_FragColor=vec4(col,1.);}`;

export function Aurora({ palette, part, energy = 50, bpm = 90, playing = true }: { palette: RGB[]; part: string; energy?: number; bpm?: number; playing?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const u = useRef({ c1: [0, 0, 0], c2: [0, 0, 0], c3: [0, 0, 0], warp: 1, speed: 1, playing: true, first: true });

  useEffect(() => {
    const canvas = cv.current!;
    const gl = canvas.getContext("webgl");
    if (!gl) return;
    const sh = (type: number, src: string) => { const o = gl.createShader(type)!; gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}"));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const l = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    const L = (k: string) => gl.getUniformLocation(pr, k);
    const [uR, uT, uW, u1, u2, u3] = ["r", "t", "warp", "c1", "c2", "c3"].map(L);
    let visible = true, t = 0, last = performance.now(), raf = 0;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    const rm = reducedMotion();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = u.current;
      if (s.playing && !rm) t += dt * s.speed; // paused music = still artwork
      if (visible && !document.hidden) {
        const dpr = Math.min(devicePixelRatio, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uR, w, h); gl.uniform1f(uT, t); gl.uniform1f(uW, s.warp);
        gl.uniform3fv(u1, s.c1); gl.uniform3fv(u2, s.c2); gl.uniform3fv(u3, s.c3);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  useEffect(() => {
    const s = u.current;
    const [a, b, c] = lightFor(palette, part);
    const d = s.first || reducedMotion() ? 0 : 1.8;
    s.first = false;
    (["c1", "c2", "c3"] as const).forEach((k, j) => gsap.to(s[k], { 0: [a, b, c][j][0], 1: [a, b, c][j][1], 2: [a, b, c][j][2], duration: d, ease: "sine.inOut" }));
    gsap.to(s, { warp: 0.3 + (energy / 100) * 2.2, speed: bpm / 80, duration: d, ease: "sine.inOut" });
  }, [palette, part, energy, bpm]);

  useEffect(() => { u.current.playing = playing; }, [playing]);

  return <canvas ref={cv} className="aurora" aria-hidden="true" />;
}

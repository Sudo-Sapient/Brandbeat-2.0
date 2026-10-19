"use client";
// Landing hero, React Three Fiber. The ritual: record slides out of the sleeve → turntable glides in →
// record travels onto the platter, sleeve leans behind → (tap) tonearm swings over and drops, platter spins up.
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getLevels, isFpoPlaying, lightFor, toHex } from "@/lib/browser";
import { reducedMotion } from "./ui";
import type { RGB } from "@/lib/types";

const VERT = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// same noise field as the 2D Aurora, sampled on the sleeve's UVs instead of the screen
const FRAG = `precision mediump float;varying vec2 vUv;uniform float t;uniform vec3 c1,c2,c3;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
void main(){vec2 q=vUv*2.2;float f=fbm(q+fbm(q+t*.1)+t*.05);float g=fbm(q*1.4-t*.07);
vec3 col=mix(c1,c2,smoothstep(.2,.8,f));col=mix(col,c3,smoothstep(.45,.9,g)*.85);gl_FragColor=vec4(col,1.);}`;

const reduced = reducedMotion;
const pageFont = () => (typeof window === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily);
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// choreography (seconds) and layout (world units)
const T = { out: [0.4, 1.2], deck: [0.9, 1.9], travel: [1.7, 2.5], ready: 2.6 };
const PLATTER = v3(0.35, -0.02, 0.1); // platter centre, on top of the plinth
const SLEEVE_START = { pos: v3(-0.55, 0, 0), rot: 0, scale: 1 };
const SLEEVE_REST = { pos: v3(-1.45, 0.12, -0.35), rot: 0.07, scale: 0.78 };
const PIVOT = v3(PLATTER.x + 1.12, 0.82, 0); // tonearm pivot, top-right of the deck
const ARM_LEN = 1.18;

// Draw onto a canvas once and hand it to three as a texture (sleeve print, record label, shadow, sheen).
function useCanvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, deps: unknown[]) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d")!, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

// the arm angle (from straight down) that puts the stylus at a given radius on the record
function angleForRadius(r: number) {
  let best = 0, err = Infinity;
  for (let a = 0; a < 1.4; a += 0.002) {
    const tip = v3(PIVOT.x - ARM_LEN * Math.sin(a), PIVOT.y - ARM_LEN * Math.cos(a), 0);
    const e = Math.abs(Math.hypot(tip.x - PLATTER.x, tip.y - PLATTER.y) - r);
    if (e < err) { err = e; best = a; }
  }
  return best;
}
const ARM_REST = 0.04, ARM_OUTER = angleForRadius(0.9), ARM_INNER = angleForRadius(0.42);

type Clock = { t: number; play: number; speed: number };

function Sleeve({ palette, part, name, clock }: { palette: RGB[]; part: string; name: string; clock: React.MutableRefObject<Clock> }) {
  const g = useRef<THREE.Group>(null);
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { t: { value: 0 }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() } } }),
    []
  );
  const target = useMemo(() => lightFor(palette, part).map((c) => new THREE.Color(...c)), [palette, part]);
  const first = useRef(true);
  useFrame((_, dt) => {
    if (!reduced()) mat.uniforms.t.value += dt * 0.8;
    (["c1", "c2", "c3"] as const).forEach((k, i) => (first.current ? mat.uniforms[k].value.copy(target[i]) : mat.uniforms[k].value.lerp(target[i], Math.min(1, dt * 2))));
    first.current = false;
    // once the record is out, the sleeve steps back and leans behind the deck
    const k = seg(clock.current.t, T.deck[0], T.deck[1]);
    g.current!.position.lerpVectors(SLEEVE_START.pos, SLEEVE_REST.pos, k);
    g.current!.rotation.z = THREE.MathUtils.lerp(SLEEVE_START.rot, SLEEVE_REST.rot, k);
    g.current!.scale.setScalar(THREE.MathUtils.lerp(SLEEVE_START.scale, SLEEVE_REST.scale, k));
  });
  const print = useCanvasTexture(1024, (ctx, s) => {
    const f = pageFont();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = s * 0.02;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = `700 ${s * 0.075}px ${f}`;
    ctx.fillText(name.toUpperCase(), s * 0.07, s * 0.92);
    ctx.font = `400 ${s * 0.032}px ${f}`;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("Side A · 07:00–22:00", s * 0.07, s * 0.82);
    ctx.textAlign = "right";
    ctx.fillText("brandbeat", s * 0.93, s * 0.1);
  }, [name]);
  return (
    <group ref={g}>
      <RoundedBox args={[2, 2, 0.04]} radius={0.015} smoothness={3} material={mat} />
      <mesh position-z={0.032}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial map={print} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

function Record({ palette, name, clock, swapKey }: { palette: RGB[]; name: string; clock: React.MutableRefObject<Clock>; swapKey?: string }) {
  const g = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const rings = [0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9];
  const labelColour = toHex(palette[1] ?? [0.8, 0.4, 0.3]);
  const label = useCanvasTexture(512, (ctx, s) => {
    const f = pageFont();
    ctx.fillStyle = labelColour;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.textAlign = "center";
    ctx.font = `700 ${s * 0.1}px ${f}`;
    ctx.fillText(name.toUpperCase(), s / 2, s * 0.33);
    ctx.font = `400 ${s * 0.065}px ${f}`;
    ctx.fillText("33⅓ · Side A", s / 2, s * 0.76);
  }, [name, labelColour]);
  const sheen = useCanvasTexture(512, (ctx, s) => {
    const gr = ctx.createConicGradient(-Math.PI / 4, s / 2, s / 2);
    [[0, 0], [0.06, 0.16], [0.13, 0], [0.5, 0], [0.56, 0.1], [0.63, 0]].forEach(([at, a]) => gr.addColorStop(at, `rgba(255,255,255,${a})`));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
  }, []);

  const inSleeve = v3(SLEEVE_START.pos.x, 0, -0.04), outOfSleeve = v3(0.25, 0, -0.04);
  const lifted = v3(PLATTER.x, PLATTER.y, 0.45);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  // record change: when the song changes, this one slides off right and the next slides in from the left
  const swap = useRef({ key: swapKey, t: 9 });
  if (swap.current.key !== swapKey) swap.current = { key: swapKey, t: 0 };
  useFrame((_, dt) => {
    const c = clock.current;
    swap.current.t += dt;
    // out of the sleeve, then up and over onto the platter, then down with a tiny settle
    const kOut = seg(c.t, T.out[0], T.out[1]);
    const kTravel = seg(c.t, T.travel[0], T.travel[1]);
    tmp.lerpVectors(inSleeve, outOfSleeve, kOut);
    if (kTravel > 0) {
      const mid = tmp.clone().lerp(lifted, Math.min(1, kTravel * 1.6));
      tmp.copy(mid.lerp(PLATTER, Math.max(0, kTravel - 0.55) / 0.45));
      tmp.z += Math.sin(Math.PI * kTravel) * 0.12;
    }
    g.current!.position.copy(tmp);
    const settle = c.t > T.travel[1] && c.t < T.travel[1] + 0.3 ? Math.sin(((c.t - T.travel[1]) / 0.3) * Math.PI) * 0.015 : 0;
    g.current!.position.z += settle;
    const st = reduced() ? 9 : swap.current.t;
    if (st < 0.8) {
      const out = st < 0.4 ? ease(st / 0.4) * 2.6 : -2.6 * (1 - ease((st - 0.4) / 0.4));
      g.current!.position.x += out;
      g.current!.position.z += Math.sin((st / 0.8) * Math.PI) * 0.3;
    }
    spin.current!.rotation.z -= dt * c.speed;
  });
  return (
    <group ref={g}>
      <group ref={spin}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.96, 0.96, 0.02, 96]} />
          <meshStandardMaterial color="#0c0c0c" roughness={0.32} metalness={0.25} />
        </mesh>
        {rings.map((r) => (
          <mesh key={r} position-z={0.011}>
            <ringGeometry args={[r, r + 0.005, 96]} />
            <meshBasicMaterial color="#262626" />
          </mesh>
        ))}
        <mesh position-z={0.012}>
          <circleGeometry args={[0.3, 64]} />
          <meshBasicMaterial map={label} transparent />
        </mesh>
        <mesh position-z={0.013}>
          <circleGeometry args={[0.022, 24]} />
          <meshBasicMaterial color="#121212" />
        </mesh>
      </group>
      <mesh position-z={0.014}>
        <circleGeometry args={[0.96, 96]} />
        <meshBasicMaterial map={sheen} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

function Turntable({ clock, playing }: { clock: React.MutableRefObject<Clock>; playing: boolean }) {
  const deck = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const strobe = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35 }), []);
  const dots = useMemo(() => Array.from({ length: 48 }, (_, i) => (i / 48) * Math.PI * 2), []);
  const armState = useRef({ angle: ARM_REST, lift: 0.16 });
  useFrame((_, dt) => {
    const c = clock.current;
    // glide in from the right
    deck.current!.position.x = THREE.MathUtils.lerp(3.2, 0, seg(c.t, T.deck[0], T.deck[1]));
    // tonearm: swing then drop when playing; lift then swing home when stopped
    const a = armState.current;
    const tracking = THREE.MathUtils.lerp(ARM_OUTER, ARM_INNER, (c.play % 30) / 30);
    if (playing) {
      a.angle = THREE.MathUtils.damp(a.angle, tracking, 4, dt);
      if (Math.abs(a.angle - tracking) < 0.02) a.lift = THREE.MathUtils.damp(a.lift, 0.035, 8, dt);
    } else {
      a.lift = THREE.MathUtils.damp(a.lift, 0.16, 8, dt);
      if (a.lift > 0.14) a.angle = THREE.MathUtils.damp(a.angle, ARM_REST, 4, dt);
    }
    // three rotates counter-clockwise; the stylus swings left onto the record, so negate
    arm.current!.rotation.z = -a.angle;
    arm.current!.position.z = 0.12 + a.lift;
    // speed marks look still once the platter is up to speed, and flicker while it gets there
    strobe.opacity = c.speed > 3.3 ? 0.75 : c.speed < 0.05 ? 0.3 : 0.3 + 0.45 * Math.abs(Math.sin(c.t * 40));
  });
  return (
    <group ref={deck}>
      {/* plinth */}
      <RoundedBox args={[3.05, 2.35, 0.14]} radius={0.06} smoothness={4} position={[PLATTER.x + 0.42, PLATTER.y, -0.05]}>
        <meshStandardMaterial color="#1f1f1f" roughness={0.6} metalness={0.1} />
      </RoundedBox>
      {/* platter: dark disc with one crisp white ring and a band of speed marks */}
      <mesh position={[PLATTER.x, PLATTER.y, 0.04]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[1.02, 1.02, 0.05, 96]} />
        <meshStandardMaterial color="#141414" roughness={0.5} />
      </mesh>
      <mesh position={[PLATTER.x, PLATTER.y, 0.068]}>
        <ringGeometry args={[1.0, 1.02, 96]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {dots.map((d) => (
        <mesh key={d} position={[PLATTER.x + Math.cos(d) * 1.07, PLATTER.y + Math.sin(d) * 1.07, 0.07]} material={strobe}>
          <circleGeometry args={[0.012, 8]} />
        </mesh>
      ))}
      {/* tonearm: base, counterweight, a single blue arm and headshell */}
      <mesh position={[PIVOT.x, PIVOT.y, 0.08]}>
        <circleGeometry args={[0.16, 40]} />
        <meshStandardMaterial color="#2c2c2c" roughness={0.4} />
      </mesh>
      <group ref={arm} position={[PIVOT.x, PIVOT.y, 0.16]}>
        <mesh position={[0, 0.16, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 24]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.35} metalness={0.4} />
        </mesh>
        <mesh position={[0, -ARM_LEN / 2, 0]}>
          <boxGeometry args={[0.035, ARM_LEN, 0.03]} />
          <meshStandardMaterial color="#699fff" roughness={0.35} />
        </mesh>
        <mesh position={[0, -ARM_LEN, 0]} rotation-z={0.25}>
          <boxGeometry args={[0.09, 0.14, 0.035]} />
          <meshStandardMaterial color="#e8e8e8" roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function Shadow() {
  const tex = useCanvasTexture(512, (ctx, s) => {
    ctx.filter = `blur(${s * 0.06}px)`;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(s * 0.14, s * 0.2, s * 0.72, s * 0.6);
  }, []);
  return (
    <mesh position={[0, -0.18, -0.5]}>
      <planeGeometry args={[5.4, 4.2]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

// one clock for the whole scene, so every piece follows the same choreography
function Director({ clock, playing, onReady }: { clock: React.MutableRefObject<Clock>; playing: boolean; onReady?: () => void }) {
  const told = useRef(false);
  useFrame((_, dt) => {
    const c = clock.current;
    c.t = reduced() ? T.ready + 1 : c.t + dt;
    if (c.t >= T.ready && !told.current) { told.current = true; onReady?.(); }
    if (playing) c.play += dt;
    // spins up while playing, coasts down when stopped
    c.speed = reduced() ? 0 : THREE.MathUtils.damp(c.speed, playing ? 3.5 : 0, playing ? 1.6 : 1.1, dt);
  });
  return null;
}

function Rig({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ pointer }, dt) => {
    if (reduced()) return;
    g.current!.rotation.y = THREE.MathUtils.damp(g.current!.rotation.y, pointer.x * 0.22, 4, dt);
    g.current!.rotation.x = THREE.MathUtils.damp(g.current!.rotation.x, -0.12 - pointer.y * 0.14, 4, dt);
  });
  return <group ref={g} rotation-x={-0.12}>{children}</group>;
}

function RecordHeroScene({ palette, name, part = "morning", playing = false, onReady, swapKey }: { palette: RGB[]; name: string; part?: string; playing?: boolean; onReady?: () => void; swapKey?: string }) {
  const clock = useRef<Clock>({ t: 0, play: 0, speed: 0 });
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 38 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }} aria-hidden="true">
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 3, 5]} intensity={1.5} />
      <Director clock={clock} playing={playing} onReady={onReady} />
      <Shadow />
      <Rig>
        <group position={[0.1, 0, 0]}>
          <Sleeve palette={palette} part={part} name={name} clock={clock} />
          <Turntable clock={clock} playing={playing} />
          <Record palette={palette} name={name} clock={clock} swapKey={swapKey} />
        </group>
      </Rig>
    </Canvas>
  );
}

// the player re-renders every tick; the scene only needs to when its props change
const RecordHero = memo(RecordHeroScene);
export default RecordHero;

/* ================= Brand step: a sleeve that builds itself from the owner's answers ================= */
// two colour sets and a diagonal wipe between them, so a new palette sweeps across instead of fading
const WIPE_FRAG = `precision mediump float;varying vec2 vUv;uniform float t,w;uniform vec3 a1,a2,a3,b1,b2,b3;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
vec3 field(vec3 c1,vec3 c2,vec3 c3,float f,float g){vec3 col=mix(c1,c2,smoothstep(.2,.8,f));return mix(col,c3,smoothstep(.45,.9,g)*.85);}
void main(){vec2 q=vUv*2.2;float f=fbm(q+fbm(q+t*.1)+t*.05);float g=fbm(q*1.4-t*.07);
float edge=smoothstep(w-.12,w,vUv.x*.75+(1.-vUv.y)*.25+f*.08);
gl_FragColor=vec4(mix(field(b1,b2,b3,f,g),field(a1,a2,a3,f,g),edge),1.);}`;

function BuildingSleeve({ palette, name, category, logo, flipped, lines }: { palette: RGB[]; name: string; category: string; logo: string | null; flipped: boolean; lines: string[] }) {
  const root = useRef<THREE.Group>(null);
  const print = useRef<THREE.Mesh>(null);
  const logoMesh = useRef<THREE.Mesh>(null);
  const swatchRefs = useRef<(THREE.Mesh | null)[]>([]);
  const mat = useMemo(() => {
    const u: Record<string, { value: unknown }> = { t: { value: 0 }, w: { value: 1.3 } };
    ["a1", "a2", "a3", "b1", "b2", "b3"].forEach((k) => (u[k] = { value: new THREE.Color() }));
    return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: WIPE_FRAG, uniforms: u });
  }, []);
  const wipe = useRef({ w: 1.3, first: true });
  // a new palette: what's showing becomes "before", the new colours sweep in diagonally
  useEffect(() => {
    const next = lightFor(palette, "morning").map((c) => new THREE.Color(...c));
    const U = mat.uniforms;
    if (wipe.current.first || reduced()) {
      ["a1", "a2", "a3", "b1", "b2", "b3"].forEach((k, i) => (U[k].value as THREE.Color).copy(next[i % 3]));
      wipe.current.first = false;
      return;
    }
    ["a1", "a2", "a3"].forEach((k, i) => (U[k].value as THREE.Color).copy(U["b" + (i + 1)].value as THREE.Color));
    ["b1", "b2", "b3"].forEach((k, i) => (U[k].value as THREE.Color).copy(next[i]));
    wipe.current.w = -0.2;
  }, [palette, mat]);

  // the printed name; a little stamp pulse each time it changes
  const stamp = useRef(0);
  useEffect(() => { stamp.current = 1; }, [name, category]);
  const front = useCanvasTexture(1024, (ctx, s) => {
    const f = pageFont();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = s * 0.02;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `700 ${s * (name.length > 14 ? 0.06 : 0.08)}px ${f}`;
    ctx.fillText((name || "Your brand").toUpperCase(), s * 0.07, s * 0.92);
    ctx.font = `400 ${s * 0.034}px ${f}`;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(category ? `${category} · Side A` : "Side A", s * 0.07, s * 0.82);
    ctx.textAlign = "right";
    ctx.fillText("brandbeat", s * 0.93, s * 0.1);
  }, [name, category]);

  // the back: a tracklist the AI writes while it reads the brand
  const shown = useRevealCount(flipped, lines.length);
  const back = useCanvasTexture(1024, (ctx, s) => {
    const f = pageFont();
    ctx.fillStyle = "#1b1b1b"; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#ffffff"; ctx.font = `700 ${s * 0.05}px ${f}`;
    ctx.fillText((name || "Your brand").toUpperCase(), s * 0.08, s * 0.14);
    ctx.font = `400 ${s * 0.03}px ${f}`; ctx.fillStyle = "#a6a6a6";
    ctx.fillText("Side A · being written", s * 0.08, s * 0.2);
    lines.slice(0, shown).forEach((l, i) => {
      const y = s * (0.32 + i * 0.09);
      ctx.fillStyle = "#699fff"; ctx.font = `600 ${s * 0.032}px ${f}`;
      ctx.fillText(String(i + 1).padStart(2, "0"), s * 0.08, y);
      ctx.fillStyle = "#ffffff"; ctx.font = `400 ${s * 0.036}px ${f}`;
      ctx.fillText(l.replace(/…$/, ""), s * 0.17, y);
      ctx.fillStyle = "#3a3a3a"; ctx.fillRect(s * 0.08, y + s * 0.03, s * 0.84, 2);
    });
  }, [name, shown, lines.join("|")]);

  // logo artwork, loaded from the dropped file
  const logoTex = useLoadedTexture(logo);
  const logoT = useRef(0);
  useEffect(() => { logoT.current = 0; }, [logo]);
  const swatchCols = useMemo(() => palette.map((c) => new THREE.Color(...c)), [palette]);

  useFrame((_, dt) => {
    const rm = reduced();
    if (!rm) mat.uniforms.t.value = (mat.uniforms.t.value as number) + dt * 0.8;
    wipe.current.w = Math.min(1.3, wipe.current.w + dt * (rm ? 99 : 1.4));
    mat.uniforms.w.value = wipe.current.w;
    // stamp pulse on the print
    stamp.current = Math.max(0, stamp.current - dt * 4);
    print.current!.scale.setScalar(1 + stamp.current * 0.025);
    // flip to the back while the brand is being read
    root.current!.rotation.y = rm ? (flipped ? Math.PI : 0) : THREE.MathUtils.damp(root.current!.rotation.y, flipped ? Math.PI : 0, 5, dt);
    // logo flies in from above-left, then four swatches pop out and melt into the sleeve
    logoT.current += dt;
    const lt = rm ? 9 : logoT.current;
    if (logoMesh.current) {
      const k = seg(lt, 0, 0.7);
      logoMesh.current.position.set(THREE.MathUtils.lerp(-1.6, -0.62, k), THREE.MathUtils.lerp(1.6, 0.62, k), 0.04 + (1 - k) * 0.6);
      logoMesh.current.rotation.z = (1 - k) * -0.5;
    }
    swatchRefs.current.forEach((m, i) => {
      if (!m) return;
      const out = seg(lt, 0.7 + i * 0.08, 1.2 + i * 0.08), melt = seg(lt, 1.6, 2.4);
      const ang = -0.3 - i * 0.45;
      m.position.set(-0.62 + Math.cos(ang) * 0.55 * out, 0.62 + Math.sin(ang) * 0.55 * out, 0.05);
      m.scale.setScalar(Math.max(0.0001, out * (1 - melt)));
    });
  });

  return (
    <group ref={root}>
      <RoundedBox args={[2, 2, 0.04]} radius={0.015} smoothness={3} material={mat} />
      <mesh ref={print} position-z={0.032}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial map={front} transparent depthWrite={false} />
      </mesh>
      {logoTex && (
        <mesh ref={logoMesh} position={[-0.62, 0.62, 0.04]}>
          <planeGeometry args={[0.46, 0.46]} />
          <meshBasicMaterial map={logoTex} transparent />
        </mesh>
      )}
      {logoTex && swatchCols.map((c, i) => (
        <mesh key={i} ref={(m) => { swatchRefs.current[i] = m; }} position={[-0.62, 0.62, 0.05]} scale={0.0001}>
          <circleGeometry args={[0.09, 32]} />
          <meshBasicMaterial color={c} />
        </mesh>
      ))}
      <mesh position-z={-0.022} rotation-y={Math.PI}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial map={back} />
      </mesh>
    </group>
  );
}

// reveal tracklist lines one by one while flipped
function useRevealCount(on: boolean, total: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) { setN(0); return; }
    setN(1);
    const t = setInterval(() => setN((x) => Math.min(total, x + 1)), 650);
    return () => clearInterval(t);
  }, [on, total]);
  return n;
}
function useLoadedTexture(url: string | null) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) { setTex(null); return; }
    let live = true, loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(url, (t) => {
      if (!live) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace;
      loaded = t;
      setTex(t);
    });
    return () => { live = false; loaded?.dispose(); };
  }, [url]);
  return tex;
}

export function BrandSleeve(props: { palette: RGB[]; name: string; category: string; logo: string | null; flipped: boolean; lines: string[] }) {
  return (
    <Canvas camera={{ position: [0, 0, 3.6], fov: 38 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }} aria-hidden="true">
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 5]} intensity={1.3} />
      <Rig>
        <BuildingSleeve {...props} />
      </Rig>
    </Canvas>
  );
}

/* ================= Soundboard: the sound as a shape ================= */
// energy = how spiky, warmth = cool→warm colour, tempo = pulse rate, vocals = surface ripples
const ORB_VERT = `uniform float t,amp,freq,ripple,pulse;varying vec3 vN;varying float vD;
void main(){vec3 p=position;vec3 n=normalize(normal);
float d=sin(p.x*freq+t)*sin(p.y*freq+t*1.3)*sin(p.z*freq+t*.7);
d+=ripple*sin(length(p.xy)*18.-t*4.);
vD=d;vec3 q=p+n*d*amp;q*=1.+pulse;
vN=normalize(normalMatrix*n);gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}`;
const ORB_FRAG = `precision mediump float;uniform vec3 cool,warm;uniform float warmth;varying vec3 vN;varying float vD;
void main(){vec3 base=mix(cool,warm,warmth);float rim=pow(1.-abs(vN.z),2.2);
vec3 col=base*(.55+.45*(vD*.5+.5))+rim*.55;gl_FragColor=vec4(col,1.);}`;

function Orb({ palette, energy, tempo, warmth, vocals }: { palette: RGB[]; energy: number; tempo: number; warmth: number; vocals: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: ORB_VERT,
    fragmentShader: ORB_FRAG,
    uniforms: { t: { value: 0 }, amp: { value: 0.1 }, freq: { value: 3 }, ripple: { value: 0 }, pulse: { value: 0 }, warmth: { value: 0.5 }, cool: { value: new THREE.Color() }, warm: { value: new THREE.Color() } },
  }), []);
  useEffect(() => {
    // cool end: the brand's coolest mid colour; warm end: its warmest
    const byWarm = [...palette].sort((a, b) => (a[0] - a[2]) - (b[0] - b[2]));
    mat.uniforms.cool.value.setRGB(...byWarm[0]);
    mat.uniforms.warm.value.setRGB(...byWarm[byWarm.length - 1]);
  }, [palette, mat]);
  const target = useRef({ energy, tempo, warmth, vocals });
  target.current = { energy, tempo, warmth, vocals };
  useFrame((_, dt) => {
    const U = mat.uniforms, g = target.current, rm = reduced();
    const lv = getLevels();
    const playing = isFpoPlaying();
    U.t.value += rm ? 0 : dt * (0.4 + g.tempo / 120);
    U.amp.value = THREE.MathUtils.damp(U.amp.value, 0.04 + (g.energy / 100) * 0.26, 4, dt);
    U.freq.value = THREE.MathUtils.damp(U.freq.value, 2 + (g.energy / 100) * 7, 4, dt);
    U.ripple.value = THREE.MathUtils.damp(U.ripple.value, (g.vocals / 100) * 0.35, 4, dt);
    U.warmth.value = THREE.MathUtils.damp(U.warmth.value, g.warmth / 100, 4, dt);
    // breathes at the tempo; when the sample plays it kicks with the real beat instead
    const idle = rm ? 0 : Math.max(0, Math.sin((U.t.value * g.tempo) / 30)) * 0.02;
    U.pulse.value = THREE.MathUtils.damp(U.pulse.value, playing ? lv.beat * 0.08 + lv.all * 0.08 : idle, 12, dt);
  });
  return (
    <mesh material={mat}>
      <icosahedronGeometry args={[1, 48]} />
    </mesh>
  );
}

export function SoundOrb(props: { palette: RGB[]; energy: number; tempo: number; warmth: number; vocals: number }) {
  return (
    <Canvas camera={{ position: [0, 0, 4.3], fov: 40 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }} aria-hidden="true">
      <Rig>
        <Orb {...props} />
      </Rig>
    </Canvas>
  );
}

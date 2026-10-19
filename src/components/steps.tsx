"use client";
import { Link } from "next-view-transitions";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Room, peaksFor } from "./room";
import gsap from "gsap";
import { Icon, Num, RiveMark, Shell, StepPage, Thinking, reducedMotion, useFlip } from "./ui";
import { useProject } from "@/lib/store";
import { CATEGORIES, DAYPARTS, brandPalette, DAYS, VOICES, draftBrandMap, draftPromos, draftSoundboard, fmtClock, pickVibe, rank, suggestSegments } from "@/lib/ai";
import { extractPalette, getLevels, isFpoPlaying, playFpo, speak, stopFpo, toHex, updateFpo } from "@/lib/browser";
import { GENRES } from "@/lib/library";
import type { AakerKey, DaypartId, Project, Promo, RGB, Segment, Soundboard, Track } from "@/lib/types";

const reach = (p: Project, n: number) => ({ ...p, step: Math.max(p.step, n) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// a step's "next" runs once per click, and never navigates after the user has already left the step
function useStepGuard() {
  const running = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return { running, alive };
}

// the brand step's 3D sleeve only runs in the browser
const BrandSleeve = dynamic(() => import("./record").then((m) => m.BrandSleeve), { ssr: false, loading: () => <div className="art-wait" /> });

/* the AI's turn in the chat: a beat of "thinking", then the words arrive */
function AiSay({ children }: { children: string }) {
  const [typing, setTyping] = useState(() => !reducedMotion());
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => setTyping(false), 520);
    return () => clearTimeout(t);
  }, [typing]);
  useEffect(() => {
    if (typing || !ref.current || reducedMotion()) return;
    const ctx = gsap.context(() => gsap.from(".word", { opacity: 0, y: 6, duration: 0.35, ease: "expo.out", stagger: 0.025 }), ref);
    return () => ctx.revert();
  }, [typing]);
  if (typing) return <div className="msg ai typing" aria-hidden="true"><RiveMark size={24} /></div>;
  return <p className="msg ai" ref={ref}>{children.split(" ").map((w, i) => <span key={i} className="word">{w} </span>)}</p>;
}
/* the owner's answer slides in from their side */
function MeSay({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!ref.current || reducedMotion()) return;
    const ctx = gsap.context(() => gsap.from(ref.current, { x: 28, opacity: 0, duration: 0.45, ease: "expo.out" }));
    return () => ctx.revert();
  }, []);
  return <p className="msg me" ref={ref}>{children}</p>;
}

function NeedsPrevious({ n, what }: { n: number; what: string }) {
  return (
    <Shell step={n}>
      <div className="empty">
        <h1 className="serif">One step <em>back first.</em></h1>
        <p>This step builds on {what}. Finish that and we&apos;ll draft this one for you.</p>
        <Link className="btn" data-back href={`/setup/${n - 1}`}><Icon id="back" size={16} />Go back</Link>
      </div>
    </Shell>
  );
}

/* ================= 1 · Brand inputs (agentic intake) ================= */
export function Step1() {
  const { p, update } = useProject();
  const router = useRouter();
  const guard = useStepGuard();
  const b = p.brand;
  const [name, setName] = useState(b.name);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string[] | null>(null);
  const [colourNote, setColourNote] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const stage = !b.name ? 0 : !b.category ? 1 : 2;
  useEffect(() => () => { if (logoUrl) URL.revokeObjectURL(logoUrl); }, [logoUrl]);

  const setBrand = (patch: Partial<typeof b>) => update((p) => ({ ...p, brand: { ...p.brand, ...patch } }));

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    const hasLogo = b.assets.some((a) => a.kind === "logo");
    const assets = list.map((f, i) => ({
      name: f.name,
      kind: (f.type === "application/pdf" ? "pdf" : /logo/i.test(f.name) || (!hasLogo && i === 0) ? "logo" : "photo") as "logo" | "photo" | "pdf",
    }));
    const img = list.find((f) => /logo/i.test(f.name) && f.type.startsWith("image/")) ?? list.find((f) => f.type.startsWith("image/"));
    let palette = b.palette;
    if (img) {
      setLogoUrl(URL.createObjectURL(img));
      try {
        palette = await extractPalette(img, b.palette);
        setColourNote(`I pulled your colours from ${img.name}. Watch the artwork on the right: that's your music, in your colours.`);
      } catch {
        setColourNote(`I couldn't read colours from ${img.name}, so I'll keep the defaults for now.`);
      }
    }
    update((p) => ({ ...p, brand: { ...p.brand, assets: [...p.brand.assets, ...assets], palette } }));
  }

  async function next() {
    if (guard.running.current) return;
    guard.running.current = true;
    setBusy(["Reading your description…", b.assets.length ? "Looking at your logo and photos…" : "Thinking about places like yours…", "Sketching who your customers are…"]);
    // give the sleeve time to flip and write its tracklist before moving on
    const [segments] = await Promise.all([suggestSegments(b), sleep(2500)]);
    update((p) => reach({ ...p, segments }, 2));
    if (guard.alive.current) router.push("/setup/2");
  }

  const ready = stage === 2 && b.description.trim().length >= 20;
  return (
    <StepPage
      n={1}
      title={<>Let&apos;s make your place <em>sound like itself.</em></>}
      lede="A few questions about your brand. Everything after this is drafted for you, and you can change all of it."
      busy={busy}
      next={{ label: "Read my brand", onClick: next, disabled: !ready, status: stage < 2 ? "Answer a couple of questions to begin." : ready ? <b>Ready when you are.</b> : "A sentence or two about your place, then we're off." }}
    >
      <div className="intake">
        <div className="chat">
          <AiSay>Hi. What&apos;s your business called?</AiSay>
          {stage === 0 ? (
            <form className="row-input" onSubmit={(e) => { e.preventDefault(); if (name.trim()) setBrand({ name: name.trim() }); }}>
              <label className="sr" htmlFor="bname">Business name</label>
              <input id="bname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Café Luna" autoFocus />
              <button className="btn" disabled={!name.trim()}>Next</button>
            </form>
          ) : (
            <MeSay>{b.name} <button className="link" onClick={() => setBrand({ name: "", category: "" })}>Change</button></MeSay>
          )}

          {stage >= 1 && <AiSay>{`Nice to meet ${b.name}. What kind of place is it?`}</AiSay>}
          {stage === 1 && (
            <div className="chips" role="group" aria-label="Business category">
              {CATEGORIES.map((c) => <button key={c} className="chip" onClick={() => setBrand({ category: c })}>{c}</button>)}
            </div>
          )}
          {stage === 2 && <MeSay>{b.category} <button className="link" onClick={() => setBrand({ category: "" })}>Change</button></MeSay>}

          {stage === 2 && (
            <>
              <AiSay>{"Tell me about it in a few lines: the feel of the room, who comes in, what you're proud of. Add your logo, photos or a brand PDF if you have them."}</AiSay>
              <div className="answer">
                <label className="sr" htmlFor="bdesc">Brand description</label>
                <textarea id="bdesc" className="textarea" rows={4} value={b.description} onChange={(e) => setBrand({ description: e.target.value })} placeholder="A small, light-filled café on the corner. Regulars, laptops, slow mornings, good coffee…" />
                <label
                  className={`drop${over ? " over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
                >
                  <Icon id="upload" />
                  <span>Drop your logo, photos or brand PDF, or <u>choose files</u></span>
                  <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => addFiles(e.target.files)} />
                </label>
                {b.assets.length > 0 && (
                  <ul className="files" aria-label="Uploaded files">
                    {b.assets.map((a, i) => (
                      <li key={a.name + i}>
                        {a.name} <small>{a.kind}</small>
                        <button className="ic" style={{ width: 28, height: 28 }} aria-label={`Remove ${a.name}`} onClick={() => setBrand({ assets: b.assets.filter((_, j) => j !== i) })}><Icon id="x" size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {colourNote && <AiSay key={colourNote}>{colourNote}</AiSay>}
            </>
          )}
        </div>

        <aside className="preview" aria-label="Your sound, taking shape">
          <div className="art sleeve-3d"><BrandSleeve palette={brandPalette(b)} name={b.name} category={b.category} logo={logoUrl} flipped={!!busy} lines={busy ?? []} /></div>
          <div className="cap">
            <span className="serif">{b.name || "Your brand"}</span>
            <span className="swatches" aria-label="Brand colours">{brandPalette(b).map((c, i) => <i key={i} style={{ background: toHex(c) }} />)}</span>
          </div>
          <p className="note">Your music&apos;s artwork, in your colours. It will move with each song&apos;s energy and tempo.</p>
        </aside>
      </div>
    </StepPage>
  );
}

/* ================= 2 · Customer profile ================= */
// one colour per customer group, shared by its card and its dots in the room
const GROUP_COLOURS = ["#699fff", "#ffd166", "#ff7aa2", "#7fe0a8", "#c39bff", "#ff9f5a"];
const OPEN_MIN = 7 * 60, SPAN_MIN = 15 * 60;

// stable object per segment list, so the room's drawing loop isn't restarted on every render
const colourCache = new WeakMap<Segment[], Record<string, string>>();
function groupColours(segs: Segment[]) {
  let c = colourCache.get(segs);
  if (!c) { c = Object.fromEntries(segs.map((s, i) => [s.id, GROUP_COLOURS[i % GROUP_COLOURS.length]])); colourCache.set(segs, c); }
  return c;
}

function SegmentCard({ s, colour, stamped, onToggle, onRemove }: { s: Segment; colour: string; stamped: boolean; onToggle: () => void; onRemove?: () => void }) {
  return (
    <li className={`card${s.kept ? "" : " off"}`} data-flip-id={s.id}>
      <h3><i className="group-dot" style={{ background: colour }} aria-hidden="true" />{s.name}</h3>
      {/* when they're in, across the open day */}
      <div className="when-strip" role="img" aria-label={`In most: ${s.when}`}>
        {peaksFor(s).map(([a, b]) => (
          <i key={a} style={{ left: `${((a - OPEN_MIN) / SPAN_MIN) * 100}%`, width: `${((b - a) / SPAN_MIN) * 100}%`, background: colour }} />
        ))}
      </div>
      <dl>
        <dt>Age</dt><dd>{s.ages}</dd>
        <dt>When</dt><dd>{s.when}</dd>
        <dt>Wants</dt><dd>{s.wants}</dd>
      </dl>
      <div className="card-actions">
        <button className={`btn${s.kept ? " ghost" : ""}`} aria-pressed={s.kept} onClick={onToggle}>
          {s.kept ? <><Icon id="check" size={16} />Kept</> : "Keep after all"}
        </button>
        {s.kept && <button className="btn ghost" onClick={onToggle}>Not for us</button>}
        {onRemove && <button className="btn ghost" onClick={onRemove}>Remove</button>}
      </div>
      {stamped && <span className="stamp" aria-hidden="true"><RiveMark done size={36} /></span>}
    </li>
  );
}

export function Step2() {
  const { p, update } = useProject();
  const router = useRouter();
  const guard = useStepGuard();
  const [busy, setBusy] = useState<string[] | null>(null);
  const [draft, setDraft] = useState({ name: "", when: "", wants: "" });
  const [stamped, setStamped] = useState<string | null>(null);
  const flip = useFlip();
  const deck = useRef<HTMLDivElement>(null);
  // deal the cards in like flyers onto a counter
  useEffect(() => {
    if (!deck.current || reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(".card", { x: -60, y: -30, rotation: () => gsap.utils.random(-9, 9), opacity: 0, duration: 0.75, ease: "expo.out", stagger: 0.1, delay: 0.25 });
    }, deck);
    return () => ctx.revert();
  }, []);
  useEffect(() => {
    if (!stamped) return;
    const t = setTimeout(() => setStamped(null), 1400);
    return () => clearTimeout(t);
  }, [stamped]);
  if (!p.segments.length) return <NeedsPrevious n={2} what="your brand details" />;

  const colours = groupColours(p.segments);
  const keptList = p.segments.filter((s) => s.kept), dropped = p.segments.filter((s) => !s.kept);
  const toggle = (s: Segment) => {
    flip(".card");
    update((p) => ({ ...p, segments: p.segments.map((x) => (x.id === s.id ? { ...x, kept: !x.kept } : x)) }));
    if (!s.kept) setStamped(s.id);
  };
  const remove = (s: Segment) => { flip(".card"); update((p) => ({ ...p, segments: p.segments.filter((x) => x.id !== s.id) })); };

  async function next() {
    if (guard.running.current) return;
    guard.running.current = true;
    setBusy(["Weighing who matters most…", "Drafting your brand map…", "Finding the words for your personality…"]);
    const brandMap = await draftBrandMap(p.brand, p.segments);
    update((p) => reach({ ...p, brandMap }, 3));
    if (guard.alive.current) router.push("/setup/3");
  }

  return (
    <StepPage
      n={2}
      title={<>Who walks <em>through your door?</em></>}
      lede="Here's who we think your customers are, and when they're in. Keep the ones that ring true, drop the ones that don't, and add anyone we missed."
      busy={busy}
      next={{ label: "Map my brand", onClick: next, disabled: !keptList.length, status: keptList.length ? <><b>{keptList.length} customer groups</b> will shape your music.</> : "Keep at least one group to continue." }}
    >
      <div className="crowd">
      <div ref={deck}>
        <ul className="cards">
          {keptList.map((s) => <SegmentCard key={s.id} s={s} colour={colours[s.id]} stamped={stamped === s.id} onToggle={() => toggle(s)} onRemove={s.custom ? () => remove(s) : undefined} />)}
        </ul>
        {dropped.length > 0 && (
          <>
            <h2 className="pile-title">Not for us</h2>
            <ul className="cards pile">
              {dropped.map((s) => <SegmentCard key={s.id} s={s} colour={colours[s.id]} stamped={false} onToggle={() => toggle(s)} onRemove={s.custom ? () => remove(s) : undefined} />)}
            </ul>
          </>
        )}
      </div>
      <aside className="crowd-side"><Room segments={p.segments} colours={colours} /></aside>
      </div>
      <form
        className="add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.name.trim()) return;
          flip(".card");
          update((p) => ({ ...p, segments: [...p.segments, { id: crypto.randomUUID(), ages: "—", kept: true, custom: true, ...draft }] }));
          setDraft({ name: "", when: "", wants: "" });
        }}
      >
        <div><label className="label" htmlFor="sname">Add a customer group</label><input id="sname" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Students" /></div>
        <div><label className="label" htmlFor="swhen">When they come</label><input id="swhen" className="input" value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value })} placeholder="Weekday afternoons" /></div>
        <div><label className="label" htmlFor="swants">What they want</label><input id="swants" className="input" value={draft.wants} onChange={(e) => setDraft({ ...draft, wants: e.target.value })} placeholder="Cheap coffee and Wi-Fi" /></div>
        <button className="btn" disabled={!draft.name.trim()}><Icon id="plus" size={16} />Add</button>
      </form>
    </StepPage>
  );
}

/* ================= 3 · Brand map (Aaker) ================= */
const AAKER: { key: AakerKey; label: string; help: string }[] = [
  { key: "product", label: "Brand as product", help: "What you sell and how it's made" },
  { key: "organisation", label: "Brand as organisation", help: "What kind of business you are" },
  { key: "person", label: "Brand as person", help: "If your brand walked in, who would they be?" },
  { key: "symbol", label: "Brand as symbol", help: "What people picture and remember" },
];

// which corner of each panel the arm reaches: the one facing the hub
const ARM_CORNER: Record<AakerKey, [number, number]> = { product: [1, 1], organisation: [0, 1], person: [1, 0], symbol: [0, 0] };
type Arm = { key: AakerKey; x1: number; y1: number; x2: number; y2: number };

export function Step3() {
  const { p, update } = useProject();
  const router = useRouter();
  const guard = useStepGuard();
  const [busy, setBusy] = useState<string[] | null>(null);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [arms, setArms] = useState<Arm[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const flip = useFlip();
  const wrap = useRef<HTMLDivElement>(null);
  const drawn = useRef(false);

  // arms run from the hub to the inner corner of each panel; re-measured when the layout changes
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect(), hub = el.querySelector(".map-hub")?.getBoundingClientRect();
      if (!hub || getComputedStyle(el.querySelector(".map-hub")!).display === "none") { setArms([]); return; }
      const cx = hub.left + hub.width / 2 - box.left, cy = hub.top + hub.height / 2 - box.top;
      setArms(AAKER.map(({ key }) => {
        const r = el.querySelector(`.panel[data-key="${key}"]`)!.getBoundingClientRect();
        const [fx, fy] = ARM_CORNER[key];
        return { key, x1: cx, y1: cy, x2: r.left - box.left + r.width * fx, y2: r.top - box.top + r.height * fy };
      }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [p.brandMap]);

  // first arrival: the label drops in, the arms draw out, the four sides settle, the traits pop
  useEffect(() => {
    if (drawn.current || !arms.length || !wrap.current) return;
    drawn.current = true;
    if (reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "expo.out" } })
        .from(".map-hub", { scale: 0.4, opacity: 0, duration: 0.6 }, 0.25)
        .fromTo(".arm", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, stagger: 0.08, ease: "expo.inOut" }, "-=0.25")
        .from(".arm-node", { scale: 0, transformOrigin: "50% 50%", duration: 0.35, stagger: 0.08 }, "-=0.35")
        .from(".panel", { opacity: 0, y: 14, duration: 0.5, stagger: 0.08 }, "-=0.45")
        .from(".panel .trait", { scale: 0.6, opacity: 0, duration: 0.4, stagger: 0.025 }, "-=0.3");
    }, wrap);
    return () => ctx.revert();
  }, [arms.length]);

  // a newly added trait pops in
  useEffect(() => {
    if (!added || !wrap.current || reducedMotion()) return;
    const el = wrap.current.querySelector(`[data-trait="${CSS.escape(added)}"]`);
    if (el) gsap.fromTo(el, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "expo.out" });
    setAdded(null);
  }, [added]);

  const map = p.brandMap;
  if (!map) return <NeedsPrevious n={3} what="your customers" />;

  const setPart = (k: AakerKey, patch: Partial<(typeof map)[AakerKey]>) => update((p) => ({ ...p, brandMap: { ...p.brandMap!, [k]: { ...p.brandMap![k], ...patch } } }));
  // editing a side sends a pulse down its arm
  const pulse = (k: AakerKey) => {
    if (reducedMotion() || !wrap.current) return;
    gsap.fromTo(wrap.current.querySelector(`.arm[data-key="${k}"]`), { stroke: "#699fff", strokeWidth: 3.5 }, { stroke: "#4a4a4a", strokeWidth: 1.5, duration: 0.7, ease: "expo.out", overwrite: true });
  };
  // a removed trait drops off its arm before the others close the gap
  const removeTrait = (k: AakerKey, t: string, el: HTMLElement | null) => {
    const go = () => {
      flip(".panel .trait");
      update((p) => ({ ...p, brandMap: { ...p.brandMap!, [k]: { ...p.brandMap![k], traits: p.brandMap![k].traits.filter((x) => x !== t) } } }));
    };
    if (!el || reducedMotion()) return go();
    gsap.to(el, { y: 26, rotation: gsap.utils.random(-14, 14), opacity: 0, duration: 0.32, ease: "power2.in", onComplete: go });
    pulse(k);
  };

  async function next() {
    if (guard.running.current) return;
    guard.running.current = true;
    // hand-off: the four sides fold into the label, which keeps spinning while the soundboard is drafted
    if (!reducedMotion() && wrap.current) {
      const el = wrap.current, hub = el.querySelector(".map-hub")!.getBoundingClientRect();
      el.classList.add("spinning");
      await new Promise<void>((done) => {
        const tl = gsap.timeline({ onComplete: done });
        el.querySelectorAll<HTMLElement>(".panel").forEach((panel, i) => {
          const r = panel.getBoundingClientRect();
          tl.to(panel, { x: hub.left + hub.width / 2 - (r.left + r.width / 2), y: hub.top + hub.height / 2 - (r.top + r.height / 2), scale: 0.2, opacity: 0, duration: 0.6, ease: "expo.in" }, i * 0.05);
        });
        tl.to(".arm", { strokeDashoffset: 1, duration: 0.45, ease: "expo.in" }, 0).to(".arm-node", { opacity: 0, duration: 0.2 }, 0)
          .to(".map-hub", { scale: 1.6, duration: 0.5, ease: "expo.out" }, ">-0.1")
          .to(".map-hub", { rotationY: 720, rotationX: 12, duration: 1.3, ease: "power3.inOut" }, "<")
          .fromTo(".hub-ring", { scale: 1, opacity: 0.8 }, { scale: 3.4, opacity: 0, duration: 1.1, stagger: 0.14, ease: "expo.out" }, "-=0.3")
          .to(".map-hub", { scale: 1.3, rotationX: 0, duration: 0.5, ease: "expo.out" }, "<");
      });
    }
    setBusy(["Translating your brand into sound…", "Setting energy and tempo…", "Choosing genres that fit…"]);
    const soundboard = await draftSoundboard(p.brand, map!);
    update((p) => reach({ ...p, soundboard }, 4));
    if (guard.alive.current) router.push("/setup/4");
  }

  const pal = brandPalette(p.brand);
  return (
    <StepPage
      n={3}
      title={<>Does this <em>sound like you?</em></>}
      lede="Your brand in four parts, drafted from what you told us. Edit the words, add or remove traits. The music follows whatever you settle on."
      busy={busy}
      next={{ label: "Build my soundboard", onClick: next, status: "Looks right? Next we turn it into sound." }}
    >
      <div className="map-wrap" ref={wrap}>
        <svg className="arms" aria-hidden="true">
          {arms.map((a) => <line key={a.key} className="arm" data-key={a.key} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} pathLength={1} />)}
          {arms.map((a) => <circle key={a.key} className="arm-node" cx={a.x2} cy={a.y2} r={4} />)}
        </svg>
        {/* the brand's own record label sits at the centre of its four sides */}
        <div className="map-hub vinyl" aria-hidden="true" style={{ color: toHex(pal[1] ?? [0.41, 0.62, 1]) }}>
          <i className="hub-ring" /><i className="hub-ring" /><i className="hub-ring" />
          <div className="vinyl-disc">
            <div className="hub-label vinyl-label" style={{ background: toHex(pal[1] ?? [0.8, 0.4, 0.3]) }}>
              <b>{p.brand.name}</b>
              <small>Side A · 33⅓</small>
            </div>
          </div>
        </div>
        <div className="map">
          {AAKER.map(({ key, label, help }) => (
            <section key={key} className="panel" data-key={key} aria-labelledby={`h-${key}`}>
              <div>
                <h2 id={`h-${key}`}>{label}</h2>
                <p className="help">{help}</p>
              </div>
              <label className="sr" htmlFor={`s-${key}`}>{label} summary</label>
              <textarea id={`s-${key}`} className="textarea" rows={2} value={map[key].summary} onChange={(e) => { setPart(key, { summary: e.target.value }); pulse(key); }} />
              <div className="chips">
                {map[key].traits.map((t) => (
                  <span key={t} className="trait" data-trait={`${key}:${t}`}>
                    {t}
                    <button aria-label={`Remove ${t}`} onClick={(e) => removeTrait(key, t, (e.currentTarget as HTMLElement).closest(".trait"))}><Icon id="x" /></button>
                  </span>
                ))}
              </div>
              <form
                className="add-trait"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = (adding[key] ?? "").trim();
                  if (v && !map[key].traits.includes(v)) { flip(".panel .trait"); setPart(key, { traits: [...map[key].traits, v] }); setAdded(`${key}:${v}`); pulse(key); }
                  setAdding({ ...adding, [key]: "" });
                }}
              >
                <label className="sr" htmlFor={`a-${key}`}>Add a trait to {label}</label>
                <input id={`a-${key}`} className="input" value={adding[key] ?? ""} onChange={(e) => setAdding({ ...adding, [key]: e.target.value })} placeholder="Add a trait" />
                <button className="ic" aria-label="Add trait" style={{ background: "var(--paper)" }}><Icon id="plus" /></button>
              </form>
            </section>
          ))}
        </div>
      </div>
    </StepPage>
  );
}

/* ================= 4 · Soundboard ================= */
const SLIDERS: { key: "energy" | "tempo" | "warmth" | "vocals"; label: string; min: number; max: number; ends: [string, string]; unit?: string }[] = [
  { key: "energy", label: "Energy", min: 0, max: 100, ends: ["Calm", "Lively"] },
  { key: "tempo", label: "Tempo", min: 60, max: 140, ends: ["Slow", "Fast"], unit: "BPM" },
  { key: "warmth", label: "Warmth", min: 0, max: 100, ends: ["Bright, electronic", "Mellow, acoustic"] },
  { key: "vocals", label: "Vocals", min: 0, max: 100, ends: ["Instrumental", "Lots of singing"] },
];

// each fader's meter listens to the part of the sound it shapes
const BAND: Record<(typeof SLIDERS)[number]["key"], "all" | "beat" | "low" | "mid"> = { energy: "all", tempo: "beat", warmth: "low", vocals: "mid" };
const SoundOrb = dynamic(() => import("./record").then((m) => m.SoundOrb), { ssr: false, loading: () => <div className="art-wait round" /> });

export function Step4() {
  const { p, update } = useProject();
  const router = useRouter();
  const guard = useStepGuard();
  const [busy, setBusy] = useState<string[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const desk = useRef<HTMLDivElement>(null);
  useEffect(() => () => stopFpo(), []);
  // faders rise into place and the pads light up in turn
  useEffect(() => {
    if (!desk.current || reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(".fader", { y: 40, opacity: 0, duration: 0.6, ease: "expo.out", stagger: 0.08, delay: 0.3 });
      gsap.from(".pad", { scale: 0.8, opacity: 0, duration: 0.4, ease: "expo.out", stagger: 0.03, delay: 0.5 });
    }, desk);
    return () => ctx.revert();
  }, []);
  // meters: real levels while the mix plays, a resting level from the fader otherwise; written straight to the DOM
  // only loops while the mix plays; at rest it paints once whenever a fader moves
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const lv = getLevels();
      desk.current?.querySelectorAll<HTMLElement>(".leds").forEach((m) => {
        const band = m.dataset.band as keyof typeof lv, rest = Number(m.dataset.rest);
        // per-band gain so the four meters move about as much as each other
        const gain = { all: 3, beat: 1, low: 1.3, mid: 5 }[band as "all" | "beat" | "low" | "mid"];
        const lit = isFpoPlaying() ? Math.round(Math.min(1, lv[band] * gain) * 12) : Math.round(rest * 12 * 0.5);
        m.querySelectorAll("i").forEach((led, i) => led.classList.toggle("on", i < lit));
      });
      if (isFpoPlaying()) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, p.soundboard]);
  const sb = p.soundboard;
  const sample = sb ? rank(p, "midday")[0] : undefined;
  // the mix you hear is the board itself; moving a fader changes it as it plays
  useEffect(() => {
    if (playing && sb) updateFpo({ bpm: sb.tempo, energy: sb.energy, warmth: sb.warmth, vocals: sb.vocals });
  }, [playing, sb]);
  if (!sb) return <NeedsPrevious n={4} what="your brand map" />;

  const set = (patch: Partial<Soundboard>) => update((p) => ({ ...p, soundboard: { ...p.soundboard!, ...patch } }));
  const setGenre = (g: string, to: "more" | "avoid" | "none") => {
    const genres = sb.genres.filter((x) => x !== g), avoid = sb.avoid.filter((x) => x !== g);
    set({ genres: to === "more" ? [...genres, g] : genres, avoid: to === "avoid" ? [...avoid, g] : avoid });
  };
  const toggle = () => {
    if (playing) { stopFpo(); setPlaying(false); }
    else if (sample) { playFpo({ id: sample.id, bpm: sb.tempo, energy: sb.energy, warmth: sb.warmth, vocals: sb.vocals }); setPlaying(true); }
  };

  async function next() {
    if (guard.running.current) return;
    guard.running.current = true;
    stopFpo();
    setBusy(["Searching the catalogue…", "Matching songs to your mornings…", "…and your evenings…", "Writing down why each one fits…"]);
    const [morning, midday, evening] = await Promise.all(DAYPARTS.map((d) => pickVibe(p, d.id)));
    const fresh = (tracks: Track[]) => ({ tracks, pinned: [], approved: false });
    update((p) => reach({ ...p, vibe: { morning: fresh(morning), midday: fresh(midday), evening: fresh(evening) } }, 5));
    if (guard.alive.current) router.push("/setup/5");
  }

  return (
    <StepPage
      n={4}
      title={<>Your brand, <em>turned into sound.</em></>}
      lede="We set these from your brand map. Press play and move the faders: you hear the change as you make it."
      busy={busy}
      next={{ label: "Pick my sample songs", onClick: next, status: "Next: five sample songs for each part of the day." }}
    >
      <div className="mixer" ref={desk}>
        <div className="mixer-left">
          <div className="orb"><SoundOrb palette={brandPalette(p.brand)} energy={sb.energy} tempo={sb.tempo} warmth={sb.warmth} vocals={sb.vocals} /></div>
          <div className="desk" role="group" aria-label="Sound faders">
            {SLIDERS.map((s) => (
              <div key={s.key} className="fader">
                <label className="label" htmlFor={`sl-${s.key}`}>{s.label}</label>
                <span className="fader-val"><Num value={sb[s.key]} />{s.unit && <small>{s.unit}</small>}</span>
                <div className="fader-body">
                  <span className="leds" data-band={BAND[s.key]} data-rest={(sb[s.key] - s.min) / (s.max - s.min)} aria-hidden="true">
                    {Array.from({ length: 12 }, (_, i) => <i key={i} />)}
                  </span>
                  <span className="fader-slot">
                    <input id={`sl-${s.key}`} className="fader-input" type="range" min={s.min} max={s.max} value={sb[s.key]} aria-valuetext={`${sb[s.key]}${s.unit ? " " + s.unit : ""}`} onChange={(e) => set({ [s.key]: +e.target.value })} />
                  </span>
                </div>
                <span className="fader-end">{s.ends[1]}</span>
                <span className="fader-end low">{s.ends[0]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mixer-right">
          <h2 className="label" style={{ fontSize: 16 }}>Genres</h2>
          <p className="genre-legend"><span>Tap a genre for more of it</span><span>Tap ⦸ to keep it out</span></p>
          <div className="pads">
            {GENRES.map((g) => {
              const on = sb.genres.includes(g), off = sb.avoid.includes(g);
              return (
                <span key={g} className={`pad${on ? " on" : ""}${off ? " avoid" : ""}`}>
                  <button className="pad-main" aria-pressed={on} onClick={() => setGenre(g, on ? "none" : "more")}>
                    <i className="pad-led" aria-hidden="true" />{g}
                  </button>
                  <button className="pad-avoid" aria-pressed={off} aria-label={`Avoid ${g}`} title={off ? "Avoided" : "Avoid"} onClick={() => setGenre(g, off ? "none" : "avoid")}><Icon id="ban" size={14} /></button>
                </span>
              );
            })}
          </div>
          {sample && (
            <div className="sample">
              <button className="ic" onClick={toggle} aria-label={playing ? "Stop your mix" : "Hear your mix"}><Icon id={playing ? "pause" : "play"} /></button>
              <div>
                <div className="serif">{playing ? "Your mix, live" : "Hear your mix"}</div>
                <p>Closest song right now: {sample.title} · {sample.bpm} BPM · placeholder audio</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </StepPage>
  );
}

/* ================= 5 · Vibe check ================= */
// a little cover per song, drawn from the brand palette and the song itself:
// warmer songs lean to the warm colours, livelier songs get more stripes, each song gets its own angle
export function coverStyle(t: Track, pal: RGB[]): React.CSSProperties {
  const sorted = [...pal].sort((a, b) => (a[0] - a[2]) - (b[0] - b[2]));
  const warm = toHex(sorted[sorted.length - 1]), cool = toHex(sorted[0]), mid = toHex(sorted[Math.min(1, sorted.length - 1)]);
  const n = parseInt(t.id.slice(1)) || 0, angle = (n * 47) % 360, stripes = 6 + Math.round(t.energy / 9);
  const [a, b] = t.warmth > 60 ? [warm, mid] : [cool, mid];
  return { background: `repeating-linear-gradient(${angle}deg, transparent 0 ${stripes}px, rgba(255,255,255,0.08) ${stripes}px ${stripes + 2}px), radial-gradient(circle at ${30 + (n % 5) * 10}% 30%, ${a}, ${b} 70%)` };
}

/* the docked deck: the song you preview lands on the platter and spins */
const MiniDeck = ({ track, pal, ref }: { track: Track | undefined; pal: RGB[]; ref: React.Ref<HTMLDivElement> }) => (
  <div className={`deck-now${track ? " on" : ""}`} ref={ref}>
    <p aria-live="polite">
      <small className="deck-eyebrow">{track ? "Now previewing" : "Turntable"}</small>
      {track ? <><b>{track.title}</b><small>{track.desc} · {track.bpm} BPM</small></> : <small>Press play on any song to put it on</small>}
    </p>
    <div className="deck-turn" aria-hidden="true">
      <div className="vinyl deck-vinyl">
        <div className="vinyl-disc">
          {track ? <span className="vinyl-label" data-flip-id={`cover-${track.id}`} style={coverStyle(track, pal)} /> : <span className="vinyl-label blank" />}
        </div>
      </div>
      <span className="deck-arm" />
    </div>
  </div>
);

export function Step5() {
  const { p, update } = useProject();
  const router = useRouter();
  const guard = useStepGuard();
  const [part, setPart] = useState<DaypartId>("morning");
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string[] | null>(null);
  const rowsRef = useRef<HTMLUListElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const hl = useRef<HTMLHeadingElement>(null);
  const flip = useFlip();
  // the playing row's equaliser follows the actual sound
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      const lv = getLevels();
      const bars = rowsRef.current?.querySelectorAll<HTMLElement>(".row.playing .eq i");
      [lv.low * 1.3, lv.mid * 5, lv.high * 9, lv.beat].forEach((v, i) => { if (bars?.[i]) bars[i].style.height = `${Math.round(18 + Math.min(1, v) * 82)}%`; });
      deckRef.current?.style.setProperty("--lvl", Math.min(1, lv.all * 3 + lv.beat * 0.4).toFixed(2)); // the deck glows with the sound
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const choose = (id: DaypartId) => { flip(".tab-ind"); stopFpo(); setPlaying(null); setPart(id); };
  useEffect(() => () => stopFpo(), []);
  useEffect(() => {
    if (reducedMotion()) return;
    if (hl.current) gsap.fromTo(hl.current.querySelectorAll(".w"), { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.035, duration: 0.6, ease: "expo.out" });
    if (rowsRef.current) gsap.fromTo(rowsRef.current.children, { x: 36, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.05, duration: 0.5, ease: "expo.out" });
  }, [part]);
  if (!p.vibe) return <NeedsPrevious n={5} what="your soundboard" />;

  const vibe = p.vibe;
  const set = vibe[part];
  const dp = DAYPARTS.find((d) => d.id === part)!;
  const idx = DAYPARTS.findIndex((d) => d.id === part);
  const done = DAYPARTS.filter((d) => vibe[d.id].approved).length;
  const unpinned = set.tracks.filter((t) => !set.pinned.includes(t.id)).length;
  const save = (patch: Partial<typeof set>) => update((p) => ({ ...p, vibe: { ...p.vibe!, [part]: { ...p.vibe![part], ...patch } } }));

  const preview = (t: Track) => {
    flip('[data-flip-id^="cover-"]');
    if (playing === t.id) { stopFpo(); setPlaying(null); } else { playFpo(t); setPlaying(t.id); }
  };
  const swap = (i: number) => {
    const fresh = rank(p, part, set.tracks.map((t) => t.id), 10)[0];
    if (!fresh) return;
    const oldId = set.tracks[i].id;
    const go = () => {
      flip("#vibe-panel .row");
      update((p) => ({ ...p, vibe: { ...p.vibe!, [part]: { ...p.vibe![part], tracks: p.vibe![part].tracks.map((t) => (t.id === oldId ? fresh : t)), approved: false } } }));
    };
    const old = rowsRef.current?.children[i];
    if (old && !reducedMotion()) gsap.to(old, { x: -40, opacity: 0, duration: 0.22, ease: "power2.in", onComplete: go });
    else go();
    if (playing === set.tracks[i].id) { stopFpo(); setPlaying(null); }
  };
  const regen = async () => {
    stopFpo(); setPlaying(null); setLoading(true);
    const keep = set.tracks.filter((t) => set.pinned.includes(t.id));
    const tracks = await pickVibe(p, part, keep, set.tracks.map((t) => t.id));
    flip("#vibe-panel .row");
    save({ tracks, approved: false });
    setLoading(false);
  };
  const approve = () => {
    const now = !set.approved;
    save({ approved: now });
    const nextOpen = DAYPARTS.find((d) => d.id !== part && !vibe[d.id].approved);
    if (now && nextOpen) choose(nextOpen.id);
  };
  const onTabKey = (e: React.KeyboardEvent) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const n = DAYPARTS[(idx + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 2)) % 3];
    choose(n.id);
    document.getElementById(`tab-${n.id}`)?.focus();
  };
  async function next() {
    if (guard.running.current) return;
    guard.running.current = true;
    stopFpo();
    if (!p.promos.length) {
      setBusy(["Writing your announcements…", "Picking voices…", "Finding the right times…"]);
      const promos = await draftPromos(p.brand);
      update((p) => reach({ ...p, promos }, 6));
    } else update((p) => reach(p, 6));
    if (guard.alive.current) router.push("/setup/6");
  }

  const lead = [part === "evening" ? "An" : "A", dp.label.toLowerCase(), "that", "sounds"];
  const tail = ["like", ...p.brand.name.split(" ")];
  const word = (w: string, i: number, last: boolean) => <span key={i} className="w" style={{ display: "inline-block", marginRight: last ? 0 : "0.22em" }}>{w}{last ? "." : ""}</span>;

  return (
    <Shell step={5}>
      <div className="hero">
        <h1 className="serif" ref={hl}>
          {lead.map((w, i) => word(w, i, false))}
          <em>{tail.map((w, i) => word(w, i, i === tail.length - 1))}</em>
        </h1>
        <p>Five sample songs for each part of the day, picked from your brand map. Preview any song, swap the ones that miss and keep the ones you love. Then approve.</p>
      </div>
      <div className="body">
        <div className="vibe">
          <div className="vibe-side">
          <div className="tabs" role="tablist" aria-label="Parts of the day" onKeyDown={onTabKey}>
            {DAYPARTS.map((d) => (
              <button key={d.id} id={`tab-${d.id}`} className="tab" role="tab" aria-selected={d.id === part} aria-controls="vibe-panel" tabIndex={d.id === part ? 0 : -1} onClick={() => choose(d.id)}>
                {d.id === part && <span className="tab-ind" data-flip-id="tab-ind" aria-hidden="true" />}
                <span><b>{d.label}</b><small>{fmtClock(d.start)}–{fmtClock(d.end)}</small></span>
                <span className="st">{vibe[d.id].approved ? <><RiveMark done size={20} />Approved</> : "To review"}</span>
              </button>
            ))}
          </div>
          </div>
          <div id="vibe-panel" role="tabpanel" aria-labelledby={`tab-${part}`}>
            <MiniDeck ref={deckRef} track={set.tracks.find((t) => t.id === playing)} pal={brandPalette(p.brand)} />
            <ul className="rows" ref={rowsRef} aria-busy={loading}>
              {set.tracks.map((t, i) => {
                const on = playing === t.id, pinned = set.pinned.includes(t.id);
                return (
                  <li key={t.id} className={`row${on ? " playing" : ""}${loading && !pinned ? " loading" : ""}`}>
                    <button className="cover-btn" onClick={() => preview(t)} aria-label={`${on ? "Stop preview of" : "Preview"} ${t.title}`}>
                      {on ? <span className="cover empty" /> : <span className="cover" data-flip-id={`cover-${t.id}`} style={coverStyle(t, brandPalette(p.brand))} />}
                      <span className="cover-icon"><Icon id={on ? "pause" : "play"} size={18} /></span>
                    </button>
                    <div>
                      <div className="name">{t.title}{on && <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>}</div>
                      <div className="desc">{t.desc}</div>
                      <div className="why"><b>Why:</b> {t.why}</div>
                    </div>
                    <div className="meta-r">{(t.fit ?? 0) >= 92 ? "Great fit" : (t.fit ?? 0) >= 82 ? "Good fit" : "Okay fit"}</div>
                    <div className="acts">
                      <button className="ic" disabled={pinned} onClick={() => swap(i)} aria-label={`Swap ${t.title} for another song`} title={pinned ? "Kept songs can't be swapped" : "Swap for another song"}><Icon id="swap" /></button>
                      <button className="ic pin" aria-pressed={pinned} onClick={() => save({ pinned: pinned ? set.pinned.filter((x) => x !== t.id) : [...set.pinned, t.id] })} aria-label={`Keep ${t.title}`} title={pinned ? "Kept" : "Keep this song"}><Icon id="pin" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="decide">
              <button className={`btn${set.approved ? " ghost" : ""}`} onClick={approve}>
                {set.approved ? <><Icon id="check" size={16} />{dp.label} approved · undo</> : `Approve ${dp.label.toLowerCase()}`}
              </button>
              <button className="btn ghost" onClick={regen} disabled={!unpinned || loading}>
                <Icon id="refresh" size={16} />{loading ? "Finding new songs…" : unpinned === 5 ? "Regenerate all 5" : unpinned ? `Regenerate the other ${unpinned}` : "All songs kept"}
              </button>
              <span className="help">Kept songs stay put when you regenerate.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="proceed">
        {busy ? <Thinking lines={busy} /> : <div aria-live="polite" className="status-line">{done === 3 ? <><RiveMark done /><b>All three parts approved.</b> Your songs are ready.</> : <><b>{done} of 3</b> parts of the day approved. Approve all three to continue.</>}</div>}
        <div className="proceed-actions">
          <Link className="btn ghost" data-back href="/setup/4"><Icon id="back" size={16} />Back</Link>
          <button className="btn" disabled={done < 3 || !!busy} onClick={next}>Continue to promos <Icon id="arrow" size={16} /></button>
        </div>
      </div>
    </Shell>
  );
}

/* ================= 6 · Announcements & promos ================= */
/* the script while it's read aloud: words light up as the voice reaches them */
export function Karaoke({ text, at }: { text: string; at: number }) {
  const words = [...text.matchAll(/\S+/g)].map((m) => ({ w: m[0], i: m.index ?? 0 }));
  return (
    <p className="karaoke" aria-hidden="true">
      {words.map(({ w, i }) => <span key={i} className={i < at ? "said" : i === at ? "saying" : undefined}>{w} </span>)}
    </p>
  );
}

/* when an announcement plays, as pins on the open day; drag a pin (or use the arrow keys) to move it */
function TimePins({ times, onChange }: { times: number[]; onChange: (t: number[]) => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const OPEN = 7 * 60, SPAN = 15 * 60;
  const pct = (m: number) => ((m - OPEN) / SPAN) * 100;
  const set = (i: number, m: number) => onChange(times.map((v, j) => (j === i ? Math.max(OPEN, Math.min(OPEN + SPAN - 5, Math.round(m / 5) * 5)) : v)));
  const fromPointer = (e: React.PointerEvent) => {
    const r = strip.current!.getBoundingClientRect();
    return OPEN + ((e.clientX - r.left) / r.width) * SPAN;
  };
  return (
    <div className="pins" ref={strip}>
      <span className="pins-part" style={{ left: 0, width: `${pct(11 * 60)}%`, background: "var(--yellow)" }} />
      <span className="pins-part" style={{ left: `${pct(11 * 60)}%`, width: `${pct(16 * 60) - pct(11 * 60)}%`, background: "var(--blue)" }} />
      <span className="pins-part" style={{ left: `${pct(16 * 60)}%`, right: 0, background: "var(--pink)" }} />
      {times.map((m, i) => (
        <button
          key={i}
          className="pin-t"
          style={{ left: `${pct(m)}%` }}
          role="slider"
          aria-label={`Time ${i + 1}`}
          aria-valuemin={OPEN}
          aria-valuemax={OPEN + SPAN}
          aria-valuenow={m}
          aria-valuetext={fmtClock(m)}
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (e.buttons) set(i, fromPointer(e)); }}
          onKeyDown={(e) => {
            const d = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 60, PageDown: -60 }[e.key];
            if (d) { e.preventDefault(); set(i, m + d); }
          }}
        >
          <span>{fmtClock(m)}</span>
        </button>
      ))}
      <span className="pins-axis" aria-hidden="true"><i>07</i><i>11</i><i>16</i><i>22</i></span>
    </div>
  );
}

export function Step6() {
  const { p, update } = useProject();
  const router = useRouter();
  const flip = useFlip();
  const [reading, setReading] = useState<{ id: string; at: number } | null>(null);
  const stopRef = useRef<() => void>(() => {});
  useEffect(() => () => stopRef.current(), []);
  if (!p.vibe) return <NeedsPrevious n={6} what="your approved songs" />;
  const hear = (x: Promo) => {
    stopRef.current();
    if (reading?.id === x.id) { setReading(null); return; }
    setReading({ id: x.id, at: -1 });
    stopRef.current = speak(x.script, VOICES.indexOf(x.voice), {
      onWord: (at) => setReading({ id: x.id, at }),
      onEnd: () => {
        setReading((r) => (r?.id === x.id ? { id: x.id, at: x.script.length } : r));
        // hold the finished line a moment, then hand the text back for editing
        setTimeout(() => setReading((r) => (r?.id === x.id ? null : r)), 1200);
      },
    });
  };

  const setPromo = (id: string, patch: Partial<Promo>) => update((p) => ({ ...p, promos: p.promos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
  const add = () => {
    flip(".promo");
    update((p) => ({ ...p, promos: [...p.promos, { id: crypto.randomUUID(), title: "New announcement", script: "", voice: VOICES[0], times: [12 * 60], days: [0, 1, 2, 3, 4, 5, 6] }] }));
  };

  return (
    <StepPage
      n={6}
      title={<>Say it <em>between the songs.</em></>}
      lede="Short announcements, read in a voice that suits you and slotted into your day. We drafted a few; rewrite them, change the voice, or add your own."
      next={{ label: "Build my week", onClick: () => { stopRef.current(); update((p) => reach(p, 7)); router.push("/week"); }, status: <><b>{p.promos.length} announcements</b> in your week.</> }}
    >
      <div className="promos">
        {p.promos.map((x) => (
          <article key={x.id} className="promo" aria-label={x.title}>
            <div className="promo-main">
              <label className="sr" htmlFor={`pt-${x.id}`}>Title</label>
              <input id={`pt-${x.id}`} className="input title" value={x.title} onChange={(e) => setPromo(x.id, { title: e.target.value })} />
              <label className="label" htmlFor={`ps-${x.id}`}>What it says</label>
              {reading?.id === x.id ? <Karaoke text={x.script} at={reading.at} /> : <textarea id={`ps-${x.id}`} className="textarea" rows={3} value={x.script} onChange={(e) => setPromo(x.id, { script: e.target.value })} />}
              <p className="help">About {Math.max(1, Math.round(x.script.split(/\s+/).filter(Boolean).length / 2.5))} seconds read aloud.</p>
            </div>
            <div className="promo-side">
              <div>
                <label className="label" htmlFor={`pv-${x.id}`}>Voice</label>
                <select id={`pv-${x.id}`} className="select" value={x.voice} onChange={(e) => setPromo(x.id, { voice: e.target.value })}>
                  {VOICES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <span className="label" id={`pd-${x.id}`}>Days</span>
                <div className="days" role="group" aria-labelledby={`pd-${x.id}`}>
                  {DAYS.map((d, i) => (
                    <button key={d} aria-pressed={x.days.includes(i)} aria-label={d} onClick={() => setPromo(x.id, { days: x.days.includes(i) ? x.days.filter((n) => n !== i) : [...x.days, i].sort() })}>{d[0]}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label">Times</span>
                <TimePins times={x.times} onChange={(times) => setPromo(x.id, { times })} />
                <div className="times">
                  {x.times.map((m, i) => (
                    <span key={i} className="t">
                      <input type="time" aria-label={`Time ${i + 1}`} value={fmtClock(m)} onChange={(e) => e.target.value && setPromo(x.id, { times: x.times.map((v, j) => (j === i ? toMin(e.target.value) : v)) })} />
                      <button className="ic" aria-label="Remove time" onClick={() => setPromo(x.id, { times: x.times.filter((_, j) => j !== i) })}><Icon id="x" size={14} /></button>
                    </span>
                  ))}
                  <button className="ic" aria-label="Add a time" style={{ background: "var(--paper)" }} onClick={() => setPromo(x.id, { times: [...x.times, 15 * 60] })}><Icon id="plus" /></button>
                </div>
              </div>
              <div className="promo-actions">
                <button className="btn" onClick={() => hear(x)} disabled={!x.script.trim()}><Icon id={reading?.id === x.id ? "pause" : "mic"} size={16} />{reading?.id === x.id ? "Stop" : "Hear it"}</button>
                <button className="btn ghost" onClick={() => { flip(".promo"); update((p) => ({ ...p, promos: p.promos.filter((y) => y.id !== x.id) })); }}>Delete</button>
              </div>
            </div>
          </article>
        ))}
        <button className="btn ghost" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={add}><Icon id="plus" size={16} />Add an announcement</button>
        <p className="help">Voice previews use your browser&apos;s built-in voices for now. Production uses Voicemaker.</p>
      </div>
    </StepPage>
  );
}

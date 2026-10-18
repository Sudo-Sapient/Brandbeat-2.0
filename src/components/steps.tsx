"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Aurora, Icon, Shell, StepPage, Thinking, reducedMotion } from "./ui";
import { useProject } from "@/lib/store";
import { CATEGORIES, DAYPARTS, DAYS, VOICES, draftBrandMap, draftPromos, draftSoundboard, fmtClock, pickVibe, rank, suggestSegments } from "@/lib/ai";
import { extractPalette, playFpo, speak, stopFpo, toHex } from "@/lib/browser";
import { GENRES } from "@/lib/library";
import type { AakerKey, DaypartId, Project, Promo, Segment, Soundboard, Track } from "@/lib/types";

const reach = (p: Project, n: number) => ({ ...p, step: Math.max(p.step, n) });

function NeedsPrevious({ n, what }: { n: number; what: string }) {
  return (
    <Shell step={n}>
      <div className="empty">
        <h1 className="serif">One step <em>back first.</em></h1>
        <p>This step builds on {what}. Finish that and we&apos;ll draft this one for you.</p>
        <Link className="btn" href={`/setup/${n - 1}`}><Icon id="back" size={16} />Go back</Link>
      </div>
    </Shell>
  );
}

/* ================= 1 · Brand inputs (agentic intake) ================= */
export function Step1() {
  const { p, update } = useProject();
  const router = useRouter();
  const b = p.brand;
  const [name, setName] = useState(b.name);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string[] | null>(null);
  const [colourNote, setColourNote] = useState("");
  const chat = useRef<HTMLDivElement>(null);
  const stage = !b.name ? 0 : !b.category ? 1 : 2;

  useEffect(() => {
    const last = chat.current?.lastElementChild;
    if (last && !reducedMotion()) gsap.fromTo(last, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" });
  }, [stage]);

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
      try {
        palette = await extractPalette(img, b.palette);
        setColourNote(`I pulled your colours from ${img.name}. Watch the artwork on the right: that's your music, in your colours.`);
      } catch {
        setColourNote(`I couldn't read colours from ${img.name}, so I'll keep the defaults for now.`);
      }
    }
    setBrand({ assets: [...b.assets, ...assets], palette });
  }

  async function next() {
    setBusy(["Reading your description…", b.assets.length ? "Looking at your logo and photos…" : "Thinking about places like yours…", "Sketching who your customers are…"]);
    const segments = await suggestSegments(b);
    update((p) => reach({ ...p, segments }, 2));
    router.push("/setup/2");
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
        <div className="chat" ref={chat}>
          <p className="msg ai">Hi. What&apos;s your business called?</p>
          {stage === 0 ? (
            <form className="row-input" onSubmit={(e) => { e.preventDefault(); if (name.trim()) setBrand({ name: name.trim() }); }}>
              <label className="sr" htmlFor="bname">Business name</label>
              <input id="bname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Café Luna" autoFocus />
              <button className="btn" disabled={!name.trim()}>Next</button>
            </form>
          ) : (
            <p className="msg me">{b.name} <button className="link" onClick={() => setBrand({ name: "", category: "" })}>Change</button></p>
          )}

          {stage >= 1 && <p className="msg ai">Nice to meet {b.name}. What kind of place is it?</p>}
          {stage === 1 && (
            <div className="chips" role="group" aria-label="Business category">
              {CATEGORIES.map((c) => <button key={c} className="chip" onClick={() => setBrand({ category: c })}>{c}</button>)}
            </div>
          )}
          {stage === 2 && <p className="msg me">{b.category} <button className="link" onClick={() => setBrand({ category: "" })}>Change</button></p>}

          {stage === 2 && (
            <>
              <p className="msg ai">Tell me about it in a few lines: the feel of the room, who comes in, what you&apos;re proud of. Add your logo, photos or a brand PDF if you have them.</p>
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
              {colourNote && <p className="msg ai">{colourNote}</p>}
            </>
          )}
        </div>

        <aside className="preview" aria-label="Your sound, taking shape">
          <div className="art"><Aurora palette={b.palette} part="morning" energy={40} bpm={84} /></div>
          <div className="cap">
            <span className="serif">{b.name || "Your brand"}</span>
            <span className="swatches" aria-label="Brand colours">{b.palette.map((c, i) => <i key={i} style={{ background: toHex(c) }} />)}</span>
          </div>
          <p className="note">Your music&apos;s artwork, in your colours. It will move with each song&apos;s energy and tempo.</p>
        </aside>
      </div>
    </StepPage>
  );
}

/* ================= 2 · Customer profile ================= */
export function Step2() {
  const { p, update } = useProject();
  const router = useRouter();
  const [busy, setBusy] = useState<string[] | null>(null);
  const [draft, setDraft] = useState({ name: "", when: "", wants: "" });
  if (!p.segments.length) return <NeedsPrevious n={2} what="your brand details" />;

  const setSeg = (id: string, patch: Partial<Segment>) => update((p) => ({ ...p, segments: p.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const kept = p.segments.filter((s) => s.kept).length;

  async function next() {
    setBusy(["Weighing who matters most…", "Drafting your brand map…", "Finding the words for your personality…"]);
    const brandMap = await draftBrandMap(p.brand, p.segments);
    update((p) => reach({ ...p, brandMap }, 3));
    router.push("/setup/3");
  }

  return (
    <StepPage
      n={2}
      title={<>Who walks <em>through your door?</em></>}
      lede="Here's who we think your customers are. Keep the ones that ring true, drop the ones that don't, and add anyone we missed."
      busy={busy}
      next={{ label: "Map my brand", onClick: next, disabled: !kept, status: kept ? <><b>{kept} customer groups</b> will shape your music.</> : "Keep at least one group to continue." }}
    >
      <ul className="cards">
        {p.segments.map((s) => (
          <li key={s.id} className={`card${s.kept ? "" : " off"}`}>
            <h3>{s.name}</h3>
            <dl>
              <dt>Age</dt><dd>{s.ages}</dd>
              <dt>When</dt><dd>{s.when}</dd>
              <dt>Wants</dt><dd>{s.wants}</dd>
            </dl>
            <div className="card-actions">
              <button className={`btn${s.kept ? " ghost" : ""}`} aria-pressed={s.kept} onClick={() => setSeg(s.id, { kept: !s.kept })}>
                {s.kept ? <><Icon id="check" size={16} />Kept</> : "Keep"}
              </button>
              {s.custom && <button className="btn ghost" onClick={() => update((p) => ({ ...p, segments: p.segments.filter((x) => x.id !== s.id) }))}>Remove</button>}
            </div>
          </li>
        ))}
      </ul>
      <form
        className="add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.name.trim()) return;
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

export function Step3() {
  const { p, update } = useProject();
  const router = useRouter();
  const [busy, setBusy] = useState<string[] | null>(null);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const map = p.brandMap;
  if (!map) return <NeedsPrevious n={3} what="your customers" />;

  const setPart = (k: AakerKey, patch: Partial<(typeof map)[AakerKey]>) => update((p) => ({ ...p, brandMap: { ...p.brandMap!, [k]: { ...p.brandMap![k], ...patch } } }));

  async function next() {
    setBusy(["Translating your brand into sound…", "Setting energy and tempo…", "Choosing genres that fit…"]);
    const soundboard = await draftSoundboard(p.brand, map!);
    update((p) => reach({ ...p, soundboard }, 4));
    router.push("/setup/4");
  }

  return (
    <StepPage
      n={3}
      title={<>Does this <em>sound like you?</em></>}
      lede="Your brand in four parts, drafted from what you told us. Edit the words, add or remove traits. The music follows whatever you settle on."
      busy={busy}
      next={{ label: "Build my soundboard", onClick: next, status: "Looks right? Next we turn it into sound." }}
    >
      <div className="map">
        {AAKER.map(({ key, label, help }) => (
          <section key={key} className="panel" aria-labelledby={`h-${key}`}>
            <div>
              <h2 id={`h-${key}`}>{label}</h2>
              <p className="help">{help}</p>
            </div>
            <label className="sr" htmlFor={`s-${key}`}>{label} summary</label>
            <textarea id={`s-${key}`} className="textarea" rows={2} value={map[key].summary} onChange={(e) => setPart(key, { summary: e.target.value })} />
            <div className="chips">
              {map[key].traits.map((t) => (
                <span key={t} className="trait">
                  {t}
                  <button aria-label={`Remove ${t}`} onClick={() => setPart(key, { traits: map[key].traits.filter((x) => x !== t) })}><Icon id="x" /></button>
                </span>
              ))}
            </div>
            <form
              className="add-trait"
              onSubmit={(e) => {
                e.preventDefault();
                const v = (adding[key] ?? "").trim();
                if (v && !map[key].traits.includes(v)) setPart(key, { traits: [...map[key].traits, v] });
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

export function Step4() {
  const { p, update } = useProject();
  const router = useRouter();
  const [busy, setBusy] = useState<string[] | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => stopFpo(), []);
  const sb = p.soundboard;
  if (!sb) return <NeedsPrevious n={4} what="your brand map" />;

  const set = (patch: Partial<Soundboard>) => update((p) => ({ ...p, soundboard: { ...p.soundboard!, ...patch } }));
  const cycle = (g: string) => {
    if (sb.genres.includes(g)) set({ genres: sb.genres.filter((x) => x !== g), avoid: [...sb.avoid, g] });
    else if (sb.avoid.includes(g)) set({ avoid: sb.avoid.filter((x) => x !== g) });
    else set({ genres: [...sb.genres, g] });
  };
  const sample = rank(p, "midday")[0];
  const toggle = () => {
    if (playing) { stopFpo(); setPlaying(false); } else if (sample) { playFpo(sample); setPlaying(true); }
  };

  async function next() {
    stopFpo();
    setBusy(["Searching the catalogue…", "Matching songs to your mornings…", "…and your evenings…", "Writing down why each one fits…"]);
    const [morning, midday, evening] = await Promise.all(DAYPARTS.map((d) => pickVibe(p, d.id)));
    const fresh = (tracks: Track[]) => ({ tracks, pinned: [], approved: false });
    update((p) => reach({ ...p, vibe: { morning: fresh(morning), midday: fresh(midday), evening: fresh(evening) } }, 5));
    router.push("/setup/5");
  }

  return (
    <StepPage
      n={4}
      title={<>Your brand, <em>turned into sound.</em></>}
      lede="We set these from your brand map. Nudge anything that feels off; the sample below updates as you go."
      busy={busy}
      next={{ label: "Pick my sample songs", onClick: next, status: "Next: five sample songs for each part of the day." }}
    >
      <div className="board">
        <div className="sliders">
          {SLIDERS.map((s) => (
            <div key={s.key} className="slider">
              <div className="slider-head">
                <label className="label" htmlFor={`sl-${s.key}`}>{s.label}</label>
                <span className="serif">{sb[s.key]}{s.unit && <small style={{ fontSize: 13, marginLeft: 4 }}>{s.unit}</small>}</span>
              </div>
              <input id={`sl-${s.key}`} type="range" min={s.min} max={s.max} value={sb[s.key]} onChange={(e) => set({ [s.key]: +e.target.value })} />
              <div className="ends"><span>{s.ends[0]}</span><span>{s.ends[1]}</span></div>
            </div>
          ))}
        </div>
        <div>
          <h2 className="label" style={{ fontSize: 16 }}>Genres</h2>
          <p className="genre-legend"><span>Tap once: more of this</span><span>Twice: avoid it</span><span>Three times: no preference</span></p>
          <div className="chips">
            {GENRES.map((g) => {
              const on = sb.genres.includes(g), off = sb.avoid.includes(g);
              return (
                <button key={g} className={`chip${off ? " avoid" : ""}`} aria-pressed={on} onClick={() => cycle(g)} aria-label={`${g}: ${on ? "more of this" : off ? "avoid" : "no preference"}`}>
                  {on && <Icon id="check" size={14} />}{g}
                </button>
              );
            })}
          </div>
          {sample && (
            <div className="sample">
              <button className="ic" onClick={toggle} aria-label={playing ? "Stop sample" : `Play sample: ${sample.title}`}><Icon id={playing ? "pause" : "play"} /></button>
              <div>
                <div className="serif">{sample.title}</div>
                <p>{sample.desc} · {sample.bpm} BPM · placeholder audio</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </StepPage>
  );
}

/* ================= 5 · Vibe check ================= */
export function Step5() {
  const { p, update } = useProject();
  const router = useRouter();
  const [part, setPart] = useState<DaypartId>("morning");
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string[] | null>(null);
  const rowsRef = useRef<HTMLUListElement>(null);
  const hl = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => stopFpo(), []);
  useEffect(() => {
    if (reducedMotion()) return;
    if (hl.current) gsap.fromTo(hl.current.querySelectorAll(".w"), { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.035, duration: 0.6, ease: "expo.out" });
    if (rowsRef.current) gsap.fromTo(rowsRef.current.children, { y: 12, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.5, ease: "expo.out" });
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
    if (playing === t.id) { stopFpo(); setPlaying(null); } else { playFpo(t); setPlaying(t.id); }
  };
  const swap = (i: number) => {
    const fresh = rank(p, part, set.tracks.map((t) => t.id), 10)[0];
    if (!fresh) return;
    save({ tracks: set.tracks.map((t, j) => (j === i ? fresh : t)), approved: false });
    const row = rowsRef.current?.children[i];
    if (row && !reducedMotion()) gsap.fromTo(row, { backgroundColor: "#ffda40" }, { backgroundColor: "#f1f0eb", duration: 0.9, ease: "expo.out", clearProps: "backgroundColor" });
  };
  const regen = async () => {
    stopFpo(); setPlaying(null); setLoading(true);
    const keep = set.tracks.filter((t) => set.pinned.includes(t.id));
    const tracks = await pickVibe(p, part, keep, set.tracks.map((t) => t.id));
    save({ tracks, approved: false });
    setLoading(false);
  };
  const approve = () => {
    const now = !set.approved;
    save({ approved: now });
    const nextOpen = DAYPARTS.find((d) => d.id !== part && !vibe[d.id].approved);
    if (now && nextOpen) setPart(nextOpen.id);
  };
  const onTabKey = (e: React.KeyboardEvent) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const n = DAYPARTS[(idx + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 2)) % 3];
    setPart(n.id);
    document.getElementById(`tab-${n.id}`)?.focus();
  };
  async function next() {
    stopFpo();
    if (!p.promos.length) {
      setBusy(["Writing your announcements…", "Picking voices…", "Finding the right times…"]);
      const promos = await draftPromos(p.brand);
      update((p) => reach({ ...p, promos }, 6));
    } else update((p) => reach(p, 6));
    router.push("/setup/6");
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
          <div className="tabs" role="tablist" aria-label="Parts of the day" onKeyDown={onTabKey}>
            {DAYPARTS.map((d) => (
              <button key={d.id} id={`tab-${d.id}`} className="tab" role="tab" aria-selected={d.id === part} aria-controls="vibe-panel" tabIndex={d.id === part ? 0 : -1} onClick={() => setPart(d.id)}>
                <span><b>{d.label}</b><small>{fmtClock(d.start)}–{fmtClock(d.end)}</small></span>
                <span className="st">{vibe[d.id].approved ? <><Icon id="check" />Approved</> : "To review"}</span>
              </button>
            ))}
          </div>
          <div id="vibe-panel" role="tabpanel" aria-labelledby={`tab-${part}`}>
            <ul className="rows" ref={rowsRef} aria-busy={loading}>
              {set.tracks.map((t, i) => {
                const on = playing === t.id, pinned = set.pinned.includes(t.id);
                return (
                  <li key={t.id} className={`row${on ? " playing" : ""}${loading && !pinned ? " loading" : ""}`}>
                    <button className="ic play-btn" onClick={() => preview(t)} aria-label={`${on ? "Stop preview of" : "Preview"} ${t.title}`}><Icon id={on ? "pause" : "play"} /></button>
                    <div>
                      <div className="name">{t.title}{on && <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>}</div>
                      <div className="desc">{t.desc}</div>
                      <div className="why"><b>Why:</b> {t.why}</div>
                    </div>
                    <div className="meta-r">{t.bpm} BPM<br />Fit {t.fit}</div>
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
        {busy ? <Thinking lines={busy} /> : <p aria-live="polite">{done === 3 ? <><b>All three parts approved.</b> Your songs are ready.</> : <><b>{done} of 3</b> parts of the day approved. Approve all three to continue.</>}</p>}
        <div className="proceed-actions">
          <Link className="btn ghost" href="/setup/4"><Icon id="back" size={16} />Back</Link>
          <button className="btn" disabled={done < 3 || !!busy} onClick={next}>Continue to promos <Icon id="arrow" size={16} /></button>
        </div>
      </div>
    </Shell>
  );
}

/* ================= 6 · Announcements & promos ================= */
export function Step6() {
  const { p, update } = useProject();
  const router = useRouter();
  if (!p.vibe) return <NeedsPrevious n={6} what="your approved songs" />;

  const setPromo = (id: string, patch: Partial<Promo>) => update((p) => ({ ...p, promos: p.promos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
  const add = () =>
    update((p) => ({ ...p, promos: [...p.promos, { id: crypto.randomUUID(), title: "New announcement", script: "", voice: VOICES[0], times: [12 * 60], days: [0, 1, 2, 3, 4, 5, 6] }] }));

  return (
    <StepPage
      n={6}
      title={<>Say it <em>between the songs.</em></>}
      lede="Short announcements, read in a voice that suits you and slotted into your day. We drafted a few; rewrite them, change the voice, or add your own."
      next={{ label: "Build my week", onClick: () => { speechSynthesis.cancel(); update((p) => reach(p, 7)); router.push("/week"); }, status: <><b>{p.promos.length} announcements</b> in your week.</> }}
    >
      <div className="promos">
        {p.promos.map((x) => (
          <article key={x.id} className="promo" aria-label={x.title}>
            <div className="promo-main">
              <label className="sr" htmlFor={`pt-${x.id}`}>Title</label>
              <input id={`pt-${x.id}`} className="input title" value={x.title} onChange={(e) => setPromo(x.id, { title: e.target.value })} />
              <label className="label" htmlFor={`ps-${x.id}`}>What it says</label>
              <textarea id={`ps-${x.id}`} className="textarea" rows={3} value={x.script} onChange={(e) => setPromo(x.id, { script: e.target.value })} />
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
                <button className="btn" onClick={() => speak(x.script, VOICES.indexOf(x.voice))} disabled={!x.script.trim()}><Icon id="mic" size={16} />Hear it</button>
                <button className="btn ghost" onClick={() => update((p) => ({ ...p, promos: p.promos.filter((y) => y.id !== x.id) }))}>Delete</button>
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

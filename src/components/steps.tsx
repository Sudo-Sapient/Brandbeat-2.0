"use client";
import { Link } from "next-view-transitions";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { useEffect, useRef, useState } from "react";
import { Icon, Shell, StepPage } from "./ui";
import { useProject } from "@/lib/store";
import { CATEGORIES, DAYPARTS, DAYS, VOICES, draftBrandMap, draftPromos, draftSoundboard, fmtClock, pickVibe, rank, suggestSegments } from "@/lib/ai";
import { extractPalette, playFpo, speak, stopFpo, updateFpo } from "@/lib/browser";
import { GENRES } from "@/lib/library";
import type { AakerKey, DaypartId, Project, Promo, Soundboard, Track } from "@/lib/types";

const reach = (p: Project, n: number) => ({ ...p, step: Math.max(p.step, n) });
function useTask() {
  const lock = useRef(false), alive = useRef(true);
  const [busy, setBusy] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async (label: string, task: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setError(""); setBusy([label]);
    try { await task(); } catch { if (alive.current) setError("Couldn’t finish. Please try again."); }
    finally { lock.current = false; if (alive.current) setBusy(null); }
  };
  return { busy, error, run, alive };
}
function NeedsPrevious({ n, what }: { n: number; what: string }) {
  return <Shell step={n}><div className="empty"><h1>Finish {what} first</h1><Link className="btn" href={`/setup/${n - 1}`}>Go back</Link></div></Shell>;
}
const ErrorNote = ({ text }: { text: string }) => text ? <p className="error" role="alert">{text}</p> : null;

export function Step1() {
  const { p, update } = useProject(); const router = useRouter(); const task = useTask(); const b = p.brand;
  const [note, setNote] = useState(""); const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<typeof b>) => update((p) => ({ ...p, brand: { ...p.brand, ...patch } }));
  const website = b.website?.trim() ?? "";
  const validUrl = !website || (() => { try { const u = new URL(website); return ["http:", "https:"].includes(u.protocol) && !!u.hostname; } catch { return false; } })();
  const ready = !!b.name.trim() && !!b.category && b.description.trim().length >= 20 && validUrl && !uploading;
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setNote("");
    try {
      const list = [...files].filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
      const img = list.find((f) => f.type.startsWith("image/"));
      const palette = img ? await extractPalette(img, b.palette) : b.palette;
      update((p) => ({ ...p, brand: { ...p.brand, palette, assets: [...p.brand.assets, ...list.map((f) => ({ name: f.name, kind: (f.type === "application/pdf" ? "pdf" : f === img ? "logo" : "photo") as "pdf" | "logo" | "photo" }))] } }));
      setNote(list.length ? "Files added. Demo stores filenames only." : "Choose an image or PDF.");
    } catch { setNote("Upload failed. Try another image or PDF."); } finally { setUploading(false); }
  }
  const next = () => task.run("Drafting customers…", async () => {
    const segments = await suggestSegments(b);
    update((p) => reach({ ...p, brand: { ...p.brand, website }, segments }, 2));
    if (task.alive.current) router.push("/setup/2");
  });
  return <StepPage n={1} title="Brand details" lede="Tell us about your business." busy={task.busy} next={{ label: "Continue", onClick: next, disabled: !ready }}>
    <div className="brand-form">
      <div className="field"><label htmlFor="bname">Brand name</label><input id="bname" className="input" value={b.name} onChange={(e) => set({ name: e.target.value })} autoComplete="organization" /></div>
      <div className="field"><label htmlFor="bcategory">Business type</label><select id="bcategory" className="select" value={b.category} onChange={(e) => set({ category: e.target.value })}><option value="">Select type</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="field"><label htmlFor="bwebsite">Website <span className="muted">(optional)</span></label><input id="bwebsite" className="input" type="url" inputMode="url" autoComplete="url" placeholder="https://yourbrand.com" value={b.website ?? ""} aria-invalid={!validUrl} aria-describedby="website-note" onChange={(e) => set({ website: e.target.value })} /><p id="website-note" className={validUrl ? "help" : "error"}>{validUrl ? "Saved with your brand. Website analysis isn’t connected yet." : "Enter a full http:// or https:// URL."}</p></div>
      <div className="field"><label htmlFor="bdesc">Description</label><textarea id="bdesc" className="textarea" rows={3} value={b.description} minLength={20} aria-describedby="description-note" onChange={(e) => set({ description: e.target.value })} placeholder="A relaxed café for locals and slow mornings." /><p id="description-note" className="help">At least 20 characters.</p></div>
      <div className="field"><label htmlFor="brand-assets">Brand deck, logo or photos <span className="muted">(optional)</span></label><input id="brand-assets" type="file" multiple accept="image/*,application/pdf" disabled={uploading} onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} /><p className="help" role="status">{uploading ? "Adding files…" : note}</p>
        <ul className="files">{b.assets.map((a, i) => <li key={`${a.name}-${i}`}>{a.name}<button className="ic" aria-label={`Remove ${a.name}`} onClick={() => set({ assets: b.assets.filter((_, j) => j !== i) })}><Icon id="x" /></button></li>)}</ul>
      </div><ErrorNote text={task.error} />
    </div>
  </StepPage>;
}

export function Step2() {
  const { p, update } = useProject(); const router = useRouter(); const task = useTask();
  const [draft, setDraft] = useState({ name: "", when: "", wants: "" });
  if (!p.segments.length) return <NeedsPrevious n={2} what="brand details" />;
  const kept = p.segments.filter((s) => s.kept).length;
  return <StepPage n={2} title="Customers" lede="Keep the groups that fit." busy={task.busy} next={{ label: "Continue", disabled: !kept, status: `${kept} selected`, onClick: () => task.run("Drafting brand map…", async () => { const brandMap = await draftBrandMap(p.brand, p.segments); update((p) => reach({ ...p, brandMap }, 3)); if (task.alive.current) router.push("/setup/3"); }) }}>
    <div className="table-scroll"><table className="customer-table"><thead><tr><th scope="col">Keep</th><th scope="col">Customer</th><th scope="col">When</th><th scope="col">Needs</th><th scope="col"><span className="sr">Actions</span></th></tr></thead><tbody>{p.segments.map((s) => <tr key={s.id}><td><input type="checkbox" checked={s.kept} aria-label={`Keep ${s.name}`} onChange={() => update((p) => ({ ...p, segments: p.segments.map((x) => x.id === s.id ? { ...x, kept: !x.kept } : x) }))} /></td><th scope="row">{s.name}<small>{s.ages}</small></th><td>{s.when}</td><td>{s.wants}</td><td>{s.custom && <button className="link" onClick={() => update((p) => ({ ...p, segments: p.segments.filter((x) => x.id !== s.id) }))}>Remove</button>}</td></tr>)}</tbody></table></div>
    <details className="add-section"><summary>Add customer group</summary><form className="add" onSubmit={(e) => { e.preventDefault(); if (!draft.name.trim()) return; update((p) => ({ ...p, segments: [...p.segments, { ...draft, id: crypto.randomUUID(), ages: "—", kept: true, custom: true }] })); setDraft({ name: "", when: "", wants: "" }); }}>{([['name', 'Name'], ['when', 'When'], ['wants', 'Needs']] as const).map(([key, label]) => <div className="field" key={key}><label htmlFor={`group-${key}`}>{label}</label><input id={`group-${key}`} className="input" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></div>)}<button className="btn" disabled={!draft.name.trim()}>Add</button></form></details><ErrorNote text={task.error} />
  </StepPage>;
}

const AAKER: { key: AakerKey; label: string; hint: string }[] = [
  { key: "product", label: "Product", hint: "Offer, quality and uses" },
  { key: "organisation", label: "Organisation", hint: "Values, culture and capabilities" },
  { key: "person", label: "Person", hint: "Personality and relationships" },
  { key: "symbol", label: "Symbol", hint: "Visual identity and heritage" },
];
// Aaker's identity model: each perspective's lead trait forms the core identity; the rest is the extended identity
function AakerModel({ name, map }: { name: string; map: NonNullable<Project["brandMap"]> }) {
  const core = AAKER.map(({ key }) => map[key].traits[0]).filter(Boolean);
  return <figure className="aaker-model"><svg className="aaker-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{[[20, 22], [80, 22], [20, 78], [80, 78]].map(([x, y]) => <line key={`${x}${y}`} x1="50" y1="50" x2={x} y2={y} />)}</svg>
    {AAKER.map(({ key, label }) => <div className={`aaker-node n-${key}`} key={key}><span>Brand as {label.toLowerCase()}</span><p>{map[key].traits.slice(1).join(" · ") || "No extended traits"}</p></div>)}
    <div className="aaker-core"><span className="aaker-ring-label">Extended identity</span><div className="aaker-centre"><span>Core identity</span><strong>{name}</strong><p>{core.join(" · ")}</p></div></div>
    <figcaption className="sr">Aaker brand identity model: core identity {core.join(", ")}, surrounded by the extended identity from four perspectives.</figcaption></figure>;
}
export function Step3() {
  const { p, update } = useProject(); const router = useRouter(); const task = useTask(); const [adding, setAdding] = useState<Record<string, string>>({});
  const map = p.brandMap;
  if (!map) return <NeedsPrevious n={3} what="customers" />;
  const set = (key: AakerKey, patch: Partial<typeof map[AakerKey]>) => update((p) => ({ ...p, brandMap: { ...p.brandMap!, [key]: { ...p.brandMap![key], ...patch } } }));
  return <StepPage n={3} title="Aaker brand framework" lede="Four perspectives. One identity." busy={task.busy} next={{ label: "Continue", onClick: () => task.run("Building soundboard…", async () => { const soundboard = await draftSoundboard(p.brand, map); update((p) => reach({ ...p, soundboard }, 4)); if (task.alive.current) router.push("/setup/4"); }) }}>
    <section className="aaker-frame" aria-label="Aaker brand identity framework"><details className="aaker-overview"><summary>View identity diagram</summary><AakerModel name={p.brand.name} map={map} /></details><div className="map">{AAKER.map(({ key, label, hint }) => <details className="panel" key={key}><summary id={`h-${key}`}>{label}<span className="help">{map[key].traits.slice(0, 3).join(" · ")}</span></summary><p className="help">{hint}</p><label className="sr" htmlFor={`s-${key}`}>{label} summary</label><textarea id={`s-${key}`} className="textarea" rows={2} value={map[key].summary} onChange={(e) => set(key, { summary: e.target.value })} /><div className="chips">{map[key].traits.map((t) => <span className="trait" key={t}>{t}<button aria-label={`Remove ${t}`} onClick={() => set(key, { traits: map[key].traits.filter((x) => x !== t) })}><Icon id="x" size={14} /></button></span>)}</div><form className="add-trait" onSubmit={(e) => { e.preventDefault(); const t = (adding[key] ?? "").trim(); if (t && !map[key].traits.includes(t)) set(key, { traits: [...map[key].traits, t] }); setAdding({ ...adding, [key]: "" }); }}><label className="sr" htmlFor={`a-${key}`}>Add {label} trait</label><input id={`a-${key}`} className="input" placeholder="Add trait" value={adding[key] ?? ""} onChange={(e) => setAdding({ ...adding, [key]: e.target.value })} /><button className="btn ghost" disabled={!adding[key]?.trim()}>Add</button></form></details>)}</div></section><ErrorNote text={task.error} />
  </StepPage>;
}

const SLIDERS: { key: keyof Omit<Soundboard, "genres" | "avoid">; label: string; min: number; max: number; ends: [string, string] }[] = [
  { key: "energy", label: "Energy", min: 0, max: 100, ends: ["Calm", "Lively"] }, { key: "tempo", label: "Tempo", min: 60, max: 140, ends: ["Slow", "Fast"] }, { key: "warmth", label: "Warmth", min: 0, max: 100, ends: ["Electronic", "Acoustic"] }, { key: "vocals", label: "Vocals", min: 0, max: 100, ends: ["Instrumental", "Singing"] },
];
export function Step4() {
  const { p, update } = useProject(); const router = useRouter(); const task = useTask(); const [playing, setPlaying] = useState(false); const sb = p.soundboard;
  useEffect(() => () => stopFpo(), []);
  useEffect(() => { if (playing && sb) updateFpo({ bpm: sb.tempo, energy: sb.energy, warmth: sb.warmth, vocals: sb.vocals }); }, [playing, sb]);
  if (!sb) return <NeedsPrevious n={4} what="brand map" />;
  const set = (patch: Partial<Soundboard>) => update((p) => ({ ...p, soundboard: { ...p.soundboard!, ...patch } }));
  const sample = rank(p, "midday")[0];
  return <StepPage n={4} title={p.regeneratePart ? `New genres for ${p.regeneratePart}` : "Soundboard"} lede={p.regeneratePart ? "Choose genres, then find new songs. Kept songs stay if eligible." : "Adjust your sound."} busy={task.busy} next={{ label: "Find songs", disabled: !sample, onClick: () => task.run("Finding songs…", async () => { stopFpo(); setPlaying(false); if (p.regeneratePart && p.vibe) {
      const part = p.regeneratePart, old = p.vibe[part];
      const tracks = await pickVibe(p, part, old.tracks.filter((t) => old.pinned.includes(t.id)), old.tracks.map((t) => t.id));
      update((p) => ({ ...p, regeneratePart: undefined, vibe: { ...p.vibe!, [part]: { tracks, pinned: old.pinned.filter((id) => tracks.some((t) => t.id === id)), approved: false } } }));
    } else {
      const tracks = await Promise.all(DAYPARTS.map((d) => pickVibe(p, d.id))); const fresh = (tracks: Track[]) => ({ tracks, pinned: [], approved: false }); update((p) => reach({ ...p, scheduleEdits: {}, vibe: { morning: fresh(tracks[0]), midday: fresh(tracks[1]), evening: fresh(tracks[2]) } }, 5));
    } if (task.alive.current) router.push("/setup/5"); }) }}>
    <div className="board"><div className="sliders">{SLIDERS.map((s) => <div className="slider" key={s.key}><div className="slider-head"><label htmlFor={`sl-${s.key}`}>{s.label}</label><output htmlFor={`sl-${s.key}`}>{sb[s.key]}{s.key === "tempo" ? " BPM" : ""}</output></div><input id={`sl-${s.key}`} type="range" min={s.min} max={s.max} value={sb[s.key]} onChange={(e) => set({ [s.key]: +e.target.value })} /><div className="ends"><span>{s.ends[0]}</span><span>{s.ends[1]}</span></div></div>)}</div><div><h2>Genres</h2><p className="help">Select to prefer. Block to exclude.</p><div className="genre-list">{GENRES.map((g) => <div className="genre-row" key={g}><label><input type="checkbox" checked={sb.genres.includes(g)} onChange={(e) => set({ genres: e.target.checked ? [...sb.genres, g] : sb.genres.filter((x) => x !== g), avoid: sb.avoid.filter((x) => x !== g) })} />{g}</label><button className="ic" aria-label={`Avoid ${g}`} aria-pressed={sb.avoid.includes(g)} onClick={() => set({ avoid: sb.avoid.includes(g) ? sb.avoid.filter((x) => x !== g) : [...sb.avoid, g], genres: sb.genres.filter((x) => x !== g) })}><Icon id="ban" size={16} /></button></div>)}</div></div></div>
    <button className="btn ghost" disabled={!sample} onClick={() => { if (playing) stopFpo(); else if (sample) playFpo({ id: sample.id, bpm: sb.tempo, energy: sb.energy, warmth: sb.warmth, vocals: sb.vocals }); setPlaying(!playing); }}><Icon id={playing ? "pause" : "play"} />{playing ? "Stop preview" : "Preview sound"}</button>{!sample && <p className="error">Allow a genre to find songs.</p>}<ErrorNote text={task.error} />
  </StepPage>;
}

export function Step5() {
  const { p, update } = useProject(); const router = useRouter(); const task = useTask();
  const [part, setPart] = useState<DaypartId>("morning"), [playing, setPlaying] = useState<string | null>(null);
  const loading = false; const [notice, setNotice] = useState("");
  useEffect(() => () => stopFpo(), []);
  if (!p.vibe) return <NeedsPrevious n={5} what="soundboard" />;
  const set = p.vibe[part]; const done = DAYPARTS.filter((d) => p.vibe![d.id].approved).length;
  const save = (patch: Partial<typeof set>) => update((p) => ({ ...p, vibe: { ...p.vibe!, [part]: { ...p.vibe![part], ...patch } } }));
  const choose = (id: DaypartId) => { stopFpo(); setPlaying(null); setNotice(""); setPart(id); };
  const regen = () => {
    stopFpo(); setPlaying(null);
    update((p) => ({ ...p, regeneratePart: part }));
    router.push("/setup/4");
  };
  const swap = (id: string) => { const fresh = rank(p, part, set.tracks.map((t) => t.id), 8)[0]; if (!fresh) { setNotice("No new matches. Allow more genres in Soundboard."); return; } if (playing === id) { stopFpo(); setPlaying(null); } save({ tracks: set.tracks.map((t) => t.id === id ? fresh : t), approved: false }); };
  return <StepPage n={5} title="Review songs" lede="Preview, keep or replace." busy={task.busy} next={{ label: "Continue", disabled: done !== 3 || loading, status: `${done}/3 approved`, onClick: () => task.run("Preparing announcements…", async () => { stopFpo(); const promos = p.promos.length ? p.promos : await draftPromos(p.brand); update((p) => reach({ ...p, promos }, 6)); if (task.alive.current) router.push("/setup/6"); }) }}>
    <div className="day-tabs" role="group" aria-label="Parts of the day">{DAYPARTS.map((d) => <button key={d.id} className="btn ghost" aria-pressed={part === d.id} disabled={loading} onClick={() => choose(d.id)}>{d.label}{p.vibe![d.id].approved && <Icon id="check" size={16} />}</button>)}</div>
    <ul className="rows" aria-label={`${part} songs`} aria-busy={loading}>{set.tracks.map((t) => <li className={`row${playing === t.id ? " playing" : ""}`} key={t.id}><button className="ic" disabled={loading} aria-label={`${playing === t.id ? "Stop" : "Preview"} ${t.title}`} onClick={() => { if (playing === t.id) { stopFpo(); setPlaying(null); } else { playFpo(t); setPlaying(t.id); } }}><Icon id={playing === t.id ? "pause" : "play"} /></button><div><div className="name">{t.title}</div><p className="desc">{t.genre} · {t.bpm} BPM</p>{t.why && <details className="song-reason"><summary>Why this song?</summary><p>{t.why}</p></details>}</div><span className="meta-r">{t.fit}% fit</span><div className="acts"><button className="ic" disabled={loading || set.pinned.includes(t.id)} aria-label={`Swap ${t.title}`} onClick={() => swap(t.id)}><Icon id="swap" /></button><button className="ic" disabled={loading} aria-pressed={set.pinned.includes(t.id)} aria-label={`Keep ${t.title}`} onClick={() => save({ pinned: set.pinned.includes(t.id) ? set.pinned.filter((id) => id !== t.id) : [...set.pinned, t.id] })}><Icon id="pin" /></button></div></li>)}</ul>
    {!set.tracks.length && <p className="error">No matches. Allow more genres in Soundboard.</p>}
    <div className="decide"><button className="btn" disabled={loading || !set.tracks.length} onClick={() => { save({ approved: !set.approved }); const next = DAYPARTS.find((d) => d.id !== part && !p.vibe![d.id].approved); if (!set.approved && next) choose(next.id); }}>{set.approved ? "Undo approval" : `Approve ${part}`}</button><button className="btn ghost" onClick={regen}><Icon id="refresh" size={16} />{loading ? "Regenerating…" : "Regenerate"}</button><span className="help">Choose different genres.</span></div><p className="help" role="status">{notice}</p><ErrorNote text={task.error} />
  </StepPage>;
}

export function Karaoke({ text, at }: { text: string; at: number }) {
  return <p className="karaoke" aria-label={text}>{[...text.matchAll(/\S+/g)].map((m) => <span key={m.index} className={(m.index ?? 0) < at ? "said" : (m.index ?? 0) === at ? "saying" : undefined}>{m[0]} </span>)}</p>;
}
export function Step6() {
  const { p, update } = useProject(); const router = useRouter(); const [reading, setReading] = useState<{ id: string; at: number } | null>(null); const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);
  if (!p.vibe) return <NeedsPrevious n={6} what="songs" />;
  const allApproved = DAYPARTS.every((d) => p.vibe![d.id].approved);
  const set = (id: string, patch: Partial<Promo>) => update((p) => ({ ...p, promos: p.promos.map((x) => x.id === id ? { ...x, ...patch } : x) }));
  const hear = (x: Promo) => { stop.current(); if (reading?.id === x.id) { setReading(null); return; } setReading({ id: x.id, at: -1 }); stop.current = speak(x.script, VOICES.indexOf(x.voice), { onWord: (at) => setReading({ id: x.id, at }), onEnd: () => setReading(null) }); };
  return <StepPage n={6} title="Announcements" lede="Optional messages between songs." next={{ label: "Build week", disabled: !allApproved, status: allApproved ? `${p.promos.length} announcements` : "Approve all dayparts first.", onClick: () => { stop.current(); update((p) => reach(p, 7)); router.push("/week"); } }}>
    <div className="promos">{p.promos.map((x) => <article className="promo" key={x.id} aria-label={x.title}><div className="promo-main"><label htmlFor={`pt-${x.id}`}>Title</label><input id={`pt-${x.id}`} className="input" value={x.title} onChange={(e) => set(x.id, { title: e.target.value })} /><label htmlFor={`ps-${x.id}`}>Script</label>{reading?.id === x.id ? <Karaoke text={x.script} at={reading.at} /> : <textarea id={`ps-${x.id}`} className="textarea" rows={3} value={x.script} onChange={(e) => set(x.id, { script: e.target.value })} />}</div><div className="promo-side"><div className="field"><label htmlFor={`pv-${x.id}`}>Voice</label><select id={`pv-${x.id}`} className="select" value={x.voice} onChange={(e) => set(x.id, { voice: e.target.value })}>{VOICES.map((v) => <option key={v}>{v}</option>)}</select></div><fieldset><legend>Days</legend><div className="days">{DAYS.map((d, i) => <button key={d} aria-label={d} aria-pressed={x.days.includes(i)} onClick={() => set(x.id, { days: x.days.includes(i) ? x.days.filter((n) => n !== i) : [...x.days, i].sort() })}>{d.slice(0, 3)}</button>)}</div></fieldset><fieldset><legend>Times</legend><div className="times">{x.times.map((m, i) => <span className="t" key={i}><input type="time" aria-label={`${x.title} time ${i + 1}`} min="07:00" max="21:59" value={fmtClock(m)} onChange={(e) => { if (!e.target.value) return; const [h, min] = e.target.value.split(":").map(Number); set(x.id, { times: x.times.map((v, j) => j === i ? Math.min(1319, Math.max(420, h * 60 + min)) : v) }); }} /><button className="ic" aria-label={`Remove time ${i + 1}`} onClick={() => set(x.id, { times: x.times.filter((_, j) => j !== i) })}><Icon id="x" size={14} /></button></span>)}<button className="btn ghost" onClick={() => set(x.id, { times: [...x.times, 900] })}>Add time</button></div></fieldset><div className="promo-actions"><button className="btn ghost" disabled={!x.script.trim()} onClick={() => hear(x)}>{reading?.id === x.id ? "Stop" : "Preview"}</button><button className="link" onClick={() => { if (reading?.id === x.id) { stop.current(); setReading(null); } update((p) => ({ ...p, promos: p.promos.filter((y) => y.id !== x.id) })); }}>Delete</button></div></div></article>)}</div>
    <button className="btn ghost" onClick={() => update((p) => ({ ...p, promos: [...p.promos, { id: crypto.randomUUID(), title: "New announcement", script: "", voice: VOICES[0], times: [720], days: [0, 1, 2, 3, 4, 5, 6] }] }))}>Add announcement</button>
  </StepPage>;
}

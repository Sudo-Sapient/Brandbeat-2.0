"use client";
import { useState } from "react";
import { useProject } from "@/lib/store";
import { DAYS, buildDay, rank } from "@/lib/ai";
import type { DaypartId, Track } from "@/lib/types";

export function ScheduleEditor({ day, part, tracks }: { day: number; part: DaypartId; tracks: Track[] }) {
  const { p, update } = useProject();
  const [scope, setScope] = useState("day");
  const [message, setMessage] = useState("");
  const save = (next: Track[]) => {
    update((p) => {
      const edits = { ...p.scheduleEdits };
      const days = scope === "week" ? DAYS.map((_, i) => i) : [day];
      for (const d of days) edits[d] = { ...edits[d], [part]: next };
      return { ...p, scheduleEdits: edits };
    });
    setMessage(scope === "week" ? `Saved to ${part} on all seven days.` : `Saved to ${DAYS[day]} ${part}.`);
  };
  const move = (index: number, delta: number) => {
    const next = [...tracks];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    save(next);
  };
  const candidates = rank(p, part).filter((t) => !tracks.some((s) => s.id === t.id));
  return <details className="schedule-editor"><summary>Edit songs</summary>
    <label className="field">Apply edits to<select className="select" value={scope} onChange={(e) => setScope(e.target.value)}><option value="day">{DAYS[day]} only</option><option value="week">All days · {part}</option></select></label>
    {scope === "week" && <p className="help">Each edit copies this list to the same daypart on all seven days.</p>}
    <ol>{tracks.map((t, i) => <li key={`${t.id}-${i}`}><strong>{i + 1}. {t.title}</strong><div className="schedule-actions"><button className="btn ghost" disabled={i === 0} aria-label={`Move ${t.title} up`} onClick={() => move(i, -1)}>Up</button><button className="btn ghost" disabled={i === tracks.length - 1} aria-label={`Move ${t.title} down`} onClick={() => move(i, 1)}>Down</button><button className="btn ghost" disabled={tracks.length <= 1} aria-label={`Remove ${t.title}`} onClick={() => save(tracks.filter((_, j) => j !== i))}>Remove</button></div><select className="select" aria-label={`Replace ${t.title}`} value="" onChange={(e) => { const replacement = candidates.find((x) => x.id === e.target.value); if (replacement) save(tracks.map((x, j) => j === i ? replacement : x)); }}><option value="">Replace song…</option>{candidates.map((x) => <option key={x.id} value={x.id}>{x.title} · {x.genre}</option>)}</select></li>)}</ol>
    <label className="field">Add song<select className="select" value="" disabled={!candidates.length} onChange={(e) => { const track = candidates.find((t) => t.id === e.target.value); if (track) save([...tracks, track]); }}><option value="">Choose a song…</option>{candidates.map((t) => <option key={t.id} value={t.id}>{t.title} · {t.genre}</option>)}</select></label>
    <button className="link" onClick={() => { const generated = buildDay({ ...p, scheduleEdits: undefined }, day).find((d) => d.part.id === part)!.tracks; save(generated); }}>Reset to suggested songs</button><p className="help" role="status">{message}</p>
  </details>;
}

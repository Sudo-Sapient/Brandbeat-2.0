"use client";
import { Link } from "next-view-transitions";
import { useMemo, useState } from "react";
import { ScheduleEditor } from "@/components/schedule-editor";
import { Shell } from "@/components/ui";
import { DaypartGraph } from "@/components/daypart-graph";
import { useProject } from "@/lib/store";
import { DAYS, DAYPARTS, buildDay, fmtClock } from "@/lib/ai";
export default function Week() {
  const { p, ready } = useProject(); const [day, setDay] = useState(() => (new Date().getDay() + 6) % 7);
  const approved = p.vibe && DAYPARTS.every((d) => p.vibe![d.id].approved);
  const week = useMemo(() => p.vibe && p.soundboard ? DAYS.map((_, d) => buildDay(p, d)) : null, [p]);
  if (!ready) return null;
  if (!week || !approved) return <Shell step={7}><div className="empty"><h1>Review songs first</h1><p>Approve all three dayparts to build your week.</p><Link className="btn" href="/setup/5">Review songs</Link></div></Shell>;
  return <Shell step={7}><div className="hero"><h1>Weekly schedule</h1><p>Choose a day to review its music.</p></div><div className="body"><div className="day-tabs" role="group" aria-label="Days of the week">{DAYS.map((d, i) => <button className="btn ghost" key={d} aria-pressed={day === i} onClick={() => setDay(i)}>{d.slice(0, 3)}</button>)}</div><h2 className="day-title">{DAYS[day]}</h2><div className="daydetail">{week[day].map(({ part, tracks, promos }) => {
    const announcements = promos.flatMap((p) => p.times.filter((m) => m >= part.start && m < part.end).map((m, i) => ({ id: `${p.id}-${i}`, title: p.title, m }))).sort((a, b) => a.m - b.m);
    return <section className="partcol" key={part.id} aria-label={`${DAYS[day]} ${part.label}`}><header><div><h3>{part.label}</h3><p className="help">{fmtClock(part.start)}–{fmtClock(part.end)}</p></div><Link className="btn ghost" href={`/player?day=${day}&part=${part.id}`} aria-label={`Play ${DAYS[day]} ${part.label}`}>Play</Link></header><DaypartGraph tracks={tracks} label={`${DAYS[day]} ${part.label}`} /><details className="track-list"><summary>{tracks.length} songs · {announcements.length} announcements</summary><ol>{announcements.map((a) => <li key={a.id}><span>{a.title}</span><span>{fmtClock(a.m)}</span></li>)}{tracks.map((t) => <li key={t.id}><span>{t.title}</span><span>{t.bpm} BPM</span></li>)}</ol></details><ScheduleEditor key={`${day}-${part.id}`} day={day} part={part.id} tracks={tracks} /></section>;
  })}</div></div><div className="proceed"><p>Demo schedule</p><div className="proceed-actions"><Link className="btn ghost" href="/setup/6">Back</Link><Link className="btn" href={`/player?day=${day}`}>Open player</Link></div></div></Shell>;
}

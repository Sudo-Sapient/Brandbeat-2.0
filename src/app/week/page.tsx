"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon, Shell } from "@/components/ui";
import { useProject } from "@/lib/store";
import { DAYS, buildDay, fmtClock } from "@/lib/ai";

const PART_COLOUR = { morning: "var(--yellow)", midday: "var(--blue)", evening: "var(--pink)" };

export default function Week() {
  const { p, ready } = useProject();
  const [day, setDay] = useState(() => (new Date().getDay() + 6) % 7);
  const week = useMemo(() => (p.vibe && p.soundboard ? DAYS.map((_, d) => buildDay(p, d)) : null), [p]);

  if (!ready) return null;
  if (!week)
    return (
      <Shell step={7}>
        <div className="empty">
          <h1 className="serif">Your week <em>isn&apos;t built yet.</em></h1>
          <p>Approve your sample songs first and we&apos;ll schedule the whole week around them.</p>
          <Link className="btn" href="/setup/5"><Icon id="back" size={16} />Go to the vibe check</Link>
        </div>
      </Shell>
    );

  const sel = week[day];
  const songs = week.reduce((n, d) => n + d.reduce((m, x) => m + x.tracks.length, 0), 0);
  const anns = week.reduce((n, _, i) => n + p.promos.reduce((m, x) => m + (x.days.includes(i) ? x.times.length : 0), 0), 0);

  return (
    <Shell step={7}>
      <div className="hero">
        <h1 className="serif">Your week, <em>ready to play.</em></h1>
        <p>{songs} song slots and {anns} announcements across seven days, built from your approved songs. Pick a day to see it in detail, then press play on any part of it.</p>
      </div>
      <div className="body">
        <div className="week" role="group" aria-label="Days of the week">
          {week.map((parts, d) => {
            const promos = p.promos.filter((x) => x.days.includes(d)).reduce((n, x) => n + x.times.length, 0);
            return (
              <button key={d} className="daycol" aria-pressed={d === day} onClick={() => setDay(d)}>
                <span className="serif">{DAYS[d].slice(0, 3)}</span>
                <small>{promos} announcement{promos === 1 ? "" : "s"}</small>
                {parts.map(({ part, tracks }) => (
                  <span key={part.id} className="strip" style={{ background: PART_COLOUR[part.id] }}>
                    <span>{part.label}</span><span>{tracks.length}</span>
                  </span>
                ))}
              </button>
            );
          })}
        </div>

        <div className="daydetail" aria-label={`${DAYS[day]} in detail`}>
          {sel.map(({ part, tracks, promos }) => {
            const anns = promos.flatMap((x) => x.times.filter((m) => m >= part.start && m < part.end).map((m) => ({ m, t: x.title }))).sort((a, b) => a.m - b.m);
            return (
              <section key={part.id} className="partcol">
                <header style={{ background: PART_COLOUR[part.id] }}>
                  <div>
                    <h3>{part.label}</h3>
                    <small>{fmtClock(part.start)}–{fmtClock(part.end)} · {tracks.length} songs</small>
                  </div>
                  <Link className="btn" href={`/player?day=${day}&part=${part.id}`} aria-label={`Play ${DAYS[day]} ${part.label.toLowerCase()}`}><Icon id="play" size={16} />Play</Link>
                </header>
                <ol>
                  {anns.map((a) => <li key={a.m + a.t} className="ann"><span>{a.t}</span><span>{fmtClock(a.m)}</span></li>)}
                  {tracks.map((t) => <li key={t.id}><span>{t.title}</span><span>{t.bpm} BPM</span></li>)}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
      <div className="proceed">
        <p><b>{DAYS[day]}</b> selected.</p>
        <div className="proceed-actions">
          <Link className="btn ghost" href="/setup/6"><Icon id="back" size={16} />Promos</Link>
          <Link className="btn" href={`/player?day=${day}`}>Open the player <Icon id="arrow" size={16} /></Link>
        </div>
      </div>
    </Shell>
  );
}

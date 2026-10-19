"use client";
import { Link } from "next-view-transitions";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Icon, Shell, reducedMotion } from "@/components/ui";
import { coverStyle } from "@/components/steps";
import { useProject } from "@/lib/store";
import { DAYS, brandPalette, buildDay, fmtClock } from "@/lib/ai";

const PART_COLOUR = { morning: "var(--yellow)", midday: "var(--blue)", evening: "var(--pink)" };

export default function Week() {
  const { p, ready } = useProject();
  const [day, setDay] = useState(() => (new Date().getDay() + 6) % 7);
  const week = useMemo(() => (p.vibe && p.soundboard ? DAYS.map((_, d) => buildDay(p, d)) : null), [p]);
  const detail = useRef<HTMLDivElement>(null);
  const shelf = useRef<HTMLDivElement>(null);
  const pal = brandPalette(p.brand);
  // the records slide onto the shelf one by one
  useEffect(() => {
    if (!shelf.current || reducedMotion()) return;
    const ctx = gsap.context(() => gsap.from(".day-record", { x: -40, opacity: 0, duration: 0.6, ease: "expo.out", stagger: 0.07, delay: 0.3 }), shelf);
    return () => ctx.revert();
  }, [ready]);
  // picking a day deals its lists in, instead of swapping them
  useEffect(() => {
    if (!detail.current || reducedMotion()) return;
    const ctx = gsap.context(() => {
      // the day's three parts flip down like cards being turned, then their lists deal in
      gsap.timeline({ defaults: { ease: "expo.out" } })
        .from(".partcol", { rotationX: -75, y: -10, opacity: 0, transformOrigin: "50% 0%", transformPerspective: 900, duration: 0.7, stagger: 0.09 })
        .from(".partcol li", { opacity: 0, x: -8, duration: 0.35, stagger: 0.012 }, "-=0.45");
    }, detail);
    // the picked sleeve gives a little kick as its record comes out
    const picked = shelf.current?.querySelector<HTMLElement>(`.day-record[aria-pressed="true"] .day-cover`);
    if (picked) gsap.fromTo(picked, { rotation: -4 }, { rotation: 0, duration: 0.6, ease: "power3.out", clearProps: "rotate" });
    return () => ctx.revert();
  }, [day, ready]);

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
        {/* the week as seven records on a shelf; pull one out to open its day */}
        <div className="shelf" ref={shelf} role="group" aria-label="Days of the week">
          {week.map((parts, d) => {
            const dayPromos = p.promos.filter((x) => x.days.includes(d));
            const count = dayPromos.reduce((n, x) => n + x.times.length, 0);
            // the day's cover: its liveliest song, in the brand's colours
            const lead = [...parts.flatMap((x) => x.tracks)].sort((a, b) => b.energy - a.energy)[0];
            return (
              <button key={d} className="day-record" aria-pressed={d === day} onClick={() => setDay(d)} aria-label={`${DAYS[d]}: ${parts.map((x) => `${x.tracks.length} ${x.part.label.toLowerCase()} songs`).join(", ")}, ${count} announcements`}>
                <span className="day-art">
                  <span className="day-disc vinyl" aria-hidden="true">
                    <span className="vinyl-disc"><span className="vinyl-label" style={lead ? coverStyle(lead, pal) : undefined} /></span>
                  </span>
                  <span className="day-cover" style={lead ? coverStyle(lead, pal) : undefined}>
                    <b>{DAYS[d].slice(0, 3)}</b>
                  </span>
                </span>
                {/* announcement pins along the bottom edge, placed by time of day */}
                <span className="day-pins" aria-hidden="true">
                  {dayPromos.flatMap((x) => x.times).map((m, i) => <i key={i} style={{ left: `${((m - 420) / 900) * 100}%` }} />)}
                </span>
                <small>{count} announcement{count === 1 ? "" : "s"}</small>
              </button>
            );
          })}
        </div>

        <h2 className="day-title" key={day}>{DAYS[day]}</h2>
        <div className="daydetail" ref={detail} aria-label={`${DAYS[day]} in detail`}>
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
          <Link className="btn ghost" data-back href="/setup/6"><Icon id="back" size={16} />Promos</Link>
          <Link className="btn" href={`/player?day=${day}`}>Open the player <Icon id="arrow" size={16} /></Link>
        </div>
      </div>
    </Shell>
  );
}

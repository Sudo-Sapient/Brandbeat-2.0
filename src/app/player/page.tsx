"use client";
import { Link } from "next-view-transitions";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Icon, Num, Shell } from "@/components/ui";
import { Karaoke } from "@/components/steps";
import { useProject } from "@/lib/store";
import { DAYPARTS, DAYS, VOICES, brandPalette, buildDay, fmtClock } from "@/lib/ai";
import { playFpo, setVolume, speak, stopFpo, toHex } from "@/lib/browser";
import type { Promo } from "@/lib/types";

const PART_COLOUR = { morning: "var(--yellow)", midday: "var(--blue)", evening: "var(--pink)" };
// the landing page's turntable is the everyday player; the flat aurora holds its place while three.js loads
const RecordHero = dynamic(() => import("@/components/record"), { ssr: false, loading: () => <div className="art-wait" /> });
const OPEN = 7 * 60, CLOSE = 22 * 60;
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const partAt = (m: number) => Math.max(0, DAYPARTS.findIndex((d) => m >= d.start && m < d.end));

export default function PlayerPage() {
  return <Suspense><Player /></Suspense>;
}

function Player() {
  const { p, ready, update } = useProject();
  const q = useSearchParams();
  const day = Math.min(6, Math.max(0, Number(q.get("day") ?? (new Date().getDay() + 6) % 7) || 0));
  const [clock, setClock] = useState(() => {
    const part = DAYPARTS.find((d) => d.id === q.get("part"));
    if (part) return part.start + 5;
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    return now >= OPEN && now < CLOSE ? now : OPEN + 84;
  });
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [vol, setVol] = useState(70);
  const [announcing, setAnnouncing] = useState<string | null>(null);
  const minuteAcc = useRef(0);
  // a ban can be taken back for a few seconds
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);
  const ticked = useRef(false);

  const plan = useMemo(() => (p.vibe && p.soundboard ? buildDay(p, day) : null), [p, day]);
  const pi = partAt(clock);
  const part = DAYPARTS[pi];
  const tracks = plan?.[pi].tracks ?? [];
  const track = tracks[idx % Math.max(1, tracks.length)];
  const dur = track ? 170 + (track.bpm % 7) * 12 : 200;
  const dayPromos = useMemo(() => p.promos.filter((x) => x.days.includes(day)).flatMap((x) => x.times.map((m) => ({ m, promo: x }))).sort((a, b) => a.m - b.m), [p.promos, day]);
  const nextPromo = dayPromos.find((x) => x.m > clock);

  // an announcement lifts the needle, reads karaoke-style, then the record carries on
  const [said, setSaid] = useState<{ script: string; at: number } | null>(null);
  function announce(x: Promo) {
    setAnnouncing(x.title);
    setSaid({ script: x.script, at: -1 });
    speak(x.script, VOICES.indexOf(x.voice), {
      onWord: (at) => setSaid({ script: x.script, at }),
      onEnd: () => { setAnnouncing(null); setSaid(null); },
    });
  }

  // new part of the day starts its own list
  useEffect(() => { setIdx(0); setPos(0); }, [pi]);

  // FPO audio follows play state and the current song
  useEffect(() => {
    if (playing && track && !announcing) playFpo(track, vol);
    else stopFpo();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volume changes go through setVolume, not a restart
  }, [playing, track?.id, announcing]);
  useEffect(() => setVolume(vol), [vol]);
  useEffect(() => () => { stopFpo(); if ("speechSynthesis" in window) speechSynthesis.cancel(); }, []);

  // playback clock: 1s real = 1s of song; the venue clock moves a minute per real minute
  useEffect(() => {
    if (!playing || announcing) return;
    const t = setInterval(() => {
      setPos((s) => s + 0.25);
      minuteAcc.current += 0.25;
      if (minuteAcc.current >= 60) {
        minuteAcc.current = 0;
        setClock((c) => {
          const n = Math.min(CLOSE - 1, c + 1);
          if (n !== c) ticked.current = true;
          return n;
        });
      }
    }, 250);
    return () => clearInterval(t);
  }, [playing, announcing, dur]);
  // song finished: next one
  useEffect(() => {
    if (pos >= dur) { setIdx((i) => i + 1); setPos(0); }
  }, [pos, dur]);

  // announcements fire when the playing clock reaches them, not when you scrub past
  useEffect(() => {
    if (!ticked.current) return;
    ticked.current = false;
    const due = dayPromos.find((x) => x.m === clock);
    if (due) announce(due.promo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock]);

  if (!ready) return null;
  if (!plan || !track)
    return (
      <Shell step={8}>
        <div className="empty">
          <h1 className="serif">Nothing to play <em>just yet.</em></h1>
          <p>Approve your sample songs and build your week, and your player will be waiting here.</p>
          <Link className="btn" href="/setup/5"><Icon id="back" size={16} />Go to the vibe check</Link>
        </div>
      </Shell>
    );

  const skip = () => { setIdx((i) => i + 1); setPos(0); };
  const ban = () => {
    update((p) => ({ ...p, banned: [...p.banned, track.id] }));
    setPos(0);
    setUndo({ id: track.id, title: track.title });
  };
  const pct = (m: number) => ((m - OPEN) / (CLOSE - OPEN)) * 100;
  const words = track.title.split(" ");
  const stats = [
    { k: "Energy", v: track.energy, w: track.energy, h: "Calm 0 to lively 100" },
    { k: "Brand fit", v: track.fit ?? 80, w: track.fit ?? 80, h: "How closely it matches your brand map" },
    { k: "Warmth", v: track.warmth, w: track.warmth, h: "Acoustic and mellow vs bright and electronic" },
    { k: "Tempo", v: track.bpm, w: Math.min(100, ((track.bpm - 60) / 80) * 100), h: "Beats per minute", unit: "BPM" },
  ];

  return (
    <Shell crumbs={[{ label: "This week", href: "/week" }, { label: DAYS[day] }, { label: "Now playing" }]}>
      <div className="player">
        <div className="sleeve-wrap">
          <div className="sleeve deck3d"><RecordHero palette={brandPalette(p.brand)} name={p.brand.name} part={part.id} playing={playing && !announcing} swapKey={track.id} /></div>
          <div className="caption"><span className="serif">{p.brand.name}</span><span>{DAYS[day]} · {part.label}</span></div>
          <div className="legend" aria-label="What the cover art shows">
            <div><b>Colour</b>Your brand palette, lit for the time of day<span className="swatches">{brandPalette(p.brand).map((c, i) => <i key={i} style={{ background: toHex(c) }} />)}</span></div>
            <div><b>Movement</b>How energetic the song is<br />Energy {track.energy}</div>
            <div><b>Speed</b>The song&apos;s tempo<br />{track.bpm} BPM</div>
          </div>
        </div>

        <div className="np">
          <p className="meta">Song {(idx % tracks.length) + 1} of {tracks.length} · {part.label}</p>
          <h1 className="serif">{words.slice(0, -1).join(" ")} <em>{words.at(-1)}.</em></h1>
          <p className="meta">{track.desc} · {track.genre} · placeholder audio</p>
          {track.why && <p className="why"><b>Why it&apos;s playing:</b> {track.why}.</p>}
          {announcing && (
            <div className="announce" role="status">
              <span className="announce-head"><Icon id="mic" />On the mic: {announcing}</span>
              {said && <Karaoke text={said.script} at={said.at} />}
            </div>
          )}

          {undo && (
            <div className="toast" role="status">
              <span>Won&apos;t play &ldquo;{undo.title}&rdquo; again.</span>
              <button className="link" onClick={() => { update((p) => ({ ...p, banned: p.banned.filter((x) => x !== undo.id) })); setUndo(null); }}>Undo</button>
            </div>
          )}
          <div className="transport">
            <div className="bar" aria-hidden="true"><i style={{ width: `${(pos / dur) * 100}%` }} /></div>
            <div className="times-row"><span>{fmtTime(pos)}</span><span>{fmtTime(dur)}</span></div>
            <div className="ctrls">
              <button className="big" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}><Icon id={playing ? "pause" : "play"} /></button>
              <button className="ctrl" onClick={skip}><Icon id="skip" />Skip</button>
              <button className="link ban-link" onClick={ban}>Never play this song</button>
              <label className="vol"><Icon id="vol" /><span className="sr">Volume</span><input type="range" min={0} max={100} value={vol} onChange={(e) => setVol(+e.target.value)} /></label>
            </div>
          </div>

          <div className="profile">
            {stats.map((s) => (
              <div key={s.k} className="stat">
                <div className="k">{s.k}</div>
                <div className="v serif"><Num value={s.v} />{s.unit && <small>{s.unit}</small>}</div>
                <div className="meter"><i style={{ transform: `scaleX(${s.w / 100})` }} /></div>
                <div className="h">{s.h}</div>
              </div>
            ))}
          </div>

          <div className="day">
            <div className="day-head">
              <h3>{DAYS[day]} at {p.brand.name}</h3>
              <p>
                {nextPromo ? <>Next announcement: <b>{nextPromo.promo.title}</b> in {nextPromo.m - clock} min · <button className="link" onClick={() => announce(nextPromo.promo)}>Play it now</button></> : "No more announcements today"}
              </p>
            </div>
            <div className="track-line">
              {DAYPARTS.map((d) => <div key={d.id} className="seg" style={{ flex: d.end - d.start, background: PART_COLOUR[d.id] }}>{d.label}</div>)}
              {dayPromos.map((x) => <div key={x.m + x.promo.id} className="promo-mark" style={{ left: `${pct(x.m)}%` }} title={`${fmtClock(x.m)} ${x.promo.title}`} />)}
              <div className="now" style={{ left: `${pct(clock)}%` }}><span>Now {fmtClock(clock)}</span></div>
            </div>
            <div className="axis"><span>07:00</span><span>11:00</span><span>16:00</span><span>22:00</span></div>
            <div className="scrub">
              <label htmlFor="scrub">Preview your day</label>
              <input id="scrub" type="range" min={OPEN} max={CLOSE - 1} value={clock} onChange={(e) => { setClock(+e.target.value); minuteAcc.current = 0; }} />
              <output htmlFor="scrub">{fmtClock(clock)}</output>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

"use client";
import { Link } from "next-view-transitions";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Aurora, Icon, Shell, STEPS } from "@/components/ui";
import { useProject } from "@/lib/store";
import { DAYPARTS, brandPalette, rank } from "@/lib/ai";
import { LIBRARY } from "@/lib/library";
import { playFpo, stopFpo } from "@/lib/browser";

// three.js only runs in the browser; the flat aurora holds the spot while it loads
const RecordHero = dynamic(() => import("@/components/record"), {
  ssr: false,
  loading: () => <Aurora palette={[[0.12, 0.16, 0.27], [0.78, 0.33, 0.24], [0.54, 0.64, 0.6], [0.95, 0.91, 0.84]]} part="evening" energy={45} bpm={84} />,
});

export default function Home() {
  const { p, ready, reset } = useProject();
  const started = ready && !!p.brand.name;
  const resume = STEPS.find((s) => s.n === p.step) ?? STEPS[0];
  const name = started ? p.brand.name : "your brand";
  const palette = brandPalette(p.brand);

  // one sample song per part of the day: the brand's own picks once there's a soundboard, house picks before that
  const samples = useMemo(
    () => DAYPARTS.map((d, i) => (p.soundboard ? rank(p, d.id)[0] : LIBRARY[[0, 7, 13][i]])),
    [p]
  );
  const [playing, setPlaying] = useState(false);
  const [onDeck, setOnDeck] = useState(false); // record is on the platter, needle can drop
  const [pi, setPi] = useState(0);
  const track = samples[pi];

  // while playing, walk through the day: morning → midday → evening
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPi((i) => (i + 1) % 3), 8000);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => {
    if (playing && track) playFpo(track);
    else stopFpo();
  }, [playing, track]);
  useEffect(() => () => stopFpo(), []);

  return (
    <Shell
      minimal={
        <Link className="top-link" href={started ? resume.href : "/setup/1"}>
          {started ? "Continue setup" : "Start"} <Icon id="arrow" size={16} />
        </Link>
      }
    >
      {/* the whole landing sits on the brand's aurora */}
      <div className="land-bg" aria-hidden="true">
        <Aurora palette={palette} part="evening" energy={35} bpm={70} />
      </div>
      <section className="land">
        <div>
          <h1 className="serif">
            A playlist that sounds like <em>{name}</em>.
          </h1>
          <p>Tell us who you are. We map your brand, pick the music for every part of your day, add your announcements, and hand you a week that plays itself.</p>
          <div className="land-actions">
            {started ? (
              <>
                <Link className="btn" href={resume.href}>
                  Continue {p.brand.name} <Icon id="arrow" size={16} />
                </Link>
                <button className="btn ghost" onClick={reset}>Start a new brand</button>
              </>
            ) : (
              <Link className="btn" href="/setup/1">
                Start with your brand <Icon id="arrow" size={16} />
              </Link>
            )}
          </div>
        </div>
        <div className="land-art">
          <div className="art record">
            <RecordHero palette={palette} name={started ? p.brand.name : "brandbeat"} part={DAYPARTS[pi].id} playing={playing} onReady={() => setOnDeck(true)} />
            {/* a plain button over the scene, so the canvas isn't nested inside it */}
            <button className="art-hit" onClick={() => onDeck && setPlaying(!playing)} aria-disabled={!onDeck} aria-pressed={playing} aria-label={playing ? "Lift the needle" : `Drop the needle on ${name}'s day`} />
          </div>
          {track && (
            <div className="now-chip">
              <button className="ic" onClick={() => setPlaying(!playing)} disabled={!onDeck} aria-label={playing ? "Lift the needle" : "Drop the needle"}>
                <Icon id={playing ? "pause" : "play"} />
              </button>
              <span aria-live="polite">
                <b>{playing ? `Now playing · ${DAYPARTS[pi].label}` : onDeck ? "Tap to drop the needle" : "Putting the record on…"}</b>
                <small>{track.title} · {track.bpm} BPM · placeholder audio</small>
              </span>
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}

"use client";
import Link from "next/link";
import { Aurora, Icon, Shell, STEPS } from "@/components/ui";
import { useProject } from "@/lib/store";

export default function Home() {
  const { p, ready, reset } = useProject();
  const started = ready && !!p.brand.name;
  const resume = STEPS.find((s) => s.n === p.step) ?? STEPS[0];
  return (
    <Shell>
      <section className="land">
        <div>
          <h1 className="serif">
            A playlist that sounds <em>like your brand.</em>
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
        <div className="art">
          <Aurora palette={p.brand.palette} part="evening" energy={45} bpm={84} />
        </div>
      </section>
    </Shell>
  );
}

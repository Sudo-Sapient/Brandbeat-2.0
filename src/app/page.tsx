"use client";
import { Link } from "next-view-transitions";
import { Shell, STEPS } from "@/components/ui";
import { useProject } from "@/lib/store";
export default function Home() {
  const { p, ready, reset } = useProject();
  if (!ready) return null;
  const started = !!p.brand.name; const resume = STEPS.find((s) => s.n === Math.min(8, p.step)) ?? STEPS[0];
  return <Shell minimal={<span className="muted">Music for your business</span>}><section className="land"><h1>Your brand. Your music.</h1><p>Set up your sound, review songs and schedule your week.</p><div className="land-actions"><Link className="btn" href={started ? resume.href : "/setup/1"}>{started ? "Continue setup" : "Set up brand"}</Link>{started && <button className="btn ghost" onClick={() => { if (window.confirm("Clear this browser’s saved brand and start again?")) reset(); }}>New brand</button>}</div><dl className="setup-summary"><div><dt>Brand</dt><dd>{p.brand.name || "Not set"}</dd></div><div><dt>Progress</dt><dd>{started ? `${Math.min(8, p.step)} of 8 · ${resume.label}` : "Ready to begin"}</dd></div><div><dt>Storage</dt><dd>This browser only</dd></div></dl></section></Shell>;
}

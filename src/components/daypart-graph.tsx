import type { Track } from "@/lib/types";

/** Energy by scheduled song order; not invented clock-time or audience data. */
export function DaypartGraph({ tracks, label }: { tracks: Track[]; label: string }) {
  const x = (i: number) => 34 + i * 266 / Math.max(1, tracks.length - 1);
  const y = (energy: number) => 112 - Math.max(0, Math.min(100, energy)) * .9;
  const points = tracks.map((t, i) => `${x(i)},${y(t.energy)}`).join(" ");
  const average = tracks.length ? Math.round(tracks.reduce((sum, t) => sum + t.energy, 0) / tracks.length) : 0;
  return <figure className="daypart-graph"><figcaption><span>Energy</span><strong>{average} avg</strong></figcaption>{tracks.length ? <svg viewBox="0 0 320 140" role="img" aria-label={`${label}: energy by song order, average ${average} out of 100`}><title>{label} energy</title>{[0, 50, 100].map((v) => <g key={v}><line x1="34" x2="300" y1={y(v)} y2={y(v)} className="graph-grid" /><text x="26" y={y(v) + 4} textAnchor="end">{v}</text></g>)}<polygon points={`${x(0)},${y(0)} ${points} ${x(tracks.length - 1)},${y(0)}`} className="graph-area" /><line x1="34" x2="300" y1={y(average)} y2={y(average)} className="graph-avg" /><polyline points={points} fill="none" className="graph-line" />{tracks.map((t, i) => <circle key={`${t.id}-${i}`} cx={x(i)} cy={y(t.energy)} r="3" className="graph-point"><title>{i + 1}. {t.title}: {t.energy}/100</title></circle>)}<text x="34" y="133">Song 1</text><text x="300" y="133" textAnchor="end">{tracks.length}</text></svg> : <p className="help">No songs scheduled.</p>}<details><summary>Values</summary><ol>{tracks.map((t, i) => <li key={`${t.id}-${i}`}><span>{i + 1}. {t.title}</span><span>{t.energy}/100</span></li>)}</ol></details></figure>;
}

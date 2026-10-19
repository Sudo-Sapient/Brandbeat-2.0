"use client";
import { Link } from "next-view-transitions";
import { useProject } from "@/lib/store";

// Retained for the unused legacy illustration modules; the working UI has no decorative motion.
export const reducedMotion = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export function NavDirection() { return null; }
export function IconSprite() {
  return <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></symbol>
    <symbol id="i-pause" viewBox="0 0 24 24"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none" /></symbol>
    <symbol id="i-skip" viewBox="0 0 24 24"><path d="M5 5l9 7-9 7z" fill="currentColor" stroke="none" /><path d="M18 5v14" /></symbol>
    <symbol id="i-swap" viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3" /></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" /></symbol>
    <symbol id="i-ban" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M6.5 6.5l11 11" /></symbol>
    <symbol id="i-vol" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM16.5 9a4 4 0 010 6" /></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></symbol>
    <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M19 12a7 7 0 11-2.05-4.95M19 4v4h-4" /></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" /></symbol>
    <symbol id="i-back" viewBox="0 0 24 24"><path d="M20 12H5M11 6l-6 6 6 6" /></symbol>
    <symbol id="i-mic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></symbol>
  </svg>;
}
export const Icon = ({ id, size = 20 }: { id: string; size?: number }) => <svg className="i" aria-hidden="true" style={{ width: size, height: size }}><use href={`#i-${id}`} /></svg>;
export const Num = ({ value }: { value: number }) => <span>{value}</span>;
export const STEPS = [
  { n: 1, label: "Brand", href: "/setup/1" }, { n: 2, label: "Customers", href: "/setup/2" }, { n: 3, label: "Aaker map", href: "/setup/3" }, { n: 4, label: "Soundboard", href: "/setup/4" }, { n: 5, label: "Songs", href: "/setup/5" }, { n: 6, label: "Announcements", href: "/setup/6" }, { n: 7, label: "Week", href: "/week" }, { n: 8, label: "Player", href: "/player" },
];
export function Shell({ step, crumbs, minimal, children }: { step?: number; crumbs?: { label: string; href?: string }[]; minimal?: React.ReactNode; children: React.ReactNode }) {
  const { p } = useProject();
  return <div className="screen"><a href="#main" className="skip">Skip to content</a><header className="top"><Link href="/" className="logo" aria-label="Brandbeat home"><span>B</span>randbeat</Link><span className="demo-label" title="Simulated recommendations, placeholder music and browser voices">Demo</span>{p.brand.name && <span className="venue">{p.brand.name}</span>}<div className="top-action">{minimal ?? <Link className="top-link" href="/week">Weekly schedule</Link>}</div></header>
    <div className={`workspace${minimal ? " workspace-minimal" : ""}`}>
    {!minimal && <nav className="setup-nav" aria-label="Setup"><ol className="steps">{STEPS.map((s) => <li key={s.n} className={s.n < p.step && s.n !== step ? "done" : undefined} aria-current={s.n === step ? "step" : undefined}>{s.n <= p.step && s.n !== step ? <Link href={s.href}>{s.label}{s.n < p.step && <Icon id="check" size={14} />}</Link> : <span>{s.label}</span>}</li>)}</ol></nav>}
    <div className="workspace-content">
    {crumbs && <ol className="crumbs" aria-label="Breadcrumb">{crumbs.map((c, i) => <li key={c.label} aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.href ? <Link href={c.href}>{c.label}</Link> : c.label}</li>)}</ol>}
    <main id="main">{children}</main></div></div></div>;
}
export function StepPage({ n, title, lede, children, next, busy }: { n: number; title: React.ReactNode; lede: string; children: React.ReactNode; next: { label: string; onClick: () => void; disabled?: boolean; status?: React.ReactNode }; busy?: string[] | null }) {
  const prev = STEPS.find((s) => s.n === n - 1);
  return <Shell step={n}><div className="hero"><h1>{title}</h1><p>{lede}</p></div><div className="body" aria-busy={!!busy}><fieldset className="step-fields" disabled={!!busy}>{children}</fieldset></div><div className="proceed"><p role="status">{busy ? busy[0] : next.status}</p><div className="proceed-actions">{prev && <Link className="btn ghost" href={prev.href}>Back</Link>}<button className="btn" disabled={next.disabled || !!busy} onClick={next.onClick}>{busy ? "Working…" : next.label}<Icon id="arrow" size={16} /></button></div></div></Shell>;
}

// Smallest check for the song-matching logic. Run: npm run check
import assert from "node:assert/strict";
import { buildDay, pickVibe, rank, score } from "../src/lib/ai";
import { LIBRARY } from "../src/lib/library";
import type { Project } from "../src/lib/types";

const sb = { energy: 48, tempo: 92, warmth: 80, vocals: 35, genres: ["Bossa"], avoid: ["Indie pop"] };
const p: Project = {
  step: 5,
  brand: { name: "Test", category: "Café / coffee", description: "", assets: [], palette: [] },
  segments: [],
  brandMap: null,
  soundboard: sb,
  vibe: null,
  promos: [],
  banned: ["t0"],
};

// scores stay in range
for (const t of LIBRARY) for (const part of ["morning", "midday", "evening"] as const) {
  const s = score(t, sb, part);
  assert.ok(s >= 40 && s <= 99, `score out of range: ${s}`);
}

// avoided genres and banned songs never appear; results are best-first
const r = rank(p, "morning");
assert.ok(r.every((t) => t.genre !== "Indie pop" && t.id !== "t0"));
assert.ok(r.every((t, i) => i === 0 || r[i - 1].fit! >= t.fit!));

(async () => {
  // regenerate keeps pinned songs first, excludes the old ones, always returns 5
  const keep = [r[3]];
  const old = r.slice(0, 5).map((t) => t.id);
  const v = await pickVibe(p, "evening", keep, old);
  assert.equal(v.length, 5);
  assert.equal(v[0].id, keep[0].id);
  assert.ok(v.slice(1).every((t) => !old.includes(t.id)));

  // A small eligible catalogue must not silently shrink the sample list.
  const limited = { ...p, banned: LIBRARY.slice(6).map((t) => t.id), soundboard: { ...sb, avoid: [] } };
  const first = await pickVibe(limited, "morning");
  const again = await pickVibe(limited, "morning", [first[0]], first.map((t) => t.id));
  assert.equal(again.length, 5, "regeneration must retain five songs when only one fresh match exists");
  assert.equal(new Set(again.map((t) => t.id)).size, 5);
  assert.equal(again[0].id, first[0].id);
  assert.ok(again.some((t) => !first.some((old) => old.id === t.id)));

  // the day plan puts approved songs first and drops banned ones
  const approved = { tracks: v, pinned: [], approved: true };
  const day = buildDay({ ...p, vibe: { morning: approved, midday: approved, evening: approved }, banned: ["t0", v[1].id] }, 2);
  assert.equal(day.length, 3);
  assert.equal(day[0].tracks[0].id, v[0].id);
  assert.ok(day.every((d) => d.tracks.every((t) => t.id !== v[1].id)));

  const edited = { ...p, vibe: { morning: approved, midday: approved, evening: approved }, scheduleEdits: { 0: { morning: [v[2], v[0]] } } };
  assert.deepEqual(buildDay(edited, 0)[0].tracks.map((t) => t.id), [v[2].id, v[0].id]);
  assert.notDeepEqual(buildDay(edited, 1)[0].tracks.map((t) => t.id), [v[2].id, v[0].id]);
  assert.deepEqual(buildDay({ ...edited, banned: [v[2].id] }, 0)[0].tracks.map((t) => t.id), [v[0].id]);
  console.log("ok: song matching and manual schedules");
})();

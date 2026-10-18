"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Project, RGB } from "./types";

const KEY = "brandbeat:v1";

export const DEFAULT_PALETTE: RGB[] = [
  [0.12, 0.16, 0.27],
  [0.78, 0.33, 0.24],
  [0.54, 0.64, 0.6],
  [0.95, 0.91, 0.84],
];

const EMPTY: Project = {
  step: 1,
  brand: { name: "", category: "", description: "", assets: [], palette: DEFAULT_PALETTE },
  segments: [],
  brandMap: null,
  soundboard: null,
  vibe: null,
  promos: [],
  banned: [],
};

type Ctx = { p: Project; ready: boolean; update: (fn: (p: Project) => Project) => void; reset: () => void };
const C = createContext<Ctx | null>(null);

// ponytail: localStorage only; production moves this to the database behind the same update() API
export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [p, setP] = useState<Project>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setP({ ...EMPTY, ...JSON.parse(saved) });
    } catch {}
    setReady(true);
  }, []);

  const update = useCallback((fn: (p: Project) => Project) => {
    setP((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setP(EMPTY);
  }, []);

  return <C.Provider value={{ p, ready, update, reset }}>{children}</C.Provider>;
}

export function useProject() {
  const c = useContext(C);
  if (!c) throw new Error("useProject outside ProjectProvider");
  return c;
}

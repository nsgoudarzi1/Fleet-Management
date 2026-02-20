"use client";

import { useCallback, useEffect, useState } from "react";

export type DensityMode = "comfortable" | "compact";

const STORAGE_KEY = "fleetflow:density";
const EVENT_NAME = "fleetflow:density-change";

function readDensity(): DensityMode {
  if (typeof window === "undefined") return "comfortable";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "compact" ? "compact" : "comfortable";
}

function applyDensity(mode: DensityMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", mode);
}

export function useDensity() {
  const [density, setDensityState] = useState<DensityMode>(() => readDensity());

  useEffect(() => {
    applyDensity(readDensity());
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<DensityMode>).detail;
      if (detail === "comfortable" || detail === "compact") {
        setDensityState(detail);
        applyDensity(detail);
      }
    };
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
  }, []);

  const setDensity = useCallback((next: DensityMode) => {
    setDensityState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    }
    applyDensity(next);
  }, []);

  return { density, setDensity };
}

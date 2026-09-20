/**
 * Phase 25 — low-bandwidth mode.
 *
 * Syria's mobile networks are often 2G/3G and metered. When the browser reports
 * Save-Data or a slow connection we default to a data-saving mode that keeps map
 * tiles (the heaviest asset in the app) off until the user asks for them.
 * The preference is sticky per device and shared across components through a
 * window event so a toggle anywhere updates every map on screen.
 */
import { useCallback, useEffect, useState } from "react";

export const LOW_DATA_KEY = "ssan.lowdata";
const LOW_DATA_EVENT = "ssan:lowdata";

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

/** True when the browser itself signals a metered or very slow connection. */
export function detectSlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return conn.effectiveType === "slow-2g" || conn.effectiveType === "2g";
}

function readStored(): boolean | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LOW_DATA_KEY);
  if (raw === "on") return true;
  if (raw === "off") return false;
  return null;
}

export function useLowData() {
  // Always start false so server and first client render agree; the effect below
  // applies the stored or detected value right after hydration.
  const [lowData, setState] = useState(false);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    const stored = readStored();
    const detected = detectSlowConnection();
    setAuto(stored === null && detected);
    setState(stored ?? detected);
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<boolean>).detail;
      if (typeof next === "boolean") setState(next);
    };
    window.addEventListener(LOW_DATA_EVENT, onChange);
    return () => window.removeEventListener(LOW_DATA_EVENT, onChange);
  }, []);

  const setLowData = useCallback((next: boolean) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOW_DATA_KEY, next ? "on" : "off");
    window.dispatchEvent(new CustomEvent<boolean>(LOW_DATA_EVENT, { detail: next }));
    setState(next);
    setAuto(false);
  }, []);

  return { lowData, auto, setLowData };
}

/**
 * Locally rendered turn-by-turn instructions.
 *
 * Routing providers rarely return good Arabic. Rather than sending a user's
 * location to a translation model, we map the provider's numeric manoeuvre
 * type onto standardised Arabic/English templates here, on device.
 */
import { formatDistance } from "./geo";
import type { Lang, ManoeuvreType, RouteStep } from "./types";

/** openrouteservice instruction types → provider-neutral manoeuvres. */
const ORS_TYPE_MAP: Record<number, ManoeuvreType> = {
  0: "turn_left",
  1: "turn_right",
  2: "turn_sharp_left",
  3: "turn_sharp_right",
  4: "turn_slight_left",
  5: "turn_slight_right",
  6: "straight",
  7: "roundabout",
  8: "roundabout",
  9: "uturn",
  10: "arrive",
  11: "depart",
  12: "keep_left",
  13: "keep_right",
};

export function manoeuvreFromOrs(type: number): ManoeuvreType {
  return ORS_TYPE_MAP[type] ?? "unknown";
}

const TEMPLATES: Record<ManoeuvreType, { ar: (road?: string) => string; en: (road?: string) => string }> = {
  depart: {
    ar: (r) => (r ? `انطلق على ${r}` : "انطلق"),
    en: (r) => (r ? `Head out on ${r}` : "Head out"),
  },
  arrive: { ar: () => "وصلت إلى الوجهة", en: () => "Arrive at your destination" },
  straight: {
    ar: (r) => (r ? `تابع مستقيماً على ${r}` : "تابع مستقيماً"),
    en: (r) => (r ? `Continue straight on ${r}` : "Continue straight"),
  },
  turn_left: {
    ar: (r) => (r ? `انعطف يساراً إلى ${r}` : "انعطف يساراً"),
    en: (r) => (r ? `Turn left onto ${r}` : "Turn left"),
  },
  turn_right: {
    ar: (r) => (r ? `انعطف يميناً إلى ${r}` : "انعطف يميناً"),
    en: (r) => (r ? `Turn right onto ${r}` : "Turn right"),
  },
  turn_slight_left: {
    ar: (r) => (r ? `مِل يساراً قليلاً إلى ${r}` : "مِل يساراً قليلاً"),
    en: (r) => (r ? `Bear left onto ${r}` : "Bear left"),
  },
  turn_slight_right: {
    ar: (r) => (r ? `مِل يميناً قليلاً إلى ${r}` : "مِل يميناً قليلاً"),
    en: (r) => (r ? `Bear right onto ${r}` : "Bear right"),
  },
  turn_sharp_left: {
    ar: (r) => (r ? `انعطف يساراً بحدة إلى ${r}` : "انعطف يساراً بحدة"),
    en: (r) => (r ? `Sharp left onto ${r}` : "Sharp left"),
  },
  turn_sharp_right: {
    ar: (r) => (r ? `انعطف يميناً بحدة إلى ${r}` : "انعطف يميناً بحدة"),
    en: (r) => (r ? `Sharp right onto ${r}` : "Sharp right"),
  },
  uturn: { ar: () => "استدر عائداً", en: () => "Make a U-turn" },
  roundabout: {
    ar: (r) => (r ? `ادخل الدوار واخرج نحو ${r}` : "ادخل الدوار"),
    en: (r) => (r ? `At the roundabout, exit toward ${r}` : "Enter the roundabout"),
  },
  keep_left: {
    ar: (r) => (r ? `الزم اليسار نحو ${r}` : "الزم اليسار"),
    en: (r) => (r ? `Keep left toward ${r}` : "Keep left"),
  },
  keep_right: {
    ar: (r) => (r ? `الزم اليمين نحو ${r}` : "الزم اليمين"),
    en: (r) => (r ? `Keep right toward ${r}` : "Keep right"),
  },
  merge: {
    ar: (r) => (r ? `اندمج مع ${r}` : "اندمج مع المسار"),
    en: (r) => (r ? `Merge onto ${r}` : "Merge"),
  },
  ramp: {
    ar: (r) => (r ? `اسلك المخرج نحو ${r}` : "اسلك المخرج"),
    en: (r) => (r ? `Take the ramp toward ${r}` : "Take the ramp"),
  },
  unknown: { ar: () => "تابع حسب الطريق", en: () => "Continue" },
};

export function instructionText(step: RouteStep, lang: Lang): string {
  const road = step.road_name?.trim() || undefined;
  const base = TEMPLATES[step.manoeuvre][lang](road);
  if (step.manoeuvre === "roundabout" && step.exit_number) {
    return lang === "ar"
      ? `${base} — المخرج رقم ${step.exit_number}`
      : `${base} — exit ${step.exit_number}`;
  }
  return base;
}

/** "In 300 m, turn right onto Baghdad Street" */
export function instructionWithDistance(step: RouteStep, lang: Lang): string {
  const text = instructionText(step, lang);
  if (step.manoeuvre === "depart" || step.distance_m < 20) return text;
  return lang === "ar"
    ? `بعد ${formatDistance(step.distance_m, "ar")}: ${text}`
    : `In ${formatDistance(step.distance_m, "en")}: ${text}`;
}

export const MANOEUVRE_ICON: Record<ManoeuvreType, string> = {
  depart: "→",
  arrive: "◉",
  straight: "↑",
  turn_left: "←",
  turn_right: "→",
  turn_slight_left: "↖",
  turn_slight_right: "↗",
  turn_sharp_left: "↰",
  turn_sharp_right: "↱",
  uturn: "↺",
  roundabout: "⟳",
  keep_left: "↖",
  keep_right: "↗",
  merge: "⤵",
  ramp: "⤴",
  unknown: "•",
};

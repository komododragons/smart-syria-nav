/**
 * Syriasan bilingual layer.
 *
 * Arabic is the primary language (RTL). English is a full peer (LTR).
 * Strings are written inline at the point of use as { ar, en } pairs so every
 * new feature is authored in both languages at once — the Arabic side is
 * written as proper civic Arabic, never machine-translated.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ar" | "en";

export const LANG_STORAGE_KEY = "ssan.lang";
export const DEFAULT_LANG: Lang = "ar";

export type Bilingual = { ar: string; en: string };

export function isLang(value: unknown): value is Lang {
  return value === "ar" || value === "en";
}

type I18nValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  isRtl: boolean;
  /** Pick the string for the active language. */
  t: (value: Bilingual) => string;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** Pick a localized record name with graceful fallback to the other language. */
  name: (record: { name_ar?: string | null; name_en?: string | null } | null | undefined) => string;
  /** Locale-aware number formatting (Western digits kept for codes/among Latin text). */
  num: (value: number, options?: Intl.NumberFormatOptions) => string;
  date: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  locale: string;
};

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(stored)) return stored;
    const nav = window.navigator?.language?.toLowerCase() ?? "";
    if (nav.startsWith("en")) return "en";
  } catch {
    /* storage may be unavailable */
  }
  return DEFAULT_LANG;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Always start from the SSR default so hydration matches, then adopt the
  // stored preference after mount.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const stored = readStoredLang();
    if (stored !== lang) setLangState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const locale = lang === "ar" ? "ar-SY" : "en-GB";
    return {
      lang,
      locale,
      dir: lang === "ar" ? "rtl" : "ltr",
      isRtl: lang === "ar",
      t: (pair) => pair[lang],
      setLang,
      toggleLang: () => setLang(lang === "ar" ? "en" : "ar"),
      name: (record) => {
        if (!record) return "";
        const primary = lang === "ar" ? record.name_ar : record.name_en;
        const fallback = lang === "ar" ? record.name_en : record.name_ar;
        return (primary || fallback || "").trim();
      },
      num: (value, options) => new Intl.NumberFormat(locale, options).format(value),
      date: (value, options) =>
        new Intl.DateTimeFormat(locale, options ?? { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(value),
        ),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Safe fallback for components rendered outside the provider (e.g. embeds).
  const locale = "ar-SY";
  return {
    lang: DEFAULT_LANG,
    locale,
    dir: "rtl",
    isRtl: true,
    t: (pair) => pair.ar,
    setLang: () => undefined,
    toggleLang: () => undefined,
    name: (record) => (record ? (record.name_ar || record.name_en || "").trim() : ""),
    num: (value, options) => new Intl.NumberFormat(locale, options).format(value),
    date: (value, options) =>
      new Intl.DateTimeFormat(locale, options ?? { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      ),
  };
}

/* ------------------------------------------------------------------ */
/* Address formatting                                                  */
/* ------------------------------------------------------------------ */

export type AddressParts = {
  unit?: string | null;
  floor?: string | null;
  building?: string | null;
  street?: string | null;
  landmark?: string | null;
  neighborhood?: string | null;
  district?: string | null;
  city?: string | null;
  governorate?: string | null;
  country?: string | null;
};

const AR_LABELS = {
  unit: "وحدة",
  floor: "الطابق",
  building: "بناء",
  street: "شارع",
  landmark: "قرب",
  country: "سوريا",
};

const EN_LABELS = {
  unit: "Unit",
  floor: "Floor",
  building: "Bldg.",
  street: "St.",
  landmark: "near",
  country: "Syria",
};

/**
 * Natural Syrian address order, specific → general, in both languages.
 * Arabic: «وحدة ٣ · الطابق ٢ · بناء ١٧ · شارع بغداد · المزة · دمشق · سوريا»
 * English: "Unit 3, Floor 2, Bldg. 17, Baghdad St., Mazzeh, Damascus, Syria"
 */
export function formatAddressLine(parts: AddressParts, lang: Lang): string {
  const L = lang === "ar" ? AR_LABELS : EN_LABELS;
  const segments: string[] = [];
  const push = (v?: string | null) => {
    const value = (v ?? "").trim();
    if (value) segments.push(value);
  };

  if (parts.unit) push(`${L.unit} ${parts.unit}`);
  if (parts.floor) push(`${L.floor} ${parts.floor}`);
  if (parts.building) push(lang === "ar" ? `${L.building} ${parts.building}` : `${L.building} ${parts.building}`);
  if (parts.street) {
    const street = parts.street.trim();
    const hasWord = lang === "ar" ? /شارع|جادة|طريق/.test(street) : /\b(st|street|road|rd|ave)\b/i.test(street);
    push(hasWord ? street : lang === "ar" ? `${L.street} ${street}` : `${street} ${L.street}`);
  }
  if (parts.landmark) push(`${L.landmark} ${parts.landmark}`);
  push(parts.neighborhood);
  push(parts.district);
  push(parts.city);
  if (parts.governorate && parts.governorate !== parts.city) push(parts.governorate);
  push(parts.country ?? L.country);

  return segments.join(lang === "ar" ? " · " : ", ");
}

/** Short one-line locality summary, e.g. «المزة، دمشق» / "Mazzeh, Damascus". */
export function formatLocality(parts: AddressParts, lang: Lang): string {
  const segments = [parts.neighborhood, parts.district, parts.city, parts.governorate]
    .map((v) => (v ?? "").trim())
    .filter((v, i, arr) => v && arr.indexOf(v) === i);
  return segments.join(lang === "ar" ? "، " : ", ");
}

/** Distance in a natural phrasing for each language. */
export function formatDistance(metres: number, lang: Lang): string {
  if (!Number.isFinite(metres)) return "";
  if (metres < 1000) {
    const rounded = Math.round(metres / 10) * 10;
    return lang === "ar" ? `${rounded} م` : `${rounded} m`;
  }
  const km = metres / 1000;
  const value = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return lang === "ar" ? `${value} كم` : `${value} km`;
}

/** Duration in a natural phrasing for each language. */
export function formatDuration(seconds: number, lang: Lang): string {
  if (!Number.isFinite(seconds)) return "";
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return lang === "ar" ? `${mins} دقيقة` : `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (lang === "ar") {
    const h = hours === 1 ? "ساعة" : hours === 2 ? "ساعتان" : `${hours} ساعات`;
    return rest ? `${h} و${rest} دقيقة` : h;
  }
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/**
 * Phase 25 — home-screen install nudge.
 *
 * Shown once per device, only on phones, only when the browser offers a real
 * install prompt. Dismissal is remembered so it never nags a courier mid-route.
 */
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { useI18n } from "@/lib/i18n";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ssan.install.dismissed";

export function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
  };

  return (
    <div className="fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-lg md:inset-x-auto md:end-4 md:bottom-4 md:max-w-sm">
      <Download className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold">
          {t({ ar: "ثبّت سيرياسان على هاتفك", en: "Install Syriasan on your phone" })}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {t({
            ar: "فتح أسرع، ويعمل حتى مع ضعف الشبكة.",
            en: "Opens faster and keeps working on weak networks.",
          })}
        </p>
      </div>
      <button
        type="button"
        onClick={async () => {
          const event = deferred;
          setDeferred(null);
          window.localStorage.setItem(DISMISS_KEY, "1");
          await event.prompt();
          await event.userChoice;
        }}
        className="min-h-11 shrink-0 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground"
      >
        {t({ ar: "تثبيت", en: "Install" })}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t({ ar: "إخفاء", en: "Dismiss" })}
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

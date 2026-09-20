import { useState } from "react";
import { Check, Copy } from "lucide-react";

export type CodeSamples = {
  curl: string;
  javascript: string;
  typescript: string;
};

const LANGS: { id: keyof CodeSamples; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
];

/** Copyable, language-tabbed code block used across the developer portal. */
export function CodeTabs({ samples }: { samples: CodeSamples }) {
  const [lang, setLang] = useState<keyof CodeSamples>("curl");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(samples[lang]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <div className="flex gap-1">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id)}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-bold ${
                lang === l.id ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "تم النسخ" : "نسخ"}
        </button>
      </div>
      <pre
        dir="ltr"
        className="max-h-[420px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-foreground"
      >
        {samples[lang]}
      </pre>
    </div>
  );
}

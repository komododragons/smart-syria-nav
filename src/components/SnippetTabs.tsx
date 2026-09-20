import { useState } from "react";
import { Check, Copy } from "lucide-react";

export type Snippet = { id: string; label: string; code: string };

/** Copyable tabbed code block with arbitrary language/platform tabs. */
export function SnippetTabs({ snippets }: { snippets: Snippet[] }) {
  const [active, setActive] = useState(snippets[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const current = snippets.find((s) => s.id === active) ?? snippets[0];

  const copy = async () => {
    if (!current) return;
    await navigator.clipboard.writeText(current.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <div className="flex flex-wrap gap-1">
          {snippets.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-bold ${
                current?.id === s.id ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? t({ ar: "تم النسخ", en: "Copied" }) : t({ ar: "نسخ", en: "Copy" })}
        </button>
      </div>
      <pre
        dir="ltr"
        className="max-h-[460px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-foreground"
      >
        {current?.code ?? ""}
      </pre>
    </div>
  );
}

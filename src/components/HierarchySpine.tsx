import { NODE_TYPE_LABELS } from "@/lib/smart-address";

export type SpineLevel = {
  id: string;
  node_type: string;
  display_name: string;
  name_en?: string | null;
  detail?: string | null;
  code?: string | null;
  emphasis?: "site" | "access" | "muted";
};

/**
 * The hierarchy spine: property → building → entrance → floor → unit.
 * Recurring structural component of the network UI.
 */
export function HierarchySpine({ levels }: { levels: SpineLevel[] }) {
  return (
    <div className="relative flex flex-col gap-7">
      <div className="spine-line absolute end-[11px] top-2 w-[2px] bg-border" />
      {levels.map((level) => {
        const dot =
          level.emphasis === "access"
            ? "bg-primary"
            : level.emphasis === "muted"
              ? "bg-secondary"
              : "bg-foreground";
        return (
          <div
            key={level.id}
            className={`relative flex items-start gap-4 pe-8 ${level.emphasis === "muted" ? "opacity-70" : ""}`}
          >
            <div
              className={`absolute end-0 top-1.5 grid size-6 place-items-center rounded-full border-4 border-surface ring-1 ring-border ${dot}`}
            >
              <span className="size-1.5 rounded-full bg-surface" />
            </div>
            <div className="flex flex-1 flex-col">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide ${level.emphasis === "muted" ? "text-muted-foreground" : "text-primary"}`}
              >
                {NODE_TYPE_LABELS[level.node_type] ?? level.node_type}
              </span>
              <span className="font-bold leading-tight">{level.display_name}</span>
              {level.name_en ? (
                <span className="font-mono text-[11px] text-muted-foreground">{level.name_en}</span>
              ) : null}
              {level.detail ? (
                <span className="text-xs text-muted-foreground">{level.detail}</span>
              ) : null}
            </div>
            {level.code ? (
              <span className="rounded-md border border-border bg-secondary px-2 py-1 font-mono text-xs">
                {level.code}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

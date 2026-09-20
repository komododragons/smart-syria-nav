import { Link } from "@tanstack/react-router";
import { Navigation2 } from "lucide-react";

import { logAddressEvent } from "@/lib/orgs.functions";
import type { TravelMode } from "@/lib/navigation/types";

type Props = {
  code: string;
  mode?: TravelMode | undefined;
  token?: string | undefined;
  context?: string | undefined;
  variant?: "solid" | "outline" | "chip";
  className?: string | undefined;
  label?: string;
};

const VARIANTS = {
  solid:
    "flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground",
  outline:
    "inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold",
  chip: "inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary",
} as const;

/** Single entry point into the navigation workspace, used across the app. */
export function DirectionsButton({
  code,
  mode,
  token,
  context,
  variant = "outline",
  className,
  label = "الحصول على الاتجاهات",
}: Props) {
  return (
    <Link
      to="/navigation/$code"
      params={{ code }}
      search={{
        mode: mode ?? undefined,
        token: token ?? undefined,
        ctx: (context ?? undefined) as never,
      }}
      onClick={(event) => {
        event.stopPropagation();
        void logAddressEvent({
          data: { code, event: "navigate_start", source: mode ?? "default" },
        }).catch(() => undefined);
      }}
      className={className ?? VARIANTS[variant]}
    >
      <Navigation2 className="size-3.5" />
      {label}
    </Link>
  );
}

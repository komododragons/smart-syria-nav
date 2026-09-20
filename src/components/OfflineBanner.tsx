import { Link } from "@tanstack/react-router";
import { CloudOff } from "lucide-react";

import { useOnline } from "@/hooks/use-online";

/**
 * Persistent honesty banner: while offline, verification state, opening hours
 * and route data come from a local copy and may be out of date.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-destructive px-3 py-2 text-center text-[11px] font-bold leading-snug text-destructive-foreground">
      <CloudOff className="size-3.5 shrink-0" />
      <span>
        أنت دون اتصال — تُعرض نسخة محفوظة محلياً، وقد تكون حالة التوثيق ومعلومات المسار غير محدّثة.
      </span>
      <Link to="/offline" className="shrink-0 underline underline-offset-2">
        العناوين المحفوظة
      </Link>
    </div>
  );
}

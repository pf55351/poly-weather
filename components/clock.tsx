"use client";

import { useEffect, useState } from "react";
import { Clock as ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Orario attuale (24h) che si aggiorna ogni secondo. Con `timeZone` mostra l'ora
// locale di quel fuso (es. l'ora corrente nella città).
export function Clock({ className, timeZone }: { className?: string; timeZone?: string }) {
  const [now, setNow] = useState("");

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("en-GB", {
          hour12: false,
          ...(timeZone ? { timeZone } : {}),
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeZone]);

  return (
    <span
      suppressHydrationWarning
      className={cn("inline-flex items-center gap-1.5 tabular-nums", className)}
    >
      <ClockIcon className="h-3.5 w-3.5" />
      {now}
    </span>
  );
}

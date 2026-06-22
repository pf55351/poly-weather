"use client";

import { useEffect, useState } from "react";
import { Timer, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// Conto alla rovescia alla chiusura del mercato (live). "Closed" se scaduto.
export function Countdown({
  endDate,
  className,
  showLabel = false,
}: {
  endDate: string | null;
  className?: string;
  showLabel?: boolean;
}) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const t = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);

  if (!endDate || nowMs === null) return null;
  const diff = new Date(endDate).getTime() - nowMs;

  if (diff <= 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 font-semibold text-amber-400", className)}>
        <Lock className="h-3.5 w-3.5" /> Closed
      </span>
    );
  }

  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  // >1h: "2h 13m" · <1h: "13m 05s"
  const txt =
    h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;

  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums text-muted-foreground", className)}>
      <Timer className="h-3.5 w-3.5 text-primary" />
      {showLabel ? <span>closes in</span> : null}
      <span className="font-semibold text-foreground">{txt}</span>
    </span>
  );
}

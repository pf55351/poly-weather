"use client";

import { useAtom } from "jotai";
import { dayOffsetAtom } from "@/lib/atoms";
import { todayISO, isoPlusDays, shortLabel } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

// Tab giorno condivisa (Oggi / Domani) usata in home e dettaglio: scrive su dayOffsetAtom.
export function DayTabs({ className }: { className?: string }) {
  const [offset, setOffset] = useAtom(dayOffsetAtom);
  const today = todayISO();
  const tabs = [
    { o: 0, label: "Today" },
    { o: 1, label: "Tomorrow" },
  ];

  return (
    <div className={cn("inline-flex rounded-xl border border-border/60 bg-card/50 p-1", className)}>
      {tabs.map((t) => {
        const active = offset === t.o;
        return (
          <button
            key={t.o}
            onClick={() => setOffset(t.o)}
            className={cn(
              "flex items-baseline gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-colors",
              active ? "bg-primary/20 text-primary glow-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="text-sm font-medium tabular-nums opacity-90">
              {shortLabel(isoPlusDays(today, t.o))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

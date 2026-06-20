"use client";

import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DistRow {
  label: string;
  oracleProb: number;
  marketProb?: number | null;
  highlight?: boolean;
}

// Barre orizzontali: oracolo (pieno) con eventuale marcatore del mercato sovrapposto.
export function DistributionBars({ rows }: { rows: DistRow[] }) {
  const max = Math.max(0.01, ...rows.map((r) => Math.max(r.oracleProb, r.marketProb ?? 0)));

  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const oraclePct = (r.oracleProb / max) * 100;
        const hasMarket = r.marketProb !== null && r.marketProb !== undefined;
        const marketPct = hasMarket ? (r.marketProb! / max) * 100 : 0;
        return (
          <div key={r.label} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-xs">
            <span
              className={cn(
                "truncate tabular-nums",
                r.highlight ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {r.label}
            </span>
            <div className="relative h-4 rounded bg-muted/60 overflow-hidden">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded",
                  r.highlight ? "bg-emerald-500/70" : "bg-sky-500/55",
                )}
                style={{ width: `${oraclePct}%` }}
              />
              {hasMarket ? (
                <div
                  className="absolute inset-y-0 w-0.5 bg-foreground"
                  style={{ left: `${Math.min(marketPct, 99.5)}%` }}
                  title={`market ${pct(r.marketProb, 1)}`}
                />
              ) : null}
            </div>
            <span className="tabular-nums text-muted-foreground w-10 text-right">
              {pct(r.oracleProb, 0)}
            </span>
          </div>
        );
      })}
      <div className="flex gap-4 pt-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-sky-500/55" /> oracle
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-0.5 bg-foreground" /> market
        </span>
      </div>
    </div>
  );
}

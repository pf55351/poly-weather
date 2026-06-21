"use client";

import { Thermometer, Cloud } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DistributionBars, type DistRow } from "./distribution-bars";
import type { OracleResult } from "@/lib/oracle";
import type { TempBucket } from "@/lib/polymarket";
import { pct, temp } from "@/lib/format";

// Pannello oracolo: temp max più probabile + probabilità + distribuzione + fonti.
// Se `marketBuckets` è passato, le barre mostrano anche il marcatore del mercato.
export function OraclePanel({
  oracle,
  marketBuckets,
}: {
  oracle: OracleResult;
  marketBuckets?: TempBucket[];
}) {
  const { distribution: dist, sources, sourceCount, sampleCount } = oracle;
  const ml = dist.mostLikely;

  const marketByLabel = new Map<string, number>();
  marketBuckets?.forEach((b) => marketByLabel.set(b.label, b.yesPrice));

  const rows: DistRow[] = dist.buckets
    .filter((b) => b.probability > 0 || marketByLabel.has(b.label))
    .map((b) => ({
      label: b.label,
      oracleProb: b.probability,
      marketProb: marketByLabel.has(b.label) ? marketByLabel.get(b.label)! : null,
      highlight: ml?.label === b.label,
    }));

  return (
    <Card className="p-5 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-sky-500" />
          <h2 className="font-semibold">Weather oracle</h2>
        </div>
        <Tooltip>
          <TooltipTrigger render={<Badge variant="secondary" className="cursor-default" />}>
            {sourceCount} sources · {sampleCount} estimates
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <ul className="space-y-1 text-xs">
              {sources.map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span className={s.ok ? "" : "text-red-400 line-through"}>
                    {s.label}
                    {s.weight > 1 ? (
                      <span className="text-primary font-medium"> ·{s.weight}×</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums">
                    {s.ok ? `${s.memberCount}× · ${temp(s.meanC, "C", 1)}` : "ko"}
                  </span>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Temperatura massima più probabile */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg bg-muted/50 p-4">
        <Thermometer className="h-8 w-8 text-orange-500 shrink-0" />
        <div className="min-w-0">
          <div className="text-3xl font-bold tabular-nums leading-none">
            {ml ? ml.label : "—"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            most likely max · <span className="font-medium text-foreground">{pct(ml?.probability, 0)}</span>{" "}
            probability
          </div>
        </div>
        <div className="ml-auto text-right text-xs text-muted-foreground tabular-nums">
          <div>mean {temp(dist.stats.mean, dist.unit)}</div>
          <div>median {temp(dist.stats.median, dist.unit)}</div>
          <div>±{dist.stats.stdev.toFixed(1)}° spread</div>
        </div>
      </div>

      {rows.length > 0 ? (
        <div>
          <div className="text-xs text-muted-foreground mb-2">
            Probability distribution over the highest temperature
          </div>
          <DistributionBars rows={rows} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No forecast data available.</p>
      )}
    </Card>
  );
}

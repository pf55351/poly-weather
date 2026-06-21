"use client";

import { TrendingDown, TrendingUp, Radio, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MarketInfoDialog } from "./market-info-dialog";
import { EdgeBadge } from "./edge-badge";
import { polymarketBucketUrl, type TempBucket, type TempMarketEvent } from "@/lib/polymarket";
import type { City } from "@/lib/cities";
import { pct, usd, edgePoints, isAligned } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MarketCard({
  event,
  bucket,
  city,
  oracleProb,
  livePrice,
  isLive,
}: {
  event: TempMarketEvent;
  bucket: TempBucket;
  city: City;
  oracleProb: number | null;
  livePrice: number | null;
  isLive: boolean;
}) {
  const marketProb = livePrice ?? bucket.yesPrice;
  const change = bucket.oneDayPriceChange ?? 0;
  const edge = oracleProb !== null ? edgePoints(oracleProb, marketProb) : null;
  // Edge "di valore": oracolo più fiducioso del mercato (positivo e non trascurabile).
  const hasValueEdge = edge !== null && edge > 0 && !isAligned(edge);
  const orderUrl = polymarketBucketUrl(event.slug, bucket.slug);

  return (
    <Card
      className={cn(
        "relative p-4 gap-3 transition-all",
        hasValueEdge
          ? "border-emerald-500/70 ring-1 ring-emerald-500/40 shadow-[0_8px_30px_-12px] shadow-emerald-500/40"
          : "hover:border-primary/40 hover:glow-primary",
      )}
    >
      {/* L'intera card porta alla pagina d'ordine del mercato su Polymarket */}
      <a
        href={orderUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`Apri ${bucket.label} su Polymarket per piazzare un ordine`}
      />

      <div className="relative z-10 flex items-start justify-between gap-2 pointer-events-none">
        <span className="text-lg font-bold leading-tight">{bucket.label}</span>
        <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
          {isLive && livePrice !== null ? (
            <Tooltip>
              <TooltipTrigger
                render={<span className="grid place-items-center cursor-help" />}
                aria-label="Prezzo live"
              >
                <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
              </TooltipTrigger>
              <TooltipContent>Live price via WebSocket (Polymarket orderbook)</TooltipContent>
            </Tooltip>
          ) : null}
          <MarketInfoDialog event={event} bucket={bucket} city={city} />
        </div>
      </div>

      <div className="relative z-10 flex items-end justify-between pointer-events-none">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{pct(marketProb, 1)}</div>
          <div className="text-xs text-muted-foreground">market prob. (Yes)</div>
        </div>
        {change !== 0 ? (
          <div
            className={cn(
              "flex items-center gap-1 text-xs tabular-nums",
              change > 0 ? "text-emerald-500" : "text-red-500",
            )}
          >
            {change > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {pct(Math.abs(change), 1)}
          </div>
        ) : null}
      </div>

      <div className="relative z-10 flex items-center justify-between border-t pt-2 pointer-events-none">
        <div className="text-xs">
          <span className="text-muted-foreground">oracle </span>
          <span className="font-medium tabular-nums">{pct(oracleProb, 1)}</span>
        </div>
        {edge !== null ? <EdgeBadge points={edge} /> : null}
      </div>

      <div className="relative z-10 flex justify-between text-[11px] text-muted-foreground tabular-nums pointer-events-none">
        <span>Vol 24h {usd(bucket.volume24hr)}</span>
        <span className="flex items-center gap-1">
          Polymarket <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </Card>
  );
}

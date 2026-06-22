"use client";

import { TrendingDown, TrendingUp, Radio, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EdgeBadge } from "./edge-badge";
import { polymarketBucketUrl, type TempBucket, type TempMarketEvent } from "@/lib/polymarket";
import { pct, usd, edgePoints, signedPoints } from "@/lib/format";
import { evPerContract, suggestedStake, isValue } from "@/lib/decision";
import { cn } from "@/lib/utils";

export function MarketCard({
  event,
  bucket,
  oracleProb,
  livePrice,
  isLive,
  isMatch = false,
}: {
  event: TempMarketEvent;
  bucket: TempBucket;
  oracleProb: number | null;
  livePrice: number | null;
  isLive: boolean;
  /** true se su QUESTO bucket oracolo e mercato corrispondono (entrambi il più probabile) */
  isMatch?: boolean;
}) {
  const marketProb = livePrice ?? bucket.yesPrice;
  const change = bucket.oneDayPriceChange ?? 0;
  const edge = oracleProb !== null ? edgePoints(oracleProb, marketProb) : null;
  const orderUrl = polymarketBucketUrl(event.slug, bucket.slug);

  // Valore reale: vs il prezzo d'acquisto effettivo (best ask), non il mid.
  const ask = bucket.bestAsk ?? marketProb;
  const value = oracleProb !== null && isValue(oracleProb, ask);
  const evPts = oracleProb !== null ? evPerContract(oracleProb, ask) * 100 : null;
  const stake = oracleProb !== null ? suggestedStake(oracleProb, ask) : 0;

  // Bordo verde MARCATO solo quando oracolo e mercato corrispondono; lampeggia se edge positivo.
  const pulse = isMatch && edge !== null && edge > 0;
  const cardCls = pulse
    ? "border-2 border-emerald-500 pulse-edge"
    : isMatch
      ? "border-2 border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_8px_30px_-10px] shadow-emerald-500/50"
      : "hover:border-primary/40 hover:glow-primary";

  return (
    <Card className={cn("relative p-4 gap-3 transition-all", cardCls)}>
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
        {isLive && livePrice !== null ? (
          <div className="shrink-0 pointer-events-auto">
            <Tooltip>
              <TooltipTrigger
                render={<span className="grid place-items-center cursor-help" />}
                aria-label="Prezzo live"
              >
                <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
              </TooltipTrigger>
              <TooltipContent>Live price via WebSocket (Polymarket orderbook)</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
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

      {/* Valore atteso al netto del prezzo d'acquisto (best ask) + stake di Kelly */}
      {value ? (
        <div className="relative z-10 flex items-center justify-between rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 pointer-events-none">
          <span>Value · EV {signedPoints(evPts!)}</span>
          <span>stake {pct(stake, 0)}</span>
        </div>
      ) : null}

      <div className="relative z-10 flex justify-between text-[11px] text-muted-foreground tabular-nums pointer-events-none">
        <span>Vol 24h {usd(bucket.volume24hr)}</span>
        <span className="flex items-center gap-1">
          Polymarket <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </Card>
  );
}

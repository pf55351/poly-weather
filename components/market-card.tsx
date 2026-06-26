"use client";

import { TrendingDown, TrendingUp, Radio, ExternalLink, Check, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EdgeBadge } from "./edge-badge";
import { polymarketBucketUrl, bucketMidPrice, type TempBucket, type TempMarketEvent } from "@/lib/polymarket";
import { pct, usd, edgePoints } from "@/lib/format";
import { tradeSignal } from "@/lib/decision";
import type { TempUnit } from "@/lib/cities";
import { cn } from "@/lib/utils";

export function MarketCard({
  event,
  bucket,
  oracleProb,
  livePrice,
  isLive,
  isMatch = false,
  unit,
  sourceCount,
  stdev,
  dayFraction,
  cash = 0,
}: {
  event: TempMarketEvent;
  bucket: TempBucket;
  oracleProb: number | null;
  livePrice: number | null;
  isLive: boolean;
  /** true se su QUESTO bucket oracolo e mercato corrispondono (entrambi il più probabile) */
  isMatch?: boolean;
  unit: TempUnit;
  /** numero di fonti meteo che hanno risposto */
  sourceCount: number;
  /** dispersione dell'oracolo (unità target) */
  stdev: number;
  /** frazione 0..1 di giornata locale trascorsa, o null se ignota */
  dayFraction: number | null;
  /** saldo cash ($) per dimensionare la puntata suggerita */
  cash?: number;
}) {
  const marketProb = livePrice ?? bucketMidPrice(bucket);
  const change = bucket.oneDayPriceChange ?? 0;
  const edge = oracleProb !== null ? edgePoints(oracleProb, marketProb) : null;
  const orderUrl = polymarketBucketUrl(event.slug, bucket.slug);

  // Segnale operativo: si accende SOLO quando TUTTI i gate sono soddisfatti, su un lato.
  const signal = tradeSignal({
    q: oracleProb,
    ask: bucket.bestAsk ?? marketProb,
    bid: bucket.bestBid ?? marketProb,
    sourceCount,
    stdev,
    unit,
    volume24hr: bucket.volume24hr,
    liquidity: bucket.liquidity,
    dayFraction,
  });

  // Bordo: il segnale operativo LAMPEGGIA per enfatizzare quando comprare (verde=Yes, rosso=No)
  // e vince sul match. Corrispondenza oracolo/mercato → bordo viola lampeggiante.
  const cardCls =
    signal.side === "YES"
      ? "border-2 border-emerald-500 pulse-edge"
      : signal.side === "NO"
        ? "border-2 border-red-500 pulse-edge-red"
        : isMatch
          ? "border-2 border-primary pulse-match"
          : "hover:border-primary/40 hover:glow-primary";

  // Puntata suggerita: ½-Kelly (cap 10%) del cash, in $ e %.
  const stakeUsd =
    signal.stakeFraction !== null && cash > 0 ? cash * signal.stakeFraction : null;

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
        {signal.side ? (
          <div className="shrink-0 pointer-events-auto">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white animate-pulse cursor-help",
                      signal.side === "YES"
                        ? "bg-emerald-500 shadow-[0_0_12px_2px] shadow-emerald-500/60"
                        : "bg-red-500 shadow-[0_0_12px_2px] shadow-red-500/60",
                    )}
                  />
                }
                aria-label={`Buy ${signal.side} signal`}
              >
                <Zap className="h-3 w-3 fill-current" />
                Buy {signal.side} {signal.edgePts !== null ? `+${signal.edgePts.toFixed(0)}pt` : ""}
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">
                <p className="mb-1.5 font-semibold">
                  All conditions met to buy «{signal.side}»:
                </p>
                <ul className="space-y-0.5">
                  {signal.checks.map((c) => (
                    <li key={c.label} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-400" />
                      {c.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {signal.side === "YES"
                    ? "Oracle beats the price with margin in the reliable zone."
                    : "Market overprices «Yes»; oracle favors «No» with margin."}{" "}
                  Not financial advice.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : isLive && livePrice !== null ? (
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
        <div className="flex items-baseline gap-1">
          <span className="text-xs text-muted-foreground">oracle</span>
          <span className="text-base font-semibold tabular-nums">{pct(oracleProb, 1)}</span>
        </div>
        {edge !== null ? <EdgeBadge points={edge} /> : null}
      </div>

      {/* Suggerimento di puntata: solo quando il segnale è acceso */}
      {signal.side && signal.stakeFraction ? (
        <div
          className={cn(
            "relative z-10 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs pointer-events-none",
            signal.side === "YES" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300",
          )}
        >
          <span className="font-semibold">Buy {signal.side} · ½-Kelly</span>
          <span className="tabular-nums font-bold">
            {stakeUsd !== null ? `${usd(stakeUsd)} · ` : ""}
            {pct(signal.stakeFraction, 1)} of cash
          </span>
        </div>
      ) : null}

      <div className="relative z-10 flex justify-between text-[11px] text-muted-foreground tabular-nums pointer-events-none">
        <span>
          Vol 24h {usd(bucket.volume24hr)} · Liq {usd(bucket.liquidity)}
        </span>
        <span className="flex items-center gap-1">
          Polymarket <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </Card>
  );
}

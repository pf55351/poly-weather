"use client";

import { useEffect, useMemo } from "react";
import { useSetAtom } from "jotai";
import Link from "next/link";
import { ArrowLeft, CloudOff, RefreshCw } from "lucide-react";
import { liveStreamingAtom } from "@/lib/atoms";
import { cn } from "@/lib/utils";
import { useMarkets } from "@/hooks/use-markets";
import { useOracle } from "@/hooks/use-oracle";
import { useMarketStream } from "@/hooks/use-market-stream";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { ConnectionStatus } from "@/components/connection-status";
import { DayTabs } from "@/components/day-tabs";
import { Clock } from "@/components/clock";
import { Countdown } from "@/components/countdown";
import { MarketCard } from "@/components/market-card";
import { MarketInfoDialog } from "@/components/market-info-dialog";
import { OraclePanel } from "@/components/oracle-panel";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { pct, edgePoints } from "@/lib/format";
import type { City } from "@/lib/cities";
import type { TempMarketEvent } from "@/lib/polymarket";

export function CityDetail({ cityId }: { cityId: string }) {
  // Giorno selezionato condiviso con la home (Oggi/Domani).
  const date = useSelectedDate();
  const setLive = useSetAtom(liveStreamingAtom);

  const markets = useMarkets(cityId, date);
  const oracle = useOracle(cityId, date);

  const event = markets.data?.event ?? null;
  const buckets = useMemo(() => event?.buckets ?? [], [event]);

  // Descrittore città (label/stazione/unità) dalla risposta API.
  const cityInfo = markets.data?.city;
  const label = cityInfo?.label ?? cityId.replace(/-/g, " ");
  const station = cityInfo?.station;

  // Ricostruisce un City minimale per le card (serve solo unit/station/label).
  const cityForCards: City = {
    id: cityId,
    label,
    marketName: label,
    lat: 0,
    lon: 0,
    station: station ?? "",
    unit: cityInfo?.unit ?? "C",
    timezone: "UTC",
  };

  // Ibrido: sul dettaglio lo streaming WebSocket è SEMPRE attivo su tutti i bucket.
  const streamAssets = useMemo(
    () => buckets.map((b) => b.yesTokenId).filter((x): x is string => Boolean(x)),
    [buckets],
  );
  const { connected, prices } = useMarketStream(streamAssets);

  useEffect(() => {
    setLive(connected);
    return () => setLive(false);
  }, [connected, setLive]);

  const oracleProbByLabel = useMemo(() => {
    const m = new Map<string, number>();
    oracle.data?.distribution.buckets.forEach((b) => m.set(b.label, b.probability));
    return m;
  }, [oracle.data]);

  // Bucket dove oracolo e mercato CORRISPONDONO (entrambi il più probabile).
  const marketTopLabel = mostLikelyBucketLabel(buckets, prices)?.label ?? null;
  const oracleTopLabel = oracle.data?.distribution.mostLikely?.label ?? null;
  const agreementLabel =
    marketTopLabel && oracleTopLabel && marketTopLabel === oracleTopLabel ? marketTopLabel : null;

  const noMarket = markets.data && !markets.data.hasMarket;

  // Refresh manuale del mercato (e oracolo) di questa città.
  const isRefreshing = markets.isFetching || oracle.isFetching;
  const refresh = () => {
    markets.refetch();
    oracle.refetch();
  };
  const updatedAt = markets.dataUpdatedAt
    ? new Date(markets.dataUpdatedAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-20 border-b border-border/60 glass">
        <div className="mx-auto max-w-6xl flex items-center gap-3 px-4 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> cities
          </Link>
          <span className="font-semibold">{label}</span>
          {station ? (
            <span className="text-xs text-muted-foreground hidden sm:inline">· {station}</span>
          ) : null}
          <div className="ml-auto">
            <ConnectionStatus />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {/* Tab giorno: Oggi / Domani */}
        <DayTabs className="mb-5" />

        {noMarket ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              {oracle.isLoading ? (
                <Skeleton className="h-72 w-full rounded-xl" />
              ) : oracle.data ? (
                <OraclePanel oracle={oracle.data} />
              ) : (
                <ErrorCard msg="Oracle unavailable" />
              )}
            </div>
            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 border-dashed">
              <CloudOff className="h-8 w-8 text-muted-foreground" />
              <div className="font-medium">No Polymarket market for {label}</div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Polymarket doesn&apos;t list {label}&apos;s temperature (yet). The oracle is already active
                and this view will fill in as soon as a market opens.
              </p>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <ComparisonHeader
              image={event?.image ?? null}
              event={event}
              city={cityForCards}
              timezone={cityInfo?.timezone}
              endDate={event?.endDate ?? null}
              updatedAt={updatedAt}
              onRefresh={refresh}
              refreshing={isRefreshing}
              marketMostLikely={mostLikelyBucketLabel(buckets, prices)}
              oracleLabel={oracle.data?.distribution.mostLikely?.label ?? null}
              oracleProb={oracle.data?.distribution.mostLikely?.probability ?? null}
            />

            <div className="grid gap-6 lg:grid-cols-[1fr_minmax(360px,420px)]">
              <section>
                {markets.isLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-40 rounded-xl" />
                    ))}
                  </div>
                ) : markets.data?.error ? (
                  <ErrorCard msg={`Markets error: ${markets.data.error}`} />
                ) : buckets.length === 0 ? (
                  <ErrorCard msg={`No active temperature market for ${label} on this day.`} />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {buckets.map((b) => (
                      <MarketCard
                        key={b.conditionId || b.label}
                        event={event!}
                        bucket={b}
                        oracleProb={oracleProbByLabel.get(b.label) ?? null}
                        livePrice={b.yesTokenId ? (prices[b.yesTokenId] ?? null) : null}
                        isLive={connected}
                        isMatch={agreementLabel !== null && b.label === agreementLabel}
                      />
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Click an option to open it on Polymarket and place an order · live prices via WebSocket.
                </p>
              </section>

              <aside>
                {oracle.isLoading ? (
                  <Skeleton className="h-96 w-full rounded-xl" />
                ) : oracle.data ? (
                  <OraclePanel oracle={oracle.data} marketBuckets={buckets} />
                ) : (
                  <ErrorCard msg="Oracle unavailable" />
                )}
              </aside>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ComparisonHeader({
  image,
  event,
  city,
  timezone,
  endDate,
  updatedAt,
  onRefresh,
  refreshing,
  marketMostLikely,
  oracleLabel,
  oracleProb,
}: {
  image: string | null;
  event: TempMarketEvent | null;
  city: City;
  timezone?: string;
  endDate: string | null;
  updatedAt: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  marketMostLikely: { label: string; prob: number } | null;
  oracleLabel: string | null;
  oracleProb: number | null;
}) {
  const agree = marketMostLikely && oracleLabel && marketMostLikely.label === oracleLabel;
  // Come le card opzioni: Aligned → bordo verde marcato; Aligned + edge positivo → pulse.
  const edgePts =
    agree && oracleProb !== null && marketMostLikely !== null
      ? edgePoints(oracleProb, marketMostLikely.prob)
      : null;
  const cardCls =
    edgePts !== null && edgePts > 0
      ? "border-2 border-emerald-500 pulse-edge"
      : agree
        ? "border-2 border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_8px_30px_-10px] shadow-emerald-500/50"
        : "";

  return (
    <Card className={cn("relative overflow-hidden p-5 gap-4", cardCls)}>
      {/* Immagine mercato Polymarket come sfondo sfumato */}
      {image ? (
        <div className="absolute inset-0 z-0 pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="h-full w-full object-cover opacity-45 blur-[1px] scale-105" />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-card/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
        </div>
      ) : null}

      {/* Riga 1: previsioni Oracolo vs Mercato + esito */}
      <div className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Side title="Oracle says" label={oracleLabel} prob={oracleProb} accent="text-primary" />
        <span className="text-muted-foreground text-sm font-medium">vs</span>
        <Side
          title="Market says"
          label={marketMostLikely?.label ?? null}
          prob={marketMostLikely?.prob ?? null}
          accent="text-accent"
        />
        {marketMostLikely && oracleLabel ? (
          <Badge
            variant="outline"
            className={
              agree
                ? "ml-auto shrink-0 gap-1 border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                : "ml-auto shrink-0 gap-1 border-amber-500/60 bg-amber-500/10 text-amber-400"
            }
          >
            {agree ? "Aligned" : "Diverging → value"}
          </Badge>
        ) : null}
      </div>

      {/* Riga 2: meta (ora locale · chiusura) + controlli (updated · refresh · info) */}
      <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/40 pt-3 text-sm">
        <Clock timeZone={timezone} label="Local time" className="text-muted-foreground" />
        <span className="text-muted-foreground/40">·</span>
        <Countdown endDate={endDate} showLabel />

        <div className="ml-auto flex items-center gap-2.5 text-muted-foreground">
          {updatedAt ? (
            <span suppressHydrationWarning className="text-xs tabular-nums hidden md:inline">
              Updated {updatedAt}
            </span>
          ) : null}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh market"
            title="Refresh market"
            className="grid place-items-center h-7 w-7 rounded-md border border-border/60 bg-card/50 hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
          {event ? <MarketInfoDialog event={event} city={city} /> : null}
        </div>
      </div>
    </Card>
  );
}

function Side({
  title,
  label,
  prob,
  accent,
}: {
  title: string;
  label: string | null;
  prob: number | null;
  accent: string;
}) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold tabular-nums ${accent}`}>{label ?? "—"}</span>
        <span className="text-base text-muted-foreground tabular-nums">{pct(prob, 0)}</span>
      </div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return <Card className="p-6 text-sm text-muted-foreground border-dashed">{msg}</Card>;
}

function mostLikelyBucketLabel(
  buckets: { label: string; yesPrice: number; yesTokenId: string | null }[],
  livePrices: Record<string, number>,
): { label: string; prob: number } | null {
  if (buckets.length === 0) return null;
  let best = buckets[0];
  let bestProb = -1;
  for (const b of buckets) {
    const p = b.yesTokenId ? (livePrices[b.yesTokenId] ?? b.yesPrice) : b.yesPrice;
    if (p > bestProb) {
      bestProb = p;
      best = b;
    }
  }
  return { label: best.label, prob: bestProb };
}

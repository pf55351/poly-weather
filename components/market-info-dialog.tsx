"use client";

import { Info, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { polymarketBucketUrl, type TempBucket, type TempMarketEvent } from "@/lib/polymarket";
import type { City } from "@/lib/cities";
import { pct, usd } from "@/lib/format";

// Icona info -> dettagli/regole di risoluzione del mercato (come su Polymarket).
export function MarketInfoDialog({
  event,
  bucket,
  city,
}: {
  event: TempMarketEvent;
  bucket: TempBucket;
  city: City;
}) {
  return (
    <Dialog>
      <DialogTrigger
        className="grid place-items-center h-6 w-6 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        aria-label="Market info"
      >
        <Info className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="flex flex-col gap-0 p-0 w-full max-w-lg sm:max-w-lg max-h-[85vh] overflow-hidden">
        {/* Header fisso */}
        <DialogHeader className="p-5 pb-3 pr-12 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="grid place-items-center h-7 w-7 rounded-lg bg-primary/15 text-primary text-xs font-bold shrink-0">
              {bucket.label.replace(/[^0-9]/g, "").slice(0, 2) || "°"}
            </span>
            <span className="text-gradient font-bold">{bucket.label}</span>
          </DialogTitle>
          <DialogDescription className="truncate">{event.title}</DialogDescription>
        </DialogHeader>

        {/* Corpo scrollabile */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="rounded-xl border border-border/60 bg-card/50 divide-y divide-border/50">
            <Row label="Resolution station" value={city.station} />
            <Row label="Resolution source" value={event.resolutionSource ?? "Polymarket / UMA"} />
            <Row
              label="Closes"
              value={event.endDate ? new Date(event.endDate).toLocaleString("en-US") : "—"}
            />
            <Row label="Implied prob. (Yes)" value={pct(bucket.yesPrice, 1)} accent />
            <Row
              label="Best bid / ask"
              value={`${pct(bucket.bestBid, 1)} / ${pct(bucket.bestAsk, 1)}`}
            />
            <Row label="Volume 24h" value={usd(bucket.volume24hr)} />
            <Row label="Liquidity" value={usd(bucket.liquidity)} />
          </div>

          {/* conditionId: va a capo, non sfora la modale */}
          <div className="text-[11px]">
            <span className="text-muted-foreground">conditionId</span>
            <p className="font-mono break-all text-muted-foreground/80 mt-0.5">
              {bucket.conditionId}
            </p>
          </div>

          {event.description ? (
            <p className="text-xs text-muted-foreground leading-relaxed wrap-break-word">
              {event.description}
            </p>
          ) : null}
        </div>

        {/* Footer fisso con CTA */}
        <div className="p-4 border-t border-border/60">
          <a
            href={polymarketBucketUrl(event.slug, bucket.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors py-2.5 text-sm font-medium"
          >
            Open on Polymarket <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <dt className="text-muted-foreground shrink-0 text-xs">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-sm tabular-nums ${accent ? "text-primary font-semibold" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

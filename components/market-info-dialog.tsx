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
import { polymarketEventUrl, type TempMarketEvent } from "@/lib/polymarket";
import type { City } from "@/lib/cities";
import { usd } from "@/lib/format";

// Info a LIVELLO DI MERCATO (uguale per tutte le opzioni): stazione/fonte di risoluzione,
// chiusura, volumi. Un solo pulsante info nella card centrale (non più su ogni opzione).
export function MarketInfoDialog({ event, city }: { event: TempMarketEvent; city: City }) {
  const closes = event.endDate
    ? new Date(event.endDate).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";

  return (
    <Dialog>
      <DialogTrigger
        className="grid place-items-center h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        aria-label="Market info"
      >
        <Info className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="flex flex-col gap-0 p-0 w-full max-w-lg sm:max-w-lg max-h-[85vh] overflow-hidden">
        <DialogHeader className="p-5 pb-3 pr-12 border-b border-border/60">
          <DialogTitle className="text-base">Market info</DialogTitle>
          <DialogDescription className="truncate">{event.title}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="rounded-xl border border-border/60 bg-card/50 divide-y divide-border/50">
            <Row label="Resolution station" value={city.station} />
            <Row
              label="Resolution source"
              value="Wunderground"
              href={event.resolutionSource ?? "https://www.wunderground.com/"}
            />
            <Row label="Closes" value={closes} />
            <Row label="Volume 24h" value={usd(event.volume24hr)} />
            <Row label="Liquidity" value={usd(event.liquidity)} />
          </div>

          {event.description ? (
            <p className="text-xs text-muted-foreground leading-relaxed wrap-break-word">
              {event.description}
            </p>
          ) : null}
        </div>

        <div className="p-4 border-t border-border/60">
          <a
            href={polymarketEventUrl(event.slug)}
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

function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("wunderground")) return "Wunderground";
    if (host.includes("polymarket")) return "Polymarket";
    return host;
  } catch {
    return url;
  }
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  const isLink = !!href && /^https?:\/\//i.test(href);
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <dt className="text-muted-foreground shrink-0 text-xs">{label}</dt>
      {isLink ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 inline-flex items-center justify-end gap-1 text-right text-sm text-primary hover:underline"
          title={href}
        >
          <span className="truncate">{hostLabel(href!)}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <dd className="min-w-0 truncate text-right text-sm tabular-nums" title={value}>
          {value}
        </dd>
      )}
    </div>
  );
}

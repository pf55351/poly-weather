"use client";

import Link from "next/link";
import { Check, ChevronRight, Cloud, Thermometer, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "@/components/clock";
import { isAligned, pct, signedPoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BoardRow } from "@/app/api/board/route";

// Riga della lista iniziale: immagine Polymarket di sfondo + titolo + vincitore di
// mercato e oracolo + edge/divergenza. I dati arrivano già pronti dalla board.
export function CityListItem({ row }: { row: BoardRow }) {
  const market = row.marketWinner;
  const oracle = row.oracleWinner;
  const edge = row.edge;
  const agree = market && oracle && market.label === oracle.label;

  return (
    <Link href={`/city/${row.cityId}`} className="block group">
      <Card className="relative p-4 flex-row items-center gap-4 min-h-[104px] overflow-hidden transition-all group-hover:border-primary/40 group-hover:glow-primary">
        {/* Immagine mercato Polymarket come sfondo sfumato */}
        {row.image ? (
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.image}
              alt=""
              className="h-full w-full object-cover opacity-45 blur-[1px] scale-105 transition-opacity duration-300 group-hover:opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/85 to-card/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
          </div>
        ) : null}

        {/* Thumbnail nitida */}
        <div className="relative z-10 h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-muted/60 ring-1 ring-border flex items-center justify-center">
          {row.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <Cloud className="h-7 w-7 text-muted-foreground" />
          )}
        </div>

        <div className="relative z-10 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {row.isItaly ? (
              <Badge className="text-[10px] gap-1 bg-primary/15 text-primary border-0">
                <MapPin className="h-3 w-3" /> Italy
              </Badge>
            ) : null}
            <span className="text-base font-semibold truncate">{row.label}</span>
            {agree ? (
              <Check
                className="h-4 w-4 shrink-0 text-emerald-400"
                aria-label="Market and oracle agree"
              />
            ) : null}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <Clock
                timeZone={row.timezone}
                className="text-xs text-muted-foreground"
              />
              <Badge variant="outline" className="text-[10px]">
                °{row.unit}
              </Badge>
            </div>
          </div>

          <p className="text-sm text-muted-foreground truncate mt-0.5">{row.title}</p>

          {/* Winning predictions */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <Prediction
              icon={<Thermometer className="h-3.5 w-3.5 text-accent" />}
              caption="Market"
              label={market?.label ?? null}
              prob={market?.prob ?? null}
            />
            <Prediction
              icon={<Cloud className="h-3.5 w-3.5 text-primary" />}
              caption="Oracle"
              label={oracle?.label ?? null}
              prob={oracle?.prob ?? null}
            />
            {edge !== null ? (
              isAligned(edge) ? (
                <span
                  className="ml-auto flex items-center gap-1 text-xs font-medium tabular-nums text-emerald-400"
                  title="Same temperature: oracle and market are aligned (negligible edge)"
                >
                  <Check className="h-3.5 w-3.5" />
                  edge {signedPoints(edge)}
                </span>
              ) : (
                <span
                  className={cn(
                    "ml-auto text-xs font-medium tabular-nums",
                    edge >= 0 ? "text-emerald-400" : "text-red-400",
                  )}
                  title={`Same temperature. Edge = P(oracle) − P(market) = ${signedPoints(edge)}. ${
                    edge >= 0
                      ? "Oracle more confident than the market → possible value on «Yes»."
                      : "Oracle less confident than the market → «Yes» potentially overpriced."
                  }`}
                >
                  edge {signedPoints(edge)}
                </span>
              )
            ) : agree === false ? (
              <span
                className="ml-auto text-[11px] text-amber-400"
                title="Oracle and market point to different highest temperatures: they don't agree on the most likely outcome."
              >
                divergence
              </span>
            ) : null}
          </div>
        </div>

        <ChevronRight className="relative z-10 h-5 w-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Card>
    </Link>
  );
}

function Prediction({
  icon,
  caption,
  label,
  prob,
}: {
  icon: React.ReactNode;
  caption: string;
  label: string | null;
  prob: number | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-xs text-muted-foreground">{caption}</span>
      {label ? (
        <span className="text-base font-semibold tabular-nums">
          {label} <span className="text-muted-foreground font-normal">{pct(prob, 0)}</span>
        </span>
      ) : (
        <span className="text-base text-muted-foreground">—</span>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Search, X, ThermometerSun, Info, ChevronDown, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CityListItem, CityListItemSkeleton } from "@/components/city-list-item";
import { DayTabs } from "@/components/day-tabs";
import { TempConverterDialog } from "@/components/temp-converter-dialog";
import { useBoard } from "@/hooks/use-board";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { todayISO } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type SortMode = "edge" | "suggested";

/** Giorno (YYYY-MM-DD, fuso della città) a cui il mercato si riferisce: il close
 *  time è la mezzanotte locale successiva, quindi -1s ricade nel giorno del mercato. */
function marketDayISO(endDateISO: string, timeZone: string): string {
  const d = new Date(Date.parse(endDateISO) - 1000);
  try {
    return d.toLocaleDateString("en-CA", { timeZone });
  } catch {
    return d.toLocaleDateString("en-CA");
  }
}

export default function Home() {
  const date = useSelectedDate();
  const board = useBoard(date);
  const rawRows = useMemo(() => board.data?.cities ?? [], [board.data]);

  // Solo per oggi: nascondi i mercati già chiusi (close time passato) o che in realtà
  // riguardano un altro giorno (fallback su evento di domani).
  const allRows = useMemo(() => {
    if (date !== todayISO()) return rawRows;
    const now = Date.now();
    return rawRows.filter((c) => {
      if (!c.hasMarket || !c.endDate) return true;
      const end = Date.parse(c.endDate);
      if (Number.isFinite(end) && end <= now) return false; // chiuso
      return marketDayISO(c.endDate, c.timezone) === date; // riguarda oggi
    });
  }, [rawRows, date]);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("edge"); // edge di default
  const sortByEdge = sort === "edge";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (c) => c.label.toLowerCase().includes(q) || c.marketName.toLowerCase().includes(q),
    );
  }, [allRows, query]);

  // Edge: decrescente, città con edge prima, null (divergenza / no market) in coda.
  const cities = sortByEdge
    ? [...filtered].sort((a, b) => {
        if (a.edge == null && b.edge == null) return 0;
        if (a.edge == null) return 1;
        if (b.edge == null) return -1;
        return b.edge - a.edge;
      })
    : filtered;

  const updatedAt = board.dataUpdatedAt
    ? new Date(board.dataUpdatedAt).toLocaleString("en-GB", {
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
        <div className="mx-auto max-w-3xl flex items-center gap-3.5 px-4 py-5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 ring-1 ring-primary/30 glow-primary shrink-0">
            <ThermometerSun className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">
              Poly<span className="text-gradient">Meteo</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5">
              Polymarket weather markets ↔ multi-source oracle
            </p>
          </div>
          <span
            suppressHydrationWarning
            className="ml-auto text-sm text-muted-foreground tabular-nums hidden sm:inline self-start"
          >
            {new Date(date).toLocaleDateString("en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-xl font-bold tracking-tight">Weather markets</h2>
          <div className="flex items-center gap-2">
            {board.data ? (
              <Badge variant="secondary" className="tabular-nums">
                {cities.length}
                {query ? `/${allRows.length}` : ""} cities
              </Badge>
            ) : null}
            {updatedAt ? (
              <span
                suppressHydrationWarning
                className="text-xs text-muted-foreground tabular-nums hidden sm:inline"
              >
                Updated {updatedAt}
              </span>
            ) : null}
            <TempConverterDialog />
            <button
              onClick={() => board.refetch()}
              disabled={board.isFetching}
              aria-label="Refresh"
              title="Refresh now"
              className="grid place-items-center h-8 w-8 rounded-lg border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", board.isFetching && "animate-spin")} />
            </button>
          </div>
        </div>

        <DayTabs className="mb-4" />

        {/* Collapsible help panel */}
        <details className="group mb-4 rounded-xl border border-border/60 bg-card/40 open:bg-card/60 transition-colors">
          <summary className="flex items-center gap-2 p-3.5 text-sm font-medium cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
            <Info className="h-4 w-4 text-primary shrink-0" />
            How to read this — Edge &amp; Divergence
            <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground space-y-2.5">
            <p>
              <span className="font-semibold text-emerald-400">Edge</span> — shown when the market and the
              oracle point to the <span className="text-foreground">same temperature</span>. It measures
              how much more <span className="text-emerald-400">confident</span> the oracle is than the
              market (positive «+», a possible buying opportunity on «Yes») or less{" "}
              <span className="text-red-400">confident</span> (negative «−»), in percentage points.
            </p>
            <p>
              <span className="font-semibold text-amber-400">Divergence</span> — shown when the market and
              the oracle point to <span className="text-foreground">two different highest temperatures</span>:
              they don&apos;t even agree on the most likely outcome.
            </p>
          </div>
        </details>

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cities… (e.g. Milan, Tokyo, Madrid)"
              className="w-full h-11 rounded-xl border border-border/60 bg-card/50 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="inline-flex rounded-xl border border-border/60 bg-card/50 p-1 shrink-0">
            <SortButton active={sortByEdge} onClick={() => setSort("edge")}>
              Edge
            </SortButton>
            <SortButton active={sort === "suggested"} onClick={() => setSort("suggested")}>
              Suggested
            </SortButton>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {board.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <CityListItemSkeleton key={i} />)
            : cities.map((c) => <CityListItem key={c.cityId} row={c} />)}
        </div>

        {board.data && cities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {query ? `No cities found for “${query}”.` : "No open temperature markets found for today."}
          </p>
        ) : null}
      </main>

      <footer className="border-t border-border/60 py-3 text-center text-xs text-muted-foreground">
        Markets: Polymarket Gamma API · Oracle: Open-Meteo (ensemble + ~19 models, incl. Italy&apos;s
        ARPAE), Met Norway, wttr.in, 7Timer
      </footer>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
        active ? "bg-primary/20 text-primary glow-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

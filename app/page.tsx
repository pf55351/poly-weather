"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Search, X, ThermometerSun, Info, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CityListItem } from "@/components/city-list-item";
import { DayTabs } from "@/components/day-tabs";
import { useCities } from "@/hooks/use-cities";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { fetchSummary, summaryQueryKey } from "@/hooks/use-summary";
import { edgePoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CitySummary } from "@/app/api/summary/route";

type SortMode = "suggested" | "edge";

/** edge = oracle − market quando puntano allo stesso bucket, altrimenti null. */
function summaryEdge(s: CitySummary | undefined): number | null {
  const m = s?.marketWinner;
  const o = s?.oracleWinner;
  if (m && o && m.label === o.label) return edgePoints(o.prob, m.prob);
  return null;
}

export default function Home() {
  const date = useSelectedDate();
  const { data, isLoading } = useCities(date);
  const allCities = useMemo(() => data?.cities ?? [], [data]);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("suggested");
  const sortByEdge = sort === "edge";

  // Per ordinare per edge servono i summary di TUTTE le città: li carichiamo solo
  // quando l'ordinamento "Edge" è attivo (stessa queryKey dei card → nessun doppio fetch).
  const summaryResults = useQueries({
    queries: allCities.map((c) => ({
      queryKey: summaryQueryKey(c.cityId, date),
      queryFn: () => fetchSummary(c.cityId, date),
      enabled: sortByEdge,
      staleTime: 60_000,
      refetchInterval: 5 * 60_000,
    })),
  });

  const edgeByCity = new Map<string, number | null>();
  allCities.forEach((c, i) => edgeByCity.set(c.cityId, summaryEdge(summaryResults[i]?.data)));
  const edgeLoading = sortByEdge && summaryResults.some((r) => r.isLoading);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCities;
    return allCities.filter(
      (c) => c.label.toLowerCase().includes(q) || c.marketName.toLowerCase().includes(q),
    );
  }, [allCities, query]);

  // Ordinamento: per edge (decrescente, città con edge prima), o ordine consigliato.
  const cities = sortByEdge
    ? [...filtered].sort((a, b) => {
        const ea = edgeByCity.get(a.cityId);
        const eb = edgeByCity.get(b.cityId);
        if (ea == null && eb == null) return 0;
        if (ea == null) return 1;
        if (eb == null) return -1;
        return eb - ea;
      })
    : filtered;

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
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Weather markets</h2>
          </div>
          {data ? (
            <Badge variant="secondary" className="tabular-nums">
              {cities.length}
              {query ? `/${allCities.length}` : ""} cities
            </Badge>
          ) : null}
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
            <SortButton active={sort === "suggested"} onClick={() => setSort("suggested")}>
              Suggested
            </SortButton>
            <SortButton active={sortByEdge} onClick={() => setSort("edge")}>
              Edge
            </SortButton>
          </div>
        </div>

        {edgeLoading ? (
          <p className="mb-3 text-xs text-muted-foreground">Loading forecasts to rank by edge…</p>
        ) : null}

        <div className="flex flex-col gap-3">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-26 rounded-xl" />)
            : cities.map((c) => <CityListItem key={c.cityId} card={c} date={date} />)}
        </div>

        {data && cities.length === 0 ? (
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

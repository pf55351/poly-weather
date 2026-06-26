"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { TempMarketEvent } from "@/lib/polymarket";

export interface MarketCityInfo {
  id: string;
  label: string;
  station: string;
  unit: "C" | "F";
  timezone: string;
}

export interface MarketsResponse {
  cityId: string;
  hasMarket: boolean;
  event: TempMarketEvent | null;
  city?: MarketCityInfo;
  error?: string;
}

async function fetchMarkets(cityId: string, date: string, fresh: boolean): Promise<MarketsResponse> {
  const res = await fetch(`/api/markets?city=${cityId}&date=${date}${fresh ? "&fresh=1" : ""}`);
  if (!res.ok && res.status !== 502) throw new Error(`markets ${res.status}`);
  return res.json();
}

export function useMarkets(cityId: string, date: string) {
  // freshRef: il refresh manuale bypassa la cache server; il polling resta cache-ato.
  const freshRef = useRef(false);
  const q = useQuery({
    queryKey: queryKeys.markets(cityId, date),
    queryFn: () => {
      const fresh = freshRef.current;
      freshRef.current = false;
      return fetchMarkets(cityId, date, fresh);
    },
    // Polling della griglia (approccio ibrido). Il dettaglio passa al WebSocket.
    refetchInterval: 20_000,
  });
  const refresh = () => {
    freshRef.current = true;
    return q.refetch();
  };
  return { ...q, refresh };
}

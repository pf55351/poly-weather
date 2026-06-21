"use client";

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

async function fetchMarkets(cityId: string, date: string): Promise<MarketsResponse> {
  const res = await fetch(`/api/markets?city=${cityId}&date=${date}`);
  if (!res.ok && res.status !== 502) throw new Error(`markets ${res.status}`);
  return res.json();
}

export function useMarkets(cityId: string, date: string) {
  return useQuery({
    queryKey: queryKeys.markets(cityId, date),
    queryFn: () => fetchMarkets(cityId, date),
    // Polling della griglia (approccio ibrido). Il dettaglio passa al WebSocket.
    refetchInterval: 20_000,
  });
}

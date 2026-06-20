"use client";

import { useQuery } from "@tanstack/react-query";
import type { CitySummary } from "@/app/api/summary/route";

export async function fetchSummary(cityId: string, date: string): Promise<CitySummary> {
  const res = await fetch(`/api/summary?city=${cityId}&date=${date}`);
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return res.json();
}

/** queryKey condivisa tra useSummary e l'ordinamento per edge nella home. */
export const summaryQueryKey = (cityId: string, date: string) =>
  ["summary", cityId, date] as const;

export function useSummary(cityId: string, date: string, enabled = true) {
  return useQuery({
    queryKey: summaryQueryKey(cityId, date),
    queryFn: () => fetchSummary(cityId, date),
    enabled,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
}

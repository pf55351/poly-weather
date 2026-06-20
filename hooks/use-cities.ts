"use client";

import { useQuery } from "@tanstack/react-query";
import type { CityCard } from "@/lib/discover";

interface CitiesResponse {
  date: string;
  count: number;
  cities: CityCard[];
  error?: string;
}

async function fetchCities(date: string): Promise<CitiesResponse> {
  const res = await fetch(`/api/cities?date=${date}`);
  if (!res.ok) throw new Error(`cities ${res.status}`);
  return res.json();
}

export function useCities(date: string) {
  return useQuery({
    queryKey: ["cities", date],
    queryFn: () => fetchCities(date),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

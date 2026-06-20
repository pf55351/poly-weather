"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { OracleResult } from "@/lib/oracle";

async function fetchOracle(cityId: string, date: string): Promise<OracleResult> {
  const res = await fetch(`/api/oracle?city=${cityId}&date=${date}`);
  if (!res.ok) throw new Error(`oracle ${res.status}`);
  return res.json();
}

export function useOracle(cityId: string, date: string) {
  return useQuery({
    queryKey: queryKeys.oracle(cityId, date),
    queryFn: () => fetchOracle(cityId, date),
    // I forecast cambiano lentamente: polling più rilassato.
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
  });
}

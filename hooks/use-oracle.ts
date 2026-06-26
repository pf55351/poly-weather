"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { OracleResult } from "@/lib/oracle";

async function fetchOracle(cityId: string, date: string, fresh: boolean): Promise<OracleResult> {
  const res = await fetch(`/api/oracle?city=${cityId}&date=${date}${fresh ? "&fresh=1" : ""}`);
  if (!res.ok) throw new Error(`oracle ${res.status}`);
  return res.json();
}

export function useOracle(cityId: string, date: string) {
  // freshRef = true SOLO per il prossimo refetch manuale (refresh()), poi si resetta:
  // il polling automatico resta cache-ato lato server, il tasto refresh bypassa la cache.
  const freshRef = useRef(false);
  const q = useQuery({
    queryKey: queryKeys.oracle(cityId, date),
    queryFn: () => {
      const fresh = freshRef.current;
      freshRef.current = false;
      return fetchOracle(cityId, date, fresh);
    },
    // I forecast cambiano lentamente: polling più rilassato.
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
  });
  const refresh = () => {
    freshRef.current = true;
    return q.refetch();
  };
  return { ...q, refresh };
}

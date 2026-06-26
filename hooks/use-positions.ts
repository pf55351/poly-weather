"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { isWalletAddress, type PositionsResult } from "@/lib/positions";

async function fetchPositions(address: string, fresh: boolean): Promise<PositionsResult> {
  const res = await fetch(`/api/positions?user=${encodeURIComponent(address)}${fresh ? "&fresh=1" : ""}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `positions ${res.status}`);
  return data as PositionsResult;
}

/** Posizioni aperte del wallet. Disattivo finché l'indirizzo non è valido. */
export function usePositions(address: string) {
  const enabled = isWalletAddress(address);
  // freshRef: il refresh manuale bypassa la cache server; il polling resta cache-ato.
  const freshRef = useRef(false);
  const q = useQuery({
    queryKey: ["positions", address],
    queryFn: () => {
      const fresh = freshRef.current;
      freshRef.current = false;
      return fetchPositions(address, fresh);
    },
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const refresh = () => {
    freshRef.current = true;
    return q.refetch();
  };
  return { ...q, refresh };
}

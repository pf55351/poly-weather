"use client";

import { useQuery } from "@tanstack/react-query";
import { isWalletAddress } from "@/lib/positions";
import { useStoredWallet } from "./use-wallet";

async function fetchCash(address: string): Promise<number> {
  const res = await fetch(`/api/cash?user=${encodeURIComponent(address)}`);
  if (!res.ok) return 0;
  const d = (await res.json()) as { cash?: number };
  return typeof d.cash === "number" ? d.cash : 0;
}

/** Saldo cash (pUSD) del wallet corrente, per dimensionare le puntate sul buy-signal. */
export function useCash(): number {
  const [address] = useStoredWallet();
  const q = useQuery({
    queryKey: ["cash", address],
    queryFn: () => fetchCash(address),
    enabled: isWalletAddress(address),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return q.data ?? 0;
}

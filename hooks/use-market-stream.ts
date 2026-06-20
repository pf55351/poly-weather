"use client";

import { useEffect, useState } from "react";
import { MarketStream, type PriceUpdate } from "@/lib/polymarket-ws";

/**
 * Apre un WebSocket sui token id passati e ritorna i prezzi live (override del polling).
 * Passare un array vuoto disattiva lo streaming (torna al polling).
 */
export function useMarketStream(assetIds: string[]) {
  const [connected, setConnected] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});

  // chiave stabile per evitare riconnessioni inutili
  const key = assetIds.slice().sort().join(",");

  useEffect(() => {
    if (!key) return; // nessuno stream attivo
    const ids = key.split(",");
    const stream = new MarketStream(
      ids,
      (u: PriceUpdate) => setPrices((p) => ({ ...p, [u.assetId]: u.price })),
      setConnected,
    );
    stream.connect();
    return () => stream.close();
  }, [key]);

  const active = key.length > 0;
  return { connected: active && connected, prices: active ? prices : {} };
}

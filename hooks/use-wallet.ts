"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pm-wallet";
/** Wallet di default (env); usato quando il browser non ne ha uno salvato. */
export const DEFAULT_WALLET = (process.env.NEXT_PUBLIC_POLYMARKET_WALLET ?? "").trim();

/** Indirizzo wallet persistito in localStorage, condiviso tra pagine/tab e reattivo. */
export function useStoredWallet(): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_WALLET,
    () => DEFAULT_WALLET, // snapshot lato server (no localStorage)
  );
  const set = (v: string) => {
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("storage"));
  };
  return [value, set];
}

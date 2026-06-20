"use client";

import { useAtomValue } from "jotai";
import { dayOffsetAtom } from "@/lib/atoms";
import { todayISO, isoPlusDays } from "@/lib/query-keys";

/** Data ISO selezionata (Oggi/Domani) derivata da dayOffsetAtom. */
export function useSelectedDate(): string {
  const offset = useAtomValue(dayOffsetAtom);
  return isoPlusDays(todayISO(), offset);
}

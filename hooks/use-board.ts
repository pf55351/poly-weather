"use client";

import { useQuery } from "@tanstack/react-query";
import type { BoardResponse } from "@/app/api/board/route";

async function fetchBoard(date: string): Promise<BoardResponse> {
  const res = await fetch(`/api/board?date=${date}`);
  if (!res.ok) throw new Error(`board ${res.status}`);
  return res.json();
}

export function useBoard(date: string) {
  return useQuery({
    queryKey: ["board", date],
    queryFn: () => fetchBoard(date),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

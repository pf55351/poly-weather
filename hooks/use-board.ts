"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BoardResponse } from "@/app/api/board/route";

async function fetchBoard(date: string, fresh: boolean): Promise<BoardResponse> {
  const res = await fetch(`/api/board?date=${date}${fresh ? "&fresh=1" : ""}`);
  if (!res.ok) throw new Error(`board ${res.status}`);
  return res.json();
}

export function useBoard(date: string) {
  // freshRef: il refresh manuale bypassa la cache server; il polling resta cache-ato.
  const freshRef = useRef(false);
  const q = useQuery({
    queryKey: ["board", date],
    queryFn: () => {
      const fresh = freshRef.current;
      freshRef.current = false;
      return fetchBoard(date, fresh);
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const refresh = () => {
    freshRef.current = true;
    return q.refetch();
  };
  return { ...q, refresh };
}

"use client";

import { useAtomValue } from "jotai";
import { liveStreamingAtom } from "@/lib/atoms";
import { cn } from "@/lib/utils";

// Verde "Live" quando un mercato è in streaming via WebSocket, altrimenti "Polling".
export function ConnectionStatus() {
  const live = useAtomValue(liveStreamingAtom);
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          live ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50",
        )}
      />
      {live ? "Live (WebSocket)" : "Polling 20s"}
    </div>
  );
}

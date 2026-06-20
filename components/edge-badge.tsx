"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isAligned, signedPoints } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Mostra l'edge (oracolo - mercato) in punti percentuali.
 * Verde = l'oracolo dà più probabilità del mercato (potenziale "value" sul Yes).
 * Check verde = oracolo e mercato combaciano (edge trascurabile).
 */
export function EdgeBadge({ points, className }: { points: number; className?: string }) {
  if (isAligned(points)) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 tabular-nums font-medium border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
          className,
        )}
        title="Oracle and market aligned: no significant edge"
      >
        <Check className="h-3 w-3" />
        {signedPoints(points)}
      </Badge>
    );
  }

  const strong = Math.abs(points) >= 15;
  const positive = points > 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        "tabular-nums font-medium",
        positive
          ? strong
            ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
          : strong
            ? "border-red-500 bg-red-500/15 text-red-600 dark:text-red-400"
            : "border-red-500/40 text-red-600 dark:text-red-400",
        className,
      )}
      title="Edge = oracle probability − market implied probability"
    >
      {signedPoints(points)}
    </Badge>
  );
}

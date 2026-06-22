"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isAligned, signedPoints } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Edge (oracolo − mercato) in punti percentuali, con scala colori chiara:
 *  - ≈0 (allineati): neutro/grigio (nessun edge significativo)
 *  - positivo: verde (oracolo più fiducioso → possibile value sul «Yes»), più intenso se forte
 *  - negativo: ambra se lieve, rosso se forte (mercato più fiducioso → «Yes» caro)
 */
export function EdgeBadge({ points, className }: { points: number; className?: string }) {
  const aligned = isAligned(points);
  const positive = points > 0;
  const strong = Math.abs(points) >= 10;

  let cls: string;
  let title: string;
  if (aligned) {
    cls = "border-border bg-muted/50 text-muted-foreground";
    title = "Oracle and market aligned: negligible edge";
  } else if (positive) {
    cls = strong
      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
    title = "Oracle more confident than the market → possible value on «Yes»";
  } else {
    cls = strong
      ? "border-red-500 bg-red-500/20 text-red-300"
      : "border-amber-500/50 bg-amber-500/10 text-amber-400";
    title = "Oracle less confident than the market → «Yes» potentially overpriced";
  }

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 tabular-nums font-semibold", cls, className)}
      title={title}
    >
      {aligned ? <Check className="h-3 w-3" /> : null}
      {signedPoints(points)}
    </Badge>
  );
}

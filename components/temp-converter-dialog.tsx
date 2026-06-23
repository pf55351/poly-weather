"use client";

import { useState } from "react";
import { ArrowLeftRight, Thermometer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Convertitore °C ↔ °F bidirezionale: digitando in un campo si aggiorna l'altro in tempo reale.
// I mercati sono misti (alcune città in °C, altre in °F): comodo averlo sempre a portata.
const round = (n: number) => Math.round(n * 100) / 100;
const cToF = (c: number) => (c * 9) / 5 + 32;
const fToC = (f: number) => ((f - 32) * 5) / 9;

export function TempConverterDialog({ className }: { className?: string }) {
  const [celsius, setCelsius] = useState("");
  const [fahrenheit, setFahrenheit] = useState("");

  const onCelsius = (v: string) => {
    setCelsius(v);
    const n = parseFloat(v.replace(",", "."));
    setFahrenheit(v.trim() === "" || Number.isNaN(n) ? "" : String(round(cToF(n))));
  };
  const onFahrenheit = (v: string) => {
    setFahrenheit(v);
    const n = parseFloat(v.replace(",", "."));
    setCelsius(v.trim() === "" || Number.isNaN(n) ? "" : String(round(fToC(n))));
  };

  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          "grid place-items-center h-8 w-8 rounded-lg border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors",
          className,
        )}
        aria-label="Temperature converter"
        title="°C ↔ °F converter"
      >
        <Thermometer className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="w-full max-w-sm p-5">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-base">Temperature converter</DialogTitle>
          <DialogDescription>Type in either field — the other updates live.</DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-3 pt-1">
          <Field label="Celsius" unit="°C" value={celsius} onChange={onCelsius} />
          <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground mb-3" />
          <Field label="Fahrenheit" unit="°F" value={fahrenheit} onChange={onFahrenheit} />
        </div>

        <div className="mt-1 flex flex-wrap gap-1.5">
          {[0, 10, 20, 25, 30, 35].map((c) => (
            <button
              key={c}
              onClick={() => onCelsius(String(c))}
              className="rounded-md border border-border/60 bg-card/50 px-2 py-1 text-xs text-muted-foreground tabular-nums hover:text-foreground hover:border-primary/40 transition-colors"
            >
              {c}°C
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex-1 min-w-0">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full h-11 rounded-xl border border-border/60 bg-card/50 pl-3 pr-9 text-lg font-semibold tabular-nums outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {unit}
        </span>
      </div>
    </label>
  );
}

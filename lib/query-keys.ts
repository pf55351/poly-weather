export const queryKeys = {
  markets: (cityId: string, date: string) => ["markets", cityId, date] as const,
  oracle: (cityId: string, date: string) => ["oracle", cityId, date] as const,
};

/** Data odierna in formato YYYY-MM-DD (UTC), usata come chiave/parametro. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO (YYYY-MM-DD) spostato di n giorni rispetto a baseISO. */
export function isoPlusDays(baseISO: string, n: number): string {
  const d = new Date(`${baseISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Etichetta "Jun 20, 2026" da una data ISO. */
export function shortLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

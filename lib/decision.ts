// Logica decisionale: dato il prezzo TRADEABLE (best ask per comprare «Yes») e la
// probabilità dell'oracolo q, calcola valore atteso, ROI e stake di Kelly.
// Comprare «Yes» a prezzo p (0..1) paga 1 se vince: EV per contratto = q − p.

/** Valore atteso per contratto (profitto medio in $ su un contratto da $1). = q − ask */
export function evPerContract(q: number, ask: number): number {
  return q - ask;
}

/** Ritorno atteso sull'investito: (q − ask) / ask. */
export function roi(q: number, ask: number): number {
  return ask > 0 ? (q - ask) / ask : 0;
}

/** Frazione di Kelly piena: f = (q − ask) / (1 − ask). 0 se non c'è valore. */
export function kellyFraction(q: number, ask: number): number {
  if (ask <= 0 || ask >= 1) return 0;
  return Math.max(0, (q - ask) / (1 - ask));
}

/** Stake suggerito: Kelly FRAZIONARIO (default ½) con cap (default 25% del bankroll). */
export function suggestedStake(
  q: number,
  ask: number,
  { fraction = 0.5, cap = 0.25 }: { fraction?: number; cap?: number } = {},
): number {
  return Math.min(cap, kellyFraction(q, ask) * fraction);
}

/** Soglia minima di EV (in frazione) per segnalare "value", a coprire spread/fee. */
export const VALUE_THRESHOLD = 0.02;

export function isValue(q: number, ask: number): boolean {
  return evPerContract(q, ask) >= VALUE_THRESHOLD;
}

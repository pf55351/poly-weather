// Segnale operativo onesto: NON un EV secco (la calibrazione dell'oracolo è troppo
// fragile per fidarsi di edge piccoli), ma un insieme di "gate" che devono valere TUTTI.
// L'idea: accendere il segnale solo quando l'oracolo batte il prezzo CON MARGINE, nella
// zona di prezzo dove sia mercato che modello sono affidabili, con fonti concordi,
// liquidità decente e (per i mercati sul massimo giornaliero) a giornata avanzata.
//
// Due lati simmetrici:
//  - YES: l'oracolo prezza il bucket SOPRA il best ask → compra «Yes».
//  - NO:  l'oracolo prezza il bucket SOTTO il best bid (Yes sopravvalutato) → compra «No».
import type { TempUnit } from "./cities";

/** Edge minimo (punti %) per agire: deve superare il rumore di calibrazione (~2–5pt). */
export const STRONG_EDGE_PT = 8;
/** Edge massimo plausibile (punti %). Oltre, contro un mercato liquido, NON è un'opportunità
 *  ma un errore nei nostri dati (es. floor osservato sballato) → si sopprime il segnale. */
export const EDGE_MAX_PT = 25;
/** Fascia di prezzo affidabile: fuori da qui le code della normale sono inaffidabili. */
export const ASK_MIN = 0.15;
export const ASK_MAX = 0.7;
/** Numero minimo di fonti meteo concordi. */
export const MIN_SOURCES = 4;
/** Dispersione massima tra le fonti (°C; in °F la soglia scala). */
export const MAX_STDEV_C = 2.5;
/** Volume 24h minimo ($) perché il book non sia stantio/largo. */
export const MIN_VOLUME = 500;
/** Liquidità minima ($) del bucket: sotto, il prezzo non è affidabile e l'edge è illusorio. */
export const MIN_LIQUIDITY = 1000;
/** Quota di giornata locale trascorsa: il massimo si "blocca" nel pomeriggio. */
export const LATE_DAY_FRACTION = 0.6;
/** Frazione di Kelly usata per il sizing (½-Kelly: prudente dato il modello non calibrato). */
export const KELLY_FRACTION = 0.5;
/** Tetto alla puntata come frazione del cash, qualunque sia l'edge. */
export const MAX_STAKE_FRACTION = 0.1;

export type TradeSide = "YES" | "NO";

export interface BuyCheck {
  label: string;
  ok: boolean;
}

export interface TradeSignalResult {
  /** lato da comprare se TUTTI i gate sono soddisfatti, altrimenti null */
  side: TradeSide | null;
  /** edge in punti % del lato che ha acceso (o del candidato migliore), null se mancano i dati */
  edgePts: number | null;
  /** gate del lato pertinente, per il tooltip */
  checks: BuyCheck[];
  /** puntata suggerita come frazione del cash (½-Kelly, cap 10%); null se nessun lato accende */
  stakeFraction: number | null;
}

/** ½-Kelly (cap MAX_STAKE_FRACTION) per una scommessa binaria.
 *  YES: paghi `ask`, vinci 1 con prob q → f* = (q − ask)/(1 − ask).
 *  NO:  paghi 1 − bid, vinci 1 con prob 1 − q → f* = (bid − q)/bid. */
function stakeFractionFor(side: TradeSide, q: number, ask: number, bid: number): number {
  const fStar = side === "YES" ? (q - ask) / (1 - ask) : (bid - q) / bid;
  if (!Number.isFinite(fStar) || fStar <= 0) return 0;
  return Math.min(MAX_STAKE_FRACTION, KELLY_FRACTION * fStar);
}

export interface TradeSignalInput {
  /** probabilità dell'oracolo per questo bucket (0..1) */
  q: number | null;
  /** best ask di «Yes» (prezzo per comprare Yes, 0..1) */
  ask: number | null;
  /** best bid di «Yes» (prezzo per vendere Yes); il «No» si compra a ~ 1 − bid */
  bid: number | null;
  /** numero di fonti meteo che hanno risposto */
  sourceCount: number;
  /** dispersione dell'oracolo nell'unità target */
  stdev: number;
  unit: TempUnit;
  /** volume 24h del bucket ($) */
  volume24hr: number | null;
  /** liquidità del bucket ($) */
  liquidity: number | null;
  /** frazione 0..1 di giornata locale trascorsa, o null se ignota */
  dayFraction: number | null;
}

/** Gate condivisi tra i due lati (fonti, liquidità, ora del giorno). */
function sharedChecks(i: TradeSignalInput): BuyCheck[] {
  const maxStdev = i.unit === "F" ? MAX_STDEV_C * 1.8 : MAX_STDEV_C;
  return [
    { label: `≥ ${MIN_SOURCES} sources agree`, ok: i.sourceCount >= MIN_SOURCES && i.stdev <= maxStdev },
    {
      label: "Liquid market",
      ok: (i.volume24hr ?? 0) >= MIN_VOLUME && (i.liquidity ?? 0) >= MIN_LIQUIDITY,
    },
    {
      label: "Daily high settling",
      ok: i.dayFraction === null || i.dayFraction >= LATE_DAY_FRACTION,
    },
  ];
}

/** Gate specifici di un lato: edge sufficiente e prezzo d'acquisto nella fascia affidabile. */
function sideChecks(edgePts: number | null, buyPrice: number | null): BuyCheck[] {
  return [
    { label: `Edge ≥ ${STRONG_EDGE_PT}pt`, ok: edgePts !== null && edgePts >= STRONG_EDGE_PT },
    {
      label: `Edge ≤ ${EDGE_MAX_PT}pt (sanity)`,
      ok: edgePts !== null && edgePts <= EDGE_MAX_PT,
    },
    {
      label: `Price ${Math.round(ASK_MIN * 100)}–${Math.round(ASK_MAX * 100)}%`,
      ok: buyPrice !== null && buyPrice >= ASK_MIN && buyPrice <= ASK_MAX,
    },
  ];
}

export function tradeSignal(i: TradeSignalInput): TradeSignalResult {
  const shared = sharedChecks(i);

  // YES: P(Yes) − prezzo d'acquisto Yes (best ask).
  const yesEdge = i.q !== null && i.ask !== null ? (i.q - i.ask) * 100 : null;
  const yesChecks = [...sideChecks(yesEdge, i.ask), ...shared];
  const yesBuy = yesChecks.every((c) => c.ok);

  // NO: prezzo d'acquisto No ≈ 1 − best bid; P(No) = 1 − q.
  // edge = P(No) − prezzo No = (1 − q) − (1 − bid) = bid − q.
  const noPrice = i.bid !== null ? 1 - i.bid : null;
  const noEdge = i.q !== null && i.bid !== null ? (i.bid - i.q) * 100 : null;
  const noChecks = [...sideChecks(noEdge, noPrice), ...shared];
  const noBuy = noChecks.every((c) => c.ok);

  // I due lati sono mutuamente esclusivi (bid ≤ ask ⇒ non possono passare entrambi).
  if (yesBuy && i.q !== null && i.ask !== null) {
    return { side: "YES", edgePts: yesEdge, checks: yesChecks, stakeFraction: stakeFractionFor("YES", i.q, i.ask, i.bid ?? i.ask) };
  }
  if (noBuy && i.q !== null && i.bid !== null) {
    return { side: "NO", edgePts: noEdge, checks: noChecks, stakeFraction: stakeFractionFor("NO", i.q, i.ask ?? i.bid, i.bid) };
  }

  // Nessun segnale: ritorna il lato col candidato d'edge migliore, per un tooltip sensato.
  const useNo = (noEdge ?? -Infinity) > (yesEdge ?? -Infinity);
  return useNo
    ? { side: null, edgePts: noEdge, checks: noChecks, stakeFraction: null }
    : { side: null, edgePts: yesEdge, checks: yesChecks, stakeFraction: null };
}

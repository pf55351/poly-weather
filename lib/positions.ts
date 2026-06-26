// Client per la Data API di Polymarket (pubblica, nessuna auth): le posizioni aperte
// di un wallet con il relativo rendimento (P&L). L'indirizzo è il "proxy wallet"
// (quello in polymarket.com/profile/0x…), non per forza l'EOA dell'utente.
import { cacheInit } from "./fetch-cache";

const DATA_API = "https://data-api.polymarket.com";

/** Indirizzo wallet valido (0x + 40 hex). */
export function isWalletAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export interface PolyPosition {
  /** token id ERC1155 dell'outcome posseduto */
  asset: string;
  conditionId: string;
  /** quote possedute */
  size: number;
  /** prezzo medio di carico (0..1) */
  avgPrice: number;
  /** prezzo corrente (0..1) */
  curPrice: number;
  /** capitale investito residuo ($) */
  initialValue: number;
  /** valore di mercato attuale ($) */
  currentValue: number;
  /** P&L NON realizzato ($) = currentValue − initialValue */
  cashPnl: number;
  /** P&L non realizzato (%) */
  percentPnl: number;
  /** P&L già realizzato su questa posizione ($) */
  realizedPnl: number;
  /** true se il mercato è risolto e la posizione è riscattabile */
  redeemable: boolean;
  title: string;
  slug: string;
  eventSlug: string | null;
  icon: string | null;
  /** "Yes" / "No" */
  outcome: string;
  endDate: string | null;
}

export interface PositionsSummary {
  count: number;
  /** Σ valore di mercato attuale delle posizioni ($) */
  positionsValue: number;
  /** cash non investito nel wallet (pUSD, $) */
  cash: number;
  /** valore totale del portafoglio = posizioni + cash ($) */
  totalValue: number;
  /** Σ capitale investito residuo ($) */
  totalCost: number;
  /** Σ P&L non realizzato ($) */
  totalPnl: number;
  /** rendimento non realizzato sul capitale investito (%) */
  pnlPct: number;
  /** Σ P&L realizzato ($) */
  realizedPnl: number;
}

export interface PositionsResult {
  address: string;
  generatedAt: string;
  /** posizioni su mercati ancora attivi */
  positions: PolyPosition[];
  /** posizioni su mercati FINITI (risolti/riscattabili) */
  finished: PolyPosition[];
  summary: PositionsSummary;
}

const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const s = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

interface RawPosition {
  asset?: string;
  conditionId?: string;
  size?: number;
  avgPrice?: number;
  curPrice?: number;
  initialValue?: number;
  currentValue?: number;
  cashPnl?: number;
  percentPnl?: number;
  realizedPnl?: number;
  redeemable?: boolean;
  title?: string;
  slug?: string;
  eventSlug?: string;
  icon?: string;
  outcome?: string;
  endDate?: string;
}

function normalize(r: RawPosition): PolyPosition {
  return {
    asset: r.asset ?? "",
    conditionId: r.conditionId ?? "",
    size: n(r.size),
    avgPrice: n(r.avgPrice),
    curPrice: n(r.curPrice),
    initialValue: n(r.initialValue),
    currentValue: n(r.currentValue),
    cashPnl: n(r.cashPnl),
    percentPnl: n(r.percentPnl),
    realizedPnl: n(r.realizedPnl),
    redeemable: Boolean(r.redeemable),
    title: r.title ?? "Untitled market",
    slug: r.slug ?? "",
    eventSlug: s(r.eventSlug),
    icon: s(r.icon),
    outcome: r.outcome ?? "",
    endDate: s(r.endDate),
  };
}

/** Posizione su un mercato ANCORA ATTIVO: non riscattabile (mercato non risolto) e prezzo
 *  non incollato agli estremi 0/1 (cioè ancora in contrattazione). */
export function isActivePosition(p: PolyPosition): boolean {
  return !p.redeemable && p.curPrice > 0 && p.curPrice < 1;
}

/** Posizione di un mercato FINITO da RISCATTARE: risolto a tuo favore, c'è un payout da claimare.
 *  (Le risolte perdenti hanno currentValue 0 → niente da claimare.) */
export function isClaimable(p: PolyPosition): boolean {
  return p.redeemable && p.currentValue > 0;
}

/** Prezzo sotto il quale il mercato considera la posizione ormai perdente. */
const CLOSE_PRICE = 0.35;
/** Valore residuo minimo ($) per cui vale la pena uscire (sotto, si lascia risolvere). */
const CLOSE_MIN_VALUE = 1;

/** Posizione DA CHIUDERE: il mercato l'ha ormai data perdente (prezzo basso) e sei in perdita,
 *  ma resta ancora valore da recuperare vendendo ora, prima che vada a 0. Le posizioni già
 *  praticamente azzerate non sono "da chiudere" (recuperi nulla, tanto vale lasciarle risolvere). */
export function shouldClose(p: PolyPosition): boolean {
  return (
    !p.redeemable &&
    p.cashPnl < 0 &&
    p.curPrice < CLOSE_PRICE &&
    p.currentValue >= CLOSE_MIN_VALUE
  );
}

/** Aggregato di portafoglio dalle posizioni aperte + cash non investito (pUSD). */
export function summarizePositions(positions: PolyPosition[], cash = 0): PositionsSummary {
  const positionsValue = positions.reduce((a, p) => a + p.currentValue, 0);
  const totalCost = positions.reduce((a, p) => a + p.initialValue, 0);
  const totalPnl = positions.reduce((a, p) => a + p.cashPnl, 0);
  const realizedPnl = positions.reduce((a, p) => a + p.realizedPnl, 0);
  return {
    count: positions.length,
    positionsValue,
    cash,
    totalValue: positionsValue + cash,
    totalCost,
    totalPnl,
    pnlPct: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
    realizedPnl,
  };
}

// pUSD: collateral Polymarket post-upgrade (28/04/2026), ERC-20 su Polygon, 1:1 con USDC,
// 6 decimali. Il "cash" del wallet è il suo saldo pUSD non investito in posizioni.
const PUSD = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";
const POLYGON_RPC = process.env.POLYGON_RPC_URL ?? "https://polygon-bor-rpc.publicnode.com";

/** Saldo pUSD ($) del wallet via eth_call balanceOf. 0 su qualsiasi errore (non blocca le posizioni). */
export async function fetchCashBalance(
  address: string,
  signal?: AbortSignal,
  fresh?: boolean,
): Promise<number> {
  try {
    const data = `0x70a08231${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
    const res = await fetch(POLYGON_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: PUSD, data }, "latest"],
      }),
      signal,
      ...cacheInit(15, fresh),
    });
    if (!res.ok) return 0;
    const json = (await res.json()) as { result?: string };
    if (!json.result || json.result === "0x") return 0;
    return Number(BigInt(json.result)) / 1e6; // 6 decimali
  } catch {
    return 0;
  }
}

/** Posizioni aperte del wallet, ordinate per valore di mercato decrescente. */
export async function fetchPositions(
  address: string,
  signal?: AbortSignal,
  fresh?: boolean,
): Promise<PolyPosition[]> {
  const url = `${DATA_API}/positions?user=${address}&sizeThreshold=1&limit=500`;
  const res = await fetch(url, { signal, ...cacheInit(15, fresh) });
  if (!res.ok) throw new Error(`Polymarket data-api: ${res.status}`);
  const raw = (await res.json()) as RawPosition[];
  if (!Array.isArray(raw)) return [];
  // Tutte le posizioni (attive + finite); la suddivisione la fa il chiamante.
  return raw.map(normalize).sort((a, b) => b.currentValue - a.currentValue);
}

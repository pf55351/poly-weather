// Client per il canale "market" del CLOB WebSocket di Polymarket.
// Usato SOLO nella vista di dettaglio (approccio ibrido: polling per la griglia,
// WS per il mercato aperto). Gestisce sottoscrizione, heartbeat e riconnessione.
"use client";

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

export interface PriceUpdate {
  /** token id (asset) aggiornato */
  assetId: string;
  /** prezzo medio/mid 0..1 */
  price: number;
}

type Listener = (u: PriceUpdate) => void;

export class MarketStream {
  private ws: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;

  constructor(
    private assetIds: string[],
    private onUpdate: Listener,
    private onStatus?: (connected: boolean) => void,
  ) {}

  connect() {
    this.closedByUser = false;
    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.onStatus?.(true);
      this.ws?.send(JSON.stringify({ assets_ids: this.assetIds, type: "market" }));
      // heartbeat per tenere viva la connessione
      this.heartbeat = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send("PING");
      }, 10_000);
    };

    this.ws.onmessage = (ev) => {
      if (typeof ev.data !== "string" || ev.data === "PONG") return;
      try {
        const parsed = JSON.parse(ev.data);
        const events = Array.isArray(parsed) ? parsed : [parsed];
        for (const e of events) this.handleEvent(e);
      } catch {
        /* ignora frame non-JSON */
      }
    };

    this.ws.onclose = () => {
      this.onStatus?.(false);
      this.cleanupTimers();
      if (!this.closedByUser) this.scheduleReconnect();
    };

    this.ws.onerror = () => this.ws?.close();
  }

  private handleEvent(e: Record<string, unknown>) {
    const type = e.event_type;
    const assetId = String(e.asset_id ?? "");
    if (!assetId) return;

    if (type === "book") {
      // Snapshot completo: prezzo = mid tra MIGLIOR bid e MIGLIOR ask.
      const price = this.midFromBook(e);
      if (price !== null) this.onUpdate({ assetId, price });
    } else if (type === "last_trade_price") {
      // Prezzo di un trade reale: affidabile.
      const p = typeof e.price === "string" ? parseFloat(e.price) : (e.price as number);
      if (Number.isFinite(p) && p >= 0 && p <= 1) this.onUpdate({ assetId, price: p });
    }
    // NB: "price_change" viene IGNORATO di proposito: è la variazione di un singolo
    // livello dell'orderbook (es. un ask a 0.99), NON il best/mid. Usarlo come prezzo
    // mostrava percentuali errate/invertite. Il polling (20s) tiene comunque i prezzi freschi.
  }

  /** Mid tra il miglior bid (max) e il miglior ask (min), robusto all'ordinamento. */
  private midFromBook(e: Record<string, unknown>): number | null {
    const bids = (e.bids as { price: string }[] | undefined) ?? [];
    const asks = (e.asks as { price: string }[] | undefined) ?? [];
    const bidP = bids.map((b) => parseFloat(b.price)).filter((n) => Number.isFinite(n));
    const askP = asks.map((a) => parseFloat(a.price)).filter((n) => Number.isFinite(n));
    const bestBid = bidP.length ? Math.max(...bidP) : null;
    const bestAsk = askP.length ? Math.min(...askP) : null;
    if (bestBid !== null && bestAsk !== null) return (bestBid + bestAsk) / 2;
    return bestBid ?? bestAsk ?? null;
  }

  private scheduleReconnect() {
    this.cleanupTimers();
    this.reconnectTimer = setTimeout(() => this.connect(), 3_000);
  }

  private cleanupTimers() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.heartbeat = null;
    this.reconnectTimer = null;
  }

  close() {
    this.closedByUser = true;
    this.cleanupTimers();
    this.ws?.close();
    this.ws = null;
  }
}

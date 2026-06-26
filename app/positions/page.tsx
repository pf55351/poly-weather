"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Wallet,
  RefreshCw,
  X,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Lock,
  Pencil,
  LogOut,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePositions } from "@/hooks/use-positions";
import { useStoredWallet } from "@/hooks/use-wallet";
import {
  isWalletAddress,
  shouldClose,
  isClaimable,
  type PolyPosition,
  type PositionsSummary,
} from "@/lib/positions";
import { pct, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "+$1.2K" / "−$340" con segno. */
function signedUsd(v: number): string {
  return `${v >= 0 ? "+" : "−"}${usd(Math.abs(v))}`;
}
function signedPct(v: number): string {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
}
function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function PositionsPage() {
  const [address, setAddress] = useStoredWallet();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  const valid = isWalletAddress(draft);
  const query = usePositions(address);
  const showForm = editing || !address;

  const save = () => {
    const a = draft.trim();
    if (!isWalletAddress(a)) return;
    setAddress(a);
    setDraft("");
    setEditing(false);
  };

  const data = query.data;
  const toClose = (data?.positions ?? []).filter(shouldClose);
  const recoverable = toClose.reduce((a, p) => a + p.currentValue, 0);
  const updatedAt = query.dataUpdatedAt
    ? new Date(query.dataUpdatedAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-20 border-b border-border/60 glass">
        <div className="mx-auto max-w-3xl flex items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> cities
          </Link>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 ring-1 ring-primary/30 glow-primary shrink-0">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-lg font-extrabold tracking-tight">Open positions</h1>
          <div className="ml-auto flex items-center gap-2">
            {updatedAt ? (
              <span suppressHydrationWarning className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                Updated {updatedAt}
              </span>
            ) : null}
            <button
              onClick={() => query.refresh()}
              disabled={query.isFetching || !address}
              aria-label="Refresh"
              title="Refresh now"
              className="grid place-items-center h-8 w-8 rounded-lg border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 space-y-5">
        {/* Wallet: form di inserimento oppure chip dell'indirizzo attivo */}
        {showForm ? (
          <Card className="p-4 gap-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Polymarket wallet address
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  spellCheck={false}
                  autoFocus
                  placeholder="0x… (your profile address on polymarket.com)"
                  className="w-full h-11 rounded-xl border border-border/60 bg-card/50 pl-3 pr-9 text-sm font-mono outline-none transition-colors placeholder:text-muted-foreground placeholder:font-sans focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                {draft ? (
                  <button
                    onClick={() => setDraft("")}
                    aria-label="Clear"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <button
                onClick={save}
                disabled={!valid}
                className="h-11 px-5 rounded-xl text-sm font-semibold bg-primary/20 text-primary glow-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
              >
                Load
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              The proxy wallet in your profile URL{" "}
              <span className="font-mono">polymarket.com/profile/0x…</span>. Saved only in this browser.
            </p>
          </Card>
        ) : (
          <Card className="p-3.5 flex-row items-center gap-3">
            <Wallet className="h-4 w-4 text-primary shrink-0" />
            <span className="font-mono text-sm truncate">{shortAddr(address)}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => {
                  setDraft(address);
                  setEditing(true);
                }}
                aria-label="Change wallet"
                title="Change wallet"
                className="grid place-items-center h-8 w-8 rounded-lg border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setAddress("")}
                aria-label="Remove wallet"
                title="Remove wallet"
                className="grid place-items-center h-8 w-8 rounded-lg border border-border/60 bg-card/50 text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Card>
        )}

        {/* Stati */}
        {!address ? (
          <EmptyHint
            title="Enter your wallet to see positions"
            body="Paste the Polymarket address above and press Load. Positions and P&L are fetched live from Polymarket’s public data API."
          />
        ) : query.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyHint
            title="Couldn’t load positions"
            body={query.error instanceof Error ? query.error.message : "Unknown error."}
            tone="error"
          />
        ) : data ? (
          <>
            <SummaryCard summary={data.summary} />
            {toClose.length > 0 ? (
              <Card className="p-3.5 flex-row items-center gap-2.5 border-amber-500/50 bg-amber-500/10">
                <LogOut className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="text-sm">
                  <span className="font-semibold text-amber-300">{toClose.length} to close</span>{" "}
                  <span className="text-muted-foreground">
                    · ~{usd(recoverable)} recoverable · market has turned against them
                  </span>
                </span>
              </Card>
            ) : null}
            {data.positions.length > 0 ? (
              <div className="space-y-3">
                {data.positions.map((p) => (
                  <PositionCard key={p.asset} p={p} />
                ))}
              </div>
            ) : (
              <EmptyHint
                title="No active positions"
                body="No positions on markets that are still trading."
              />
            )}
            {data.finished.length > 0 ? <FinishedSection finished={data.finished} /> : null}
          </>
        ) : null}
      </main>

      <footer className="border-t border-border/60 py-3 text-center text-xs text-muted-foreground">
        Positions &amp; P&amp;L: Polymarket public Data API · prices update live
      </footer>
    </div>
  );
}

function SummaryCard({ summary }: { summary: PositionsSummary }) {
  const up = summary.totalPnl >= 0;
  return (
    <Card className="p-5 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Portfolio value</div>
          <div className="text-3xl font-extrabold tabular-nums">{usd(summary.totalValue)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Unrealized P&amp;L</div>
          <div
            className={cn(
              "flex items-center justify-end gap-1.5 text-2xl font-bold tabular-nums",
              up ? "text-emerald-400" : "text-red-400",
            )}
          >
            {up ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            {signedUsd(summary.totalPnl)}
            <span className="text-base font-semibold">({signedPct(summary.pnlPct)})</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border/40 pt-3 text-xs text-muted-foreground tabular-nums">
        <span>
          Cash <span className="text-foreground font-semibold">{usd(summary.cash)}</span>
        </span>
        <span>
          Positions{" "}
          <span className="text-foreground font-semibold">
            {usd(summary.positionsValue)} · {summary.count}
          </span>
        </span>
        <span>
          Invested <span className="text-foreground font-semibold">{usd(summary.totalCost)}</span>
        </span>
        <span>
          Realized P&amp;L{" "}
          <span className={cn("font-semibold", summary.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
            {signedUsd(summary.realizedPnl)}
          </span>
        </span>
      </div>
    </Card>
  );
}

function PositionCard({ p }: { p: PolyPosition }) {
  const up = p.cashPnl >= 0;
  const isYes = p.outcome.toLowerCase() === "yes";
  const close = shouldClose(p);
  const href = p.eventSlug
    ? `https://polymarket.com/event/${p.eventSlug}`
    : `https://polymarket.com/market/${p.slug}`;

  return (
    <Card
      className={cn(
        "relative p-4 flex-row items-center gap-4 overflow-hidden transition-all",
        close
          ? "border-amber-500/60 ring-1 ring-amber-500/20"
          : "hover:border-primary/40 hover:glow-primary",
      )}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-0"
        aria-label={`Open ${p.title} on Polymarket`}
      />
      <div className="relative z-10 h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-muted/60 ring-1 ring-border grid place-items-center">
        {p.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.icon} alt="" className="h-full w-full object-cover" />
        ) : (
          <Wallet className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "text-[10px] border-0 shrink-0",
              isYes ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
            )}
          >
            {p.outcome || "—"}
          </Badge>
          <span className="text-sm font-semibold truncate">{p.title}</span>
          {close ? (
            <Badge
              variant="outline"
              className="ml-auto shrink-0 gap-1 text-[10px] font-semibold text-amber-300 border-amber-500/60 bg-amber-500/10"
              title="Market has turned against this position — consider closing to recover value"
            >
              <LogOut className="h-3 w-3" /> close
            </Badge>
          ) : p.redeemable ? (
            <Badge variant="outline" className="ml-auto shrink-0 gap-1 text-[10px] text-amber-400 border-amber-500/50">
              <Lock className="h-3 w-3" /> redeemable
            </Badge>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs tabular-nums">
          <Stat label="Shares" value={p.size.toLocaleString("en-US", { maximumFractionDigits: 0 })} />
          <Stat label="Avg" value={pct(p.avgPrice, 0)} />
          <Stat label="Now" value={pct(p.curPrice, 0)} />
          <Stat label="Value" value={usd(p.currentValue)} />
          <div className="ml-auto flex items-center gap-1.5">
            <span className={cn("font-semibold", up ? "text-emerald-400" : "text-red-400")}>
              {signedUsd(p.cashPnl)} ({signedPct(p.percentPnl)})
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function FinishedSection({ finished }: { finished: PolyPosition[] }) {
  const claimable = finished.filter(isClaimable);
  const claimValue = claimable.reduce((a, p) => a + p.currentValue, 0);
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Finished markets</h2>
        {claimable.length > 0 ? (
          <span className="text-xs font-semibold text-emerald-400 tabular-nums">
            {claimable.length} to claim · {usd(claimValue)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">nothing to claim</span>
        )}
      </div>
      {finished.map((p) => {
        const claim = isClaimable(p);
        const isYes = p.outcome.toLowerCase() === "yes";
        const href = p.eventSlug
          ? `https://polymarket.com/event/${p.eventSlug}`
          : `https://polymarket.com/market/${p.slug}`;
        return (
          <a
            key={p.asset}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 transition-colors",
              claim
                ? "border-emerald-500/50 bg-emerald-500/10 hover:border-emerald-500"
                : "border-border/60 bg-card/40 hover:border-border opacity-70",
            )}
          >
            <Badge
              className={cn(
                "text-[10px] border-0 shrink-0",
                isYes ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
              )}
            >
              {p.outcome || "—"}
            </Badge>
            <span className="text-sm truncate flex-1">{p.title}</span>
            {claim ? (
              <span className="shrink-0 flex items-center gap-1 text-sm font-bold text-emerald-400 tabular-nums">
                Claim {usd(p.currentValue)} <ExternalLink className="h-3.5 w-3.5" />
              </span>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">lost</span>
            )}
          </a>
        );
      })}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

function EmptyHint({ title, body, tone }: { title: string; body: string; tone?: "error" }) {
  return (
    <Card
      className={cn(
        "p-6 flex flex-col items-center text-center gap-2 border-dashed",
        tone === "error" && "border-red-500/40",
      )}
    >
      <Wallet className={cn("h-7 w-7", tone === "error" ? "text-red-400" : "text-muted-foreground")} />
      <div className="font-medium">{title}</div>
      <p className="text-sm text-muted-foreground max-w-sm">{body}</p>
    </Card>
  );
}

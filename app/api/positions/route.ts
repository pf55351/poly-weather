import { NextRequest, NextResponse } from "next/server";
import {
  fetchPositions,
  fetchCashBalance,
  summarizePositions,
  isWalletAddress,
  isActivePosition,
  type PositionsResult,
} from "@/lib/positions";

// GET /api/positions?user=0x… -> posizioni aperte + rendimento del wallet.
// In assenza di `user` usa POLYMARKET_WALLET (fallback opzionale via env).
export async function GET(req: NextRequest) {
  const address = (
    req.nextUrl.searchParams.get("user") ||
    process.env.POLYMARKET_WALLET ||
    process.env.NEXT_PUBLIC_POLYMARKET_WALLET ||
    ""
  ).trim();

  if (!address) {
    return NextResponse.json(
      { error: "Wallet address mancante: passa ?user=0x… o imposta POLYMARKET_WALLET." },
      { status: 400 },
    );
  }
  if (!isWalletAddress(address)) {
    return NextResponse.json(
      { error: `Indirizzo non valido: ${address}. Atteso 0x + 40 caratteri esadecimali.` },
      { status: 400 },
    );
  }

  try {
    const fresh = req.nextUrl.searchParams.get("fresh") === "1";
    const [all, cash] = await Promise.all([
      fetchPositions(address, undefined, fresh),
      fetchCashBalance(address, undefined, fresh),
    ]);
    const positions = all.filter(isActivePosition);
    const finished = all.filter((p) => p.redeemable);
    return NextResponse.json({
      address,
      generatedAt: new Date().toISOString(),
      positions,
      finished,
      summary: summarizePositions(positions, cash),
    } satisfies PositionsResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

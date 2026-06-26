import { NextRequest, NextResponse } from "next/server";
import { fetchCashBalance, isWalletAddress } from "@/lib/positions";

// GET /api/cash?user=0x… -> { cash } : saldo pUSD del wallet (per il sizing sul buy-signal).
export async function GET(req: NextRequest) {
  const address = (
    req.nextUrl.searchParams.get("user") ||
    process.env.POLYMARKET_WALLET ||
    process.env.NEXT_PUBLIC_POLYMARKET_WALLET ||
    ""
  ).trim();

  if (!isWalletAddress(address)) return NextResponse.json({ cash: 0 });
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const cash = await fetchCashBalance(address, undefined, fresh);
  return NextResponse.json({ cash });
}

import { readFileSync } from "fs";
const logs = JSON.parse(readFileSync("events-scan.json", "utf8"));
const addr = w => "0x" + w.slice(24); // last 40 hex chars = 20-byte address
const u256 = w => BigInt("0x" + w);
function decode(l) {
  const d = l.data.slice(2);
  const w = i => d.slice(i * 64, (i + 1) * 64);
  return {
    block: parseInt(l.blockNumber, 16), tx: l.transactionHash,
    sender: addr(l.topics[1].slice(2)), to: addr(l.topics[2].slice(2)), referrer: addr(l.topics[3].slice(2)),
    tokenIn: addr(w(0)), tokenOut: addr(w(1)),
    amountIn: u256(w(2)), amountOut: u256(w(3)),
    mid: addr(w(4)), venue1: addr(w(5)), venue2: addr(w(6)),
  };
}
const evs = logs.map(decode).sort((a, b) => a.block - b.block);
console.log("events:", evs.length, "| unique traders:", new Set(evs.map(e => e.sender)).size);
const venues = {};
for (const e of evs) for (const v of [e.venue1, e.venue2]) if (v !== "0x0000000000000000000000000000000000000000") venues[v] = (venues[v] || 0) + 1;
console.log("venues (full addresses):", venues);
console.log("referrers set:", [...new Set(evs.map(e => e.referrer))]);
const tokens = [...new Set(evs.flatMap(e => [e.tokenIn, e.tokenOut]))];
console.log("tokens:", tokens);
// USD volume: USDG leg = $1 (6dp); ETH leg at $1618.51 (CoinGecko, 21 Nov 2026)
const ETH = "0x0000000000000000000000000000000000000000";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const ETHUSD = 1618.51;
let usd = 0, usdKnown = 0;
for (const e of evs) {
  let v = null;
  if (e.tokenIn === USDG) v = Number(e.amountIn) / 1e6;
  else if (e.tokenOut === USDG) v = Number(e.amountOut) / 1e6;
  else if (e.tokenIn === ETH) v = Number(e.amountIn) / 1e18 * ETHUSD;
  else if (e.tokenOut === ETH) v = Number(e.amountOut) / 1e18 * ETHUSD;
  if (v !== null) { usd += v; usdKnown++; }
}
console.log(`USD volume (USDG-leg or ETH@${ETHUSD}): $${usd.toFixed(2)} across ${usdKnown}/${evs.length} swaps with known USD value`);
console.log("first event block:", evs[0].block, "tx:", evs[0].tx);
console.log("last event block:", evs[evs.length-1].block, "tx:", evs[evs.length-1].tx);
// save corrected events for the site build
import { writeFileSync } from "fs";
writeFileSync("events-decoded.json", JSON.stringify(evs.map(e => ({...e, amountIn: e.amountIn.toString(), amountOut: e.amountOut.toString()})), null, 1));

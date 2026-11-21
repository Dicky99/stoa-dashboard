// Corrected USD stats: case-insensitive token comparison (stats.mjs compared a
// checksummed USDG address against lowercase decoded addresses, silently
// dropping every USDG leg).
import { readFileSync } from "fs";
const evs = JSON.parse(readFileSync(new URL("./events-snapshot-2026-11-21.json", import.meta.url), "utf8"));
const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
const ZERO = "0x0000000000000000000000000000000000000000";
const ETHUSD = 1619.01; // CoinGecko at render-test time
let usd = 0, known = 0, usdgSum = 0, ethSum = 0;
for (const e of evs) {
  const ti = e.tokenIn.toLowerCase(), to = e.tokenOut.toLowerCase();
  let v = null;
  if (ti === USDG) { v = Number(e.amountIn) / 1e6; usdgSum += v; }
  else if (to === USDG) { v = Number(e.amountOut) / 1e6; usdgSum += v; }
  else if (ti === ZERO || ti === WETH) { v = Number(e.amountIn) / 1e18 * ETHUSD; ethSum += v; }
  else if (to === ZERO || to === WETH) { v = Number(e.amountOut) / 1e18 * ETHUSD; ethSum += v; }
  if (v !== null) { usd += v; known++; }
}
console.log(`events: ${evs.length} | known USD: ${known} | USDG-leg sum: $${usdgSum.toFixed(2)} | ETH-leg sum: $${ethSum.toFixed(2)} | TOTAL: $${usd.toFixed(2)}`);
console.log("unknown-USD swaps:", evs.filter(e => {
  const ti = e.tokenIn.toLowerCase(), to = e.tokenOut.toLowerCase();
  return ![ti, to].includes(USDG) && ![ti, to].includes(ZERO) && ![ti, to].includes(WETH);
}).map(e => e.tx.slice(0, 14) + " " + e.tokenIn.slice(0, 8) + "->" + e.tokenOut.slice(0, 8)));

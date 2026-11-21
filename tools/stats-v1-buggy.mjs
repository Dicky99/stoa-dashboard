import { readFileSync } from "fs";
const logs = JSON.parse(readFileSync("events-scan.json", "utf8"));
const addr = w => "0x" + w.slice(26);
const u256 = w => BigInt("0x" + w);
function decode(l) {
  const d = l.data.slice(2);
  const w = i => d.slice(i * 64, (i + 1) * 64);
  return {
    block: parseInt(l.blockNumber, 16),
    tx: l.transactionHash,
    sender: addr(l.topics[1].slice(2)),
    to: addr(l.topics[2].slice(2)),
    referrer: addr(l.topics[3].slice(2)),
    tokenIn: addr(w(0)), tokenOut: addr(w(1)),
    amountIn: u256(w(2)), amountOut: u256(w(3)),
    mid: addr(w(4)), venue1: addr(w(5)), venue2: addr(w(6)),
  };
}
const evs = logs.map(decode).sort((a, b) => a.block - b.block);
console.log("events:", evs.length);
const traders = new Set(evs.map(e => e.sender));
console.log("unique traders (sender):", traders.size);
const venues = {};
for (const e of evs) for (const v of [e.venue1, e.venue2]) if (v !== "0x0000000000000000000000000000000000000000") venues[v] = (venues[v] || 0) + 1;
console.log("venues:", venues);
const pairs = {};
for (const e of evs) pairs[e.tokenIn + " -> " + e.tokenOut] = (pairs[e.tokenIn + " -> " + e.tokenOut] || 0) + 1;
console.log("pairs:", pairs);
const tokens = new Set(); evs.forEach(e => { tokens.add(e.tokenIn); tokens.add(e.tokenOut); });
console.log("tokens involved:", [...tokens]);
const refs = new Set(evs.map(e => e.referrer).filter(r => r !== "0x0000000000000000000000000000000000000000"));
console.log("non-zero referrers:", [...refs]);
console.log("--- all events ---");
for (const e of evs) console.log(e.block, e.tx.slice(0, 18) + "…", e.sender.slice(0, 10), e.tokenIn.slice(0, 10), "->", e.tokenOut.slice(0, 10), "in:", e.amountIn.toString(), "out:", e.amountOut.toString(), "v1:", e.venue1.slice(0, 10), "v2:", e.venue2.slice(0, 10));

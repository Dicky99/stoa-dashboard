const RPC = "https://rpc.mainnet.chain.robinhood.com";
const UA = { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" };
async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: UA, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(method + ": " + JSON.stringify(j.error));
  return j.result;
}
const ROUTER = "0x2F2804fad735a38015650f32f95Ad5E08D6B3eE5";
const TOPIC0 = "0x2bbce25631e8fa58085b7ea5929726c3acdf2df8d6b1f099eb32fb7425a4f6da";

const latest = parseInt(await rpc("eth_blockNumber", []), 16);
console.log("latest block:", latest);
const bNow = await rpc("eth_getBlockByNumber", ["latest", false]);
const bOld = await rpc("eth_getBlockByNumber", ["0x" + (latest - 1000000).toString(16), false]);
console.log("block time: %s s/block", ((parseInt(bNow.timestamp, 16) - parseInt(bOld.timestamp, 16)) / 1000000).toFixed(3));
console.log("latest block time (UTC):", new Date(parseInt(bNow.timestamp, 16) * 1000).toISOString());

async function call(to, data) { return rpc("eth_call", [{ to, data }, "latest"]); }
for (const [name, addr] of [["USDG", "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"], ["WETH", "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"], ["STOA", "0x13E6993417616De724F2b337D65063f229e96718"]]) {
  const sym = await call(addr, "0x95d89b41");
  const dec = await call(addr, "0x313ce567");
  const raw = Buffer.from(sym.slice(2), "hex");
  const len = parseInt(raw.subarray(32, 64).toString("hex"), 16);
  console.log(name, addr, "symbol:", raw.subarray(64, 64 + len).toString(), "decimals:", parseInt(dec, 16));
}

// recent Routed logs, last 10000 blocks
const logs = await rpc("eth_getLogs", [{ fromBlock: "0x" + (latest - 10000).toString(16), toBlock: "latest", address: ROUTER, topics: [TOPIC0] }]);
console.log("Routed events in last 10000 blocks:", logs.length);
if (logs.length) {
  const l = logs[0];
  console.log("sample: block", parseInt(l.blockNumber, 16), "tx", l.transactionHash);
  console.log("topics[1] sender:", l.topics[1]);
  console.log("data words:", (l.data.length - 2) / 64);
}

// CoinGecko ETH price
const cg = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", { headers: { "User-Agent": UA["User-Agent"] } });
console.log("CoinGecko ETH/USD:", JSON.stringify(await cg.json()));

// Stoa quote API (read-only): ETH -> USDG, 0.01 ETH
const q = await fetch("https://stoadex.com/api/v1/quote?chain=robinhood&sellToken=native&buyToken=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168&amount=10000000000000000&slippageBps=50&taker=0x4e1460e9b71686c7fC437C43028d286AA625d36E&referrer=0x4e1460e9b71686c7fC437C43028d286AA625d36E", { headers: { "User-Agent": UA["User-Agent"] } });
const qj = await q.json();
console.log("Stoa quote status:", q.status, "| keys:", Object.keys(qj).join(","));
console.log("quote tx.to:", qj.tx && qj.tx.to, "| amountOut:", qj.amountOut, "| route:", JSON.stringify(qj.route));

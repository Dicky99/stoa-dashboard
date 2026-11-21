const RPC = "https://rpc.mainnet.chain.robinhood.com";
const UA = { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" };
async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: UA, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}
const ROUTER = "0x2F2804fad735a38015650f32f95Ad5E08D6B3eE5";
const TOPIC0 = "0x2bbce25631e8fa58085b7ea5929726c3acdf2df8d6b1f099eb32fb7425a4f6da";
const latest = parseInt(await rpc("eth_blockNumber", []), 16);
console.log("latest:", latest);
for (const span of [100000, 1000000]) {
  const t0 = Date.now();
  try {
    const logs = await rpc("eth_getLogs", [{ fromBlock: "0x" + (latest - span).toString(16), toBlock: "latest", address: ROUTER, topics: [TOPIC0] }]);
    console.log(`span ${span} blocks (~${(span * 0.104 / 3600).toFixed(1)}h): ${logs.length} Routed events in ${Date.now() - t0}ms`);
    if (logs.length) {
      const first = logs[0], last = logs[logs.length - 1];
      console.log("  first block:", parseInt(first.blockNumber, 16), "tx:", first.transactionHash);
      console.log("  last  block:", parseInt(last.blockNumber, 16), "tx:", last.transactionHash);
    }
  } catch (e) { console.log(`span ${span}: ERROR ${e.message}`); }
}

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
// timestamp of first known event block
const b = await rpc("eth_getBlockByNumber", ["0x" + (114378637).toString(16), false]);
console.log("first event block 114378637 time (UTC):", new Date(parseInt(b.timestamp, 16) * 1000).toISOString());
// scan further back: blocks 59,492,423 .. 89,492,423 in 5M chunks
let total = 0;
for (let end = 89492423; end > 59492423; end -= 5000000) {
  const from = end - 5000000 + 1;
  const logs = await rpc("eth_getLogs", [{ fromBlock: "0x" + from.toString(16), toBlock: "0x" + end.toString(16), address: ROUTER, topics: [TOPIC0] }]);
  console.log(`blocks ${from}..${end}: ${logs.length} events`);
  total += logs.length;
}
console.log("events before block 89,492,423:", total);

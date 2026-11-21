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
const CHUNK = 1000000, SPAN = 30000000;
let all = [];
for (let end = latest; end > latest - SPAN; end -= CHUNK) {
  const from = Math.max(end - CHUNK + 1, latest - SPAN);
  const logs = await rpc("eth_getLogs", [{ fromBlock: "0x" + from.toString(16), toBlock: "0x" + end.toString(16), address: ROUTER, topics: [TOPIC0] }]);
  console.log(`blocks ${from}..${end}: ${logs.length} events`);
  all.push(...logs);
}
console.log("TOTAL events in last 30M blocks (~36d):", all.length);
if (all.length) {
  const l = all[0];
  console.log("sample topics:", l.topics.length, "| data bytes:", (l.data.length - 2) / 2);
  console.log("first event block:", parseInt(all[all.length-1].blockNumber, 16), "tx:", all[all.length-1].transactionHash);
  console.log("last event block:", parseInt(all[0].blockNumber, 16), "tx:", all[0].transactionHash);
}
import { writeFileSync } from "fs";
writeFileSync("events-scan.json", JSON.stringify(all));

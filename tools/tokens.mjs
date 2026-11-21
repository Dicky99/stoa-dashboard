const RPC = "https://rpc.mainnet.chain.robinhood.com";
const UA = { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" };
async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: UA, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}
async function call(to, data) { return rpc("eth_call", [{ to, data }, "latest"]); }
for (const addr of [
  "0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea",
  "0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3",
  "0x1dd577f4c1b9a201cb099af9af74dcac012395c9",
  "0x51250b135174ca09450ec01c4aff73cf69dbb590",
]) {
  try {
    const sym = await call(addr, "0x95d89b41");
    const dec = await call(addr, "0x313ce567");
    const raw = Buffer.from(sym.slice(2), "hex");
    const len = parseInt(raw.subarray(32, 64).toString("hex"), 16);
    console.log(addr, "->", raw.subarray(64, 64 + len).toString(), "| decimals:", parseInt(dec, 16));
  } catch (e) { console.log(addr, "-> ERROR", e.message); }
}
// also: is the top venue 0x8965... a contract? get its code size
const code = await rpc("eth_getCode", ["0x8965140fb51b2e99a0cd31a0e99eae01d36517b8", "latest"]);
console.log("venue 0x8965 code bytes:", (code.length - 2) / 2);

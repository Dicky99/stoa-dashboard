// Stoa Swaps dashboard — Robinhood Chain (4663)
// Reads the StoaRouter `Routed` events straight from a public JSON-RPC endpoint.
// No build step, no keys, no server, no tracking.
"use strict";

const ROUTER = "0x2F2804fad735a38015650f32f95Ad5E08D6B3eE5";
const TOPIC0 = "0x2bbce25631e8fa58085b7ea5929726c3acdf2df8d6b1f099eb32fb7425a4f6da"; // keccak256("Routed(address,address,address,address,address,uint256,uint256,address,address,address)")
const FIRST_BLOCK = 114378637; // first Routed event, 2026-11-14T19:00:34Z (verified on-chain)
const REFERRER = "0x4e1460e9b71686c7fC437C43028d286AA625d36E";
const RPCS = ["https://rpc.mainnet.chain.robinhood.com", "https://robinhood.drpc.org"];
const CHUNK = 1000000;          // blocks per eth_getLogs call (verified: 1M-block ranges answer in ~200ms)
const BATCH = 6;                // parallel log requests
const BLOCKS_PER_DAY = 830769;  // measured block time ~0.104 s on 2026-11-21
const ZERO = "0x0000000000000000000000000000000000000000";
const EXPLORER = "https://robinhoodchain.blockscout.com";

const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168"; // 6 decimals, $1
const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
const STOA_OFFICIAL = "0x13e6993417616de724f2b337d65063f229e96718";

// Tokens resolved on-chain 2026-11-21 via symbol()/decimals().
// NOTE: two different tokens both call themselves "STOA" (0x13e6… official $STOA,
// 0x1dd5… a separate token). The UI disambiguates same-symbol tokens by address.
const KNOWN_TOKENS = {
  [ZERO]: { symbol: "ETH", decimals: 18, native: true },
  [USDG]: { symbol: "USDG", decimals: 6, usd: 1 },
  [WETH]: { symbol: "WETH", decimals: 18 },
  [STOA_OFFICIAL]: { symbol: "STOA", decimals: 18 },
  "0x1dd577f4c1b9a201cb099af9af74dcac012395c9": { symbol: "STOA", decimals: 18 },
  "0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea": { symbol: "SPCX", decimals: 18 },
  "0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3": { symbol: "GOOGL", decimals: 18 },
  "0x51250b135174ca09450ec01c4aff73cf69dbb590": { symbol: "NOVAAI", decimals: 18 },
};

// Venue names from Stoa's official contracts page (stoadex.com/docs/contracts).
// Unknown venues are shown as a truncated address — never a guessed name.
const KNOWN_VENUES = {
  "0x28802ad6f9859d14dfc6226ea9a8b60686d3a2e6": "Uniswap V3",
  "0x8965140fb51b2e99a0cd31a0e99eae01d36517b8": "Uniswap V4",
  "0x27958279f95225b2a5517e7dd12b6fc0317e5c5d": "Uniswap V4 V2",
  "0x5c8537e7d755884326de0969ce7bdb14195f56be": "Uniswap V2",
  "0x1341db53ed69ce1def86bdbfc60d5fd92cf9004f": "Metric",
  "0xf0904b95d66f565de215cc7dc58b6054f72a9352": "Aero",
  "0x87b3b896beabdc421f9d9b0a3fd3dbbae1ddd568": "Ramses",
  "0x58c2c83b66088b57b9dd487ba1090992bc9eebe0": "Pons Curve",
};

const state = {
  window: "30d",
  events: [],          // decoded, ascending by block
  lastTip: 0,          // highest block scanned
  ethPrice: null,      // CoinGecko ETH/USD
  ethPriceAt: 0,
  rpcUsed: RPCS[0],
  timer: null,
};

const $ = (id) => document.getElementById(id);
const short = (a) => a ? a.slice(0, 6) + "…" + a.slice(-4) : "—";
const hex = (n) => "0x" + n.toString(16);
const fmtUSD = (v) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v) => v.toLocaleString("en-US");

function fmtAmount(raw, decimals) {
  const d = BigInt(10) ** BigInt(decimals);
  const whole = raw / d;
  const frac = raw % d;
  if (frac === 0n) return whole.toString();
  let f = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return whole.toString() + "." + f.slice(0, 6);
}

// ---------- RPC ----------
async function rpc(method, params, rpcUrl) {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(method + ": " + (j.error.message || JSON.stringify(j.error)));
  return j.result;
}
// Try each RPC in turn; remember which one worked.
async function rpcAny(method, params) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const res = await rpc(method, params, url);
      state.rpcUsed = url;
      return res;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("all RPCs failed");
}

async function fetchLogs(from, to) {
  return rpcAny("eth_getLogs", [{ fromBlock: hex(from), toBlock: hex(to), address: ROUTER, topics: [TOPIC0] }]);
}

async function fetchWindow(from, to) {
  const ranges = [];
  for (let s = from; s <= to; s += CHUNK) ranges.push([s, Math.min(s + CHUNK - 1, to)]);
  const out = [];
  for (let i = 0; i < ranges.length; i += BATCH) {
    const batch = ranges.slice(i, i + BATCH);
    const res = await Promise.all(batch.map(([a, b]) => fetchLogs(a, b)));
    for (const logs of res) out.push(...logs);
  }
  return out;
}

// ---------- decoding ----------
function decodeLog(l) {
  const w = (i) => l.data.slice(2 + i * 64, 2 + (i + 1) * 64);
  const a = (word) => "0x" + word.slice(24);
  return {
    block: parseInt(l.blockNumber, 16),
    tx: l.transactionHash,
    sender: a(l.topics[1].slice(2)),
    to: a(l.topics[2].slice(2)),
    referrer: a(l.topics[3].slice(2)),
    tokenIn: a(w(0)),
    tokenOut: a(w(1)),
    amountIn: BigInt("0x" + w(2)),
    amountOut: BigInt("0x" + w(3)),
    mid: a(w(4)),
    venue1: a(w(5)),
    venue2: a(w(6)),
  };
}

// ---------- token metadata ----------
const tokenCache = { ...KNOWN_TOKENS };
async function tokenMeta(addr) {
  const key = addr.toLowerCase();
  if (tokenCache[key]) return tokenCache[key];
  try {
    const [sym, dec] = await Promise.all([
      rpcAny("eth_call", [{ to: addr, data: "0x95d89b41" }, "latest"]),
      rpcAny("eth_call", [{ to: addr, data: "0x313ce567" }, "latest"]),
    ]);
    // Decode the ABI-encoded string return without Buffer (browser-safe).
    const hexStr = sym.slice(2);
    const bytes = new Uint8Array(hexStr.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16);
    const len = Number(BigInt("0x" + [...bytes.subarray(32, 64)].map((b) => b.toString(16).padStart(2, "0")).join("")));
    const symbol = new TextDecoder().decode(bytes.subarray(64, 64 + len)) || short(addr);
    const meta = { symbol, decimals: parseInt(dec, 16) };
    tokenCache[key] = meta;
    return meta;
  } catch {
    const meta = { symbol: short(addr), decimals: 18, unknown: true };
    tokenCache[key] = meta;
    return meta;
  }
}
async function ensureTokenMetas(events) {
  const addrs = new Set();
  for (const e of events) { addrs.add(e.tokenIn.toLowerCase()); addrs.add(e.tokenOut.toLowerCase()); }
  await Promise.all([...addrs].map((a) => tokenMeta(a)));
}

function tokenLabel(addr) {
  const m = tokenCache[addr.toLowerCase()];
  if (!m) return short(addr);
  // Disambiguate tokens that share a symbol by showing an address hint.
  const clash = Object.values(tokenCache).filter((t) => t.symbol === m.symbol).length > 1;
  return clash ? m.symbol + " · " + addr.slice(2, 6) : m.symbol;
}
function venueLabel(addr) {
  if (addr === ZERO) return null;
  return KNOWN_VENUES[addr.toLowerCase()] || short(addr);
}

// ---------- USD ----------
function usdValue(e) {
  if (e.tokenIn.toLowerCase() === USDG) return Number(e.amountIn) / 1e6;
  if (e.tokenOut.toLowerCase() === USDG) return Number(e.amountOut) / 1e6;
  if (state.ethPrice) {
    if (e.tokenIn === ZERO) return Number(e.amountIn) / 1e18 * state.ethPrice;
    if (e.tokenOut === ZERO) return Number(e.amountOut) / 1e18 * state.ethPrice;
    if (e.tokenIn.toLowerCase() === WETH) return Number(e.amountIn) / 1e18 * state.ethPrice;
    if (e.tokenOut.toLowerCase() === WETH) return Number(e.amountOut) / 1e18 * state.ethPrice;
  }
  return null; // no USDG/ETH leg — USD unknown, shown in native amounts only
}

async function refreshEthPrice() {
  if (Date.now() - state.ethPriceAt < 300000 && state.ethPrice) return;
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const j = await r.json();
    if (j.ethereum && j.ethereum.usd) { state.ethPrice = j.ethereum.usd; state.ethPriceAt = Date.now(); }
  } catch { /* keep last price; ETH-leg USD stays unknown if never fetched */ }
}

// ---------- aggregation ----------
function aggregate(events) {
  const traders = new Set();
  const venues = new Map(); // label -> {swaps, usd}
  const pairs = new Map();   // "in -> out" -> {swaps, usd, usdKnown}
  let usdTotal = 0, usdKnown = 0;
  for (const e of events) {
    traders.add(e.sender.toLowerCase());
    const usd = usdValue(e);
    if (usd !== null) { usdTotal += usd; usdKnown++; }
    const vset = new Set([e.venue1, e.venue2].filter((v) => v !== ZERO).map((v) => v.toLowerCase()));
    for (const v of vset) {
      const cur = venues.get(v) || { swaps: 0, usd: 0 };
      cur.swaps++;
      if (usd !== null) cur.usd += usd;
      venues.set(v, cur);
    }
    const pk = e.tokenIn.toLowerCase() + "->" + e.tokenOut.toLowerCase();
    const p = pairs.get(pk) || { swaps: 0, usd: 0, usdKnown: 0, tokenIn: e.tokenIn, tokenOut: e.tokenOut };
    p.swaps++;
    if (usd !== null) { p.usd += usd; p.usdKnown++; }
    pairs.set(pk, p);
  }
  return { traders: traders.size, venues, pairs, usdTotal, usdKnown };
}

// ---------- rendering ----------
function renderStats(agg, events) {
  $("statVolume").textContent = fmtUSD(agg.usdTotal);
  $("statVolumeNote").textContent = agg.usdKnown + " of " + events.length + " swaps have a known USD value"
    + (state.ethPrice ? " · ETH $" + state.ethPrice.toLocaleString("en-US") : " · ETH price unavailable");
  $("statSwaps").textContent = fmtInt(events.length);
  $("statSwapsNote").textContent = state.window === "all"
    ? "since first swap, 2026-11-14"
    : "in the selected window";
  $("statTraders").textContent = fmtInt(agg.traders);
  $("statAvg").textContent = agg.usdKnown ? fmtUSD(agg.usdTotal / agg.usdKnown) : "—";
}

function renderVenues(agg, events) {
  const el = $("venueList");
  if (!events.length) { el.innerHTML = "<p class='muted'>No swaps in this window yet.</p>"; return; }
  const rows = [...agg.venues.entries()]
    .map(([addr, v]) => ({ addr, label: venueLabel(addr), ...v }))
    .sort((a, b) => b.swaps - a.swaps);
  const max = rows[0].swaps;
  el.innerHTML = rows.map((r) => {
    const pct = ((r.swaps / events.length) * 100).toFixed(1);
    return "<div class='venue-row'><div>" + escapeHtml(r.label) +
      "<div class='sub2'>" + short(r.addr) + " · " + fmtUSD(r.usd) + "</div></div>" +
      "<div class='bar'><div style='width:" + (r.swaps / max * 100).toFixed(1) + "%'></div></div>" +
      "<div class='cnt'>" + r.swaps + " <span class='muted'>(" + pct + "%)</span></div></div>";
  }).join("");
}

function renderPairs(agg) {
  const tb = $("pairTable").querySelector("tbody");
  const rows = [...agg.pairs.values()].sort((a, b) => b.swaps - a.swaps).slice(0, 10);
  if (!rows.length) { tb.innerHTML = "<tr><td colspan='3'>No swaps in this window yet.</td></tr>"; return; }
  tb.innerHTML = rows.map((p) =>
    "<tr><td title='" + p.tokenIn + " → " + p.tokenOut + "'>" +
    escapeHtml(tokenLabel(p.tokenIn)) + " → " + escapeHtml(tokenLabel(p.tokenOut)) + "</td>" +
    "<td class='num'>" + p.swaps + "</td><td class='num'>" + (p.usdKnown ? fmtUSD(p.usd) : "—") + "</td></tr>"
  ).join("");
}

function renderSwaps(events) {
  const tb = $("swapTable").querySelector("tbody");
  const rows = [...events].sort((a, b) => b.block - a.block).slice(0, 25);
  if (!rows.length) { tb.innerHTML = "<tr><td colspan='6'>No swaps in this window yet.</td></tr>"; return; }
  tb.innerHTML = rows.map((e) => {
    const mi = tokenCache[e.tokenIn.toLowerCase()] || { symbol: short(e.tokenIn), decimals: 18 };
    const mo = tokenCache[e.tokenOut.toLowerCase()] || { symbol: short(e.tokenOut), decimals: 18 };
    const venues = [e.venue1, e.venue2].filter((v) => v !== ZERO).map(venueLabel).filter(Boolean);
    const uniq = [...new Set(venues)];
    return "<tr><td>" + (e.time ? new Date(e.time * 1000).toISOString().slice(0, 19).replace("T", " ") : "block " + e.block) + "</td>" +
      "<td><a href='" + EXPLORER + "/address/" + e.sender + "' target='_blank' rel='noopener'>" + short(e.sender) + "</a></td>" +
      "<td>" + escapeHtml(tokenLabel(e.tokenIn)) + " → " + escapeHtml(tokenLabel(e.tokenOut)) + "</td>" +
      "<td>" + fmtAmount(e.amountIn, mi.decimals) + " " + escapeHtml(mi.symbol) + " → " +
      fmtAmount(e.amountOut, mo.decimals) + " " + escapeHtml(mo.symbol) + "</td>" +
      "<td>" + uniq.map(escapeHtml).join(", ") + "</td>" +
      "<td><a href='" + EXPLORER + "/tx/" + e.tx + "' target='_blank' rel='noopener'>" + e.tx.slice(0, 10) + "…</a></td></tr>";
  }).join("");
}

async function fillTimes(events) {
  // Attach a UTC timestamp to each event by reading its block header (batched).
  // Activity is tiny; cap at 300 distinct blocks, beyond that estimate dates
  // from block time (0.104 s/block, measured 2026-11-21).
  const blocks = [...new Set(events.map((e) => e.block))].sort((a, b) => a - b);
  if (!blocks.length) return;
  const latestBlock = Math.max(...blocks);
  let latestTime = null;
  try { latestTime = parseInt((await rpcAny("eth_getBlockByNumber", [hex(latestBlock), false])).timestamp, 16); } catch { /* ignore */ }
  const times = new Map();
  if (blocks.length <= 300) {
    for (let i = 0; i < blocks.length; i += 10) {
      const batch = blocks.slice(i, i + 10);
      const res = await Promise.all(batch.map((b) =>
        rpcAny("eth_getBlockByNumber", [hex(b), false]).catch(() => null)));
      res.forEach((blk, j) => { if (blk) times.set(batch[j], parseInt(blk.timestamp, 16)); });
    }
  }
  for (const e of events) {
    let t = times.get(e.block);
    if (!t && latestTime) t = latestTime - Math.round((latestBlock - e.block) * 0.104);
    if (t) e.time = t;
  }
}

function renderChart(events) {
  const el = $("dailyChart");
  if (!events.length) { el.innerHTML = "<p class='muted'>No swaps in this window yet.</p>"; return; }
  const byDay = new Map();
  for (const e of events) {
    if (!e.time) continue;
    const day = new Date(e.time * 1000).toISOString().slice(0, 10);
    const usd = usdValue(e);
    const cur = byDay.get(day) || { usd: 0, swaps: 0 };
    if (usd !== null) cur.usd += usd;
    cur.swaps++;
    byDay.set(day, cur);
  }
  const days = [...byDay.entries()].sort().slice(-14);
  if (!days.length) { el.innerHTML = "<p class='muted'>No dated swaps in this window yet.</p>"; return; }
  const max = Math.max(...days.map(([, d]) => d.usd), 0.01);
  el.innerHTML = days.map(([day, d]) =>
    "<div class='col'><div class='val'>" + (d.usd ? "$" + d.usd.toFixed(0) : "—") + "</div>" +
    "<div class='bar' style='height:" + Math.max(2, (d.usd / max) * 110).toFixed(0) + "px'></div>" +
    "<div class='cap' title='" + day + " · " + d.swaps + " swaps'>" + day.slice(5) + "</div></div>"
  ).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function setStatus(msg) { $("statusLine").textContent = "Status: " + msg; }
function showError(msg) {
  const box = $("errorBox");
  box.textContent = msg;
  box.classList.remove("hidden");
}
function clearError() { $("errorBox").classList.add("hidden"); $("errorBox").textContent = ""; }

// ---------- load / refresh ----------
function windowStart(latest) {
  if (state.window === "all") return FIRST_BLOCK;
  const days = { "24h": 1, "7d": 7, "30d": 30 }[state.window];
  return Math.max(FIRST_BLOCK, latest - days * BLOCKS_PER_DAY);
}

async function loadAll() {
  $("liveBadge").textContent = "● loading…";
  $("liveBadge").classList.remove("down");
  clearError();
  try {
    await refreshEthPrice();
    const latest = parseInt(await rpcAny("eth_blockNumber", []), 16);
    const from = windowStart(latest);
    const logs = await fetchWindow(from, latest);
    state.events = logs.map(decodeLog).sort((a, b) => a.block - b.block);
    state.lastTip = latest;
    await ensureTokenMetas(state.events);
    await render();
    $("liveBadge").textContent = "● live";
    $("updatedAt").textContent = "updated " + new Date().toISOString().slice(11, 19) + " UTC · block " + fmtInt(latest);
    setStatus("RPC " + state.rpcUsed + " · scanned blocks " + fmtInt(from) + "–" + fmtInt(latest) +
      " (" + fmtInt(state.events.length) + " Routed events) · ETH $" + (state.ethPrice ? state.ethPrice.toLocaleString("en-US") : "n/a"));
  } catch (e) {
    $("liveBadge").textContent = "● data failed";
    $("liveBadge").classList.add("down");
    showError("Could not load on-chain data: " + e.message + ". Check your connection and press Refresh — the page reads the chain directly, no server is involved.");
    setStatus("load failed: " + e.message);
  }
}

async function refreshTail() {
  try {
    const latest = parseInt(await rpcAny("eth_blockNumber", []), 16);
    if (latest <= state.lastTip) return;
    const logs = await fetchWindow(state.lastTip + 1, latest);
    if (!logs.length) { state.lastTip = latest; return; }
    const fresh = logs.map(decodeLog);
    state.events = [...state.events, ...fresh].sort((a, b) => a.block - b.block);
    state.lastTip = latest;
    await ensureTokenMetas(fresh);
    await refreshEthPrice();
    await render();
    $("updatedAt").textContent = "updated " + new Date().toISOString().slice(11, 19) + " UTC · block " + fmtInt(latest);
  } catch (e) {
    setStatus("auto-refresh failed (will retry): " + e.message);
  }
}

async function render() {
  const agg = aggregate(state.events);
  renderStats(agg, state.events);
  renderVenues(agg, state.events);
  renderPairs(agg);
  await fillTimes(state.events);
  renderSwaps(state.events);
  renderChart(state.events);
}

// ---------- quote box ----------
async function onQuote(ev) {
  ev.preventDefault();
  const out = $("quoteOut");
  const sell = $("sellToken").value;
  const buy = $("buyToken").value;
  const amount = parseFloat($("sellAmount").value);
  if (!amount || amount <= 0) { out.textContent = "Enter an amount greater than 0."; return; }
  if (sell.toLowerCase() === buy.toLowerCase()) { out.textContent = "Sell and buy tokens must differ."; return; }
  out.textContent = "Fetching quote from Stoa…";
  try {
    const sellMeta = sell === "native" ? { decimals: 18, symbol: "ETH" } : await tokenMeta(sell);
    const buyMeta = buy === "native" ? { decimals: 18, symbol: "ETH" } : await tokenMeta(buy);
    const amountStr = amountToBase(amount, sellMeta.decimals);
    const params = new URLSearchParams({
      chain: "robinhood",
      sellToken: sell === "native" ? "native" : sell,
      buyToken: buy === "native" ? "native" : buy,
      amount: amountStr,
      slippageBps: "50",
      taker: REFERRER,
      referrer: REFERRER,
    });
    const r = await fetch("https://stoadex.com/api/v1/quote?" + params.toString());
    const j = await r.json();
    if (j.error || !j.tx) { out.textContent = "Quote failed: " + (j.error || JSON.stringify(j).slice(0, 200)); return; }
    const legs = (j.route && j.route.legs ? j.route.legs : []).map((leg) =>
      (leg.name || venueLabel(leg.venue) || short(leg.venue))).join(" → ");
    out.innerHTML =
      "<strong>" + escapeHtml(fmtAmount(BigInt(j.amountOut), buyMeta.decimals)) + " " + escapeHtml(buyMeta.symbol) + "</strong>" +
      " for " + escapeHtml(String(amount)) + " " + escapeHtml(sellMeta.symbol) +
      (j.priceImpactPct !== undefined ? " · price impact " + j.priceImpactPct + "%" : "") +
      (j.validForSeconds ? " · quote valid " + j.validForSeconds + "s" : "") +
      (legs ? "<div class='route'>Route: " + escapeHtml(legs) + "</div>" : "") +
      "<div class='route'>The unsigned swap transaction names <code>" + short(REFERRER) + "</code> as referrer. " +
      "<a href='https://stoadex.com/trade?referrer=" + REFERRER + "' target='_blank' rel='noopener'>Continue on Stoa ↗</a> to sign it in your own wallet.</div>";
  } catch (e) {
    out.textContent = "Quote failed: " + e.message;
  }
}

function amountToBase(amount, decimals) {
  // Convert a decimal amount string to exact base units (avoids float error).
  const s = String(amount);
  const [whole, frac = ""] = s.split(".");
  const f = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (BigInt(whole || "0") * BigInt(10) ** BigInt(decimals) + BigInt(f || "0")).toString();
}

// ---------- boot ----------
document.querySelectorAll(".windows button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".windows button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    state.window = b.dataset.window;
    loadAll();
  });
});
$("refreshBtn").addEventListener("click", loadAll);
$("quoteForm").addEventListener("submit", onQuote);
loadAll();
state.timer = setInterval(refreshTail, 60000);

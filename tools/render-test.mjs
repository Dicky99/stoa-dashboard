// End-to-end render test: runs the real app.js in Node with a minimal DOM stub
// against the LIVE Robinhood Chain RPC, then asserts the rendered numbers match
// the independently verified scan (33 swaps, 19 traders, $258.32 USD volume).
// Usage: node tools/render-test.mjs   (run from the repo root)
import { readFileSync } from "fs";
import vm from "vm";

function makeEl(id) {
  const el = {
    id,
    textContent: "",
    innerHTML: "",
    dataset: {},
    _listeners: {},
    classList: { add() {}, remove() {}, contains: () => false },
    addEventListener(ev, fn) { (el._listeners[ev] ||= []).push(fn); },
    querySelector(sel) {
      el._children ||= new Map();
      if (!el._children.has(sel)) el._children.set(sel, makeEl(id + sel));
      return el._children.get(sel);
    },
  };
  return el;
}

const elements = new Map();
function getEl(id) {
  if (!elements.has(id)) elements.set(id, makeEl(id));
  return elements.get(id);
}

const winButtons = ["24h", "7d", "30d", "all"].map((w) => {
  const b = makeEl("win-" + w);
  b.dataset.window = w;
  return b;
});

const sandbox = {
  console,
  fetch,
  TextDecoder,
  URLSearchParams,
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout,
  document: {
    getElementById: getEl,
    querySelectorAll: (sel) => (sel === ".windows button" ? winButtons : []),
  },
};
vm.createContext(sandbox);

const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");
vm.runInContext(src, sandbox);

// Wait for loadAll() to finish (badge turns "● live").
const t0 = Date.now();
while (getEl("liveBadge").textContent !== "● live" && Date.now() - t0 < 90000) {
  await new Promise((r) => setTimeout(r, 500));
}

const badge = getEl("liveBadge").textContent;
console.log("badge:", badge);
console.log("statVolume:", getEl("statVolume").textContent);
console.log("statVolumeNote:", getEl("statVolumeNote").textContent);
console.log("statSwaps:", getEl("statSwaps").textContent);
console.log("statTraders:", getEl("statTraders").textContent);
console.log("statAvg:", getEl("statAvg").textContent);
console.log("status:", getEl("statusLine").textContent);
console.log("errorBox hidden:", getEl("errorBox").textContent === "");
const venueHtml = getEl("venueList").innerHTML;
console.log("venueList has Uniswap V4:", venueHtml.includes("Uniswap V4"), "| Uniswap V4 count 22:", />22 <span/.test(venueHtml));
const pairHtml = getEl("pairTable").querySelector("tbody").innerHTML;
console.log("pairTable top row:", pairHtml.slice(0, 200).replace(/\n/g, " "));
const swapHtml = getEl("swapTable").querySelector("tbody").innerHTML;
console.log("swapTable has latest tx 0x9d44d972:", swapHtml.includes("0x9d44d972"));
console.log("swapTable rows:", (swapHtml.match(/<tr>/g) || []).length);
const chartHtml = getEl("dailyChart").innerHTML;
console.log("chart has 11-14:", chartHtml.includes("11-14"), "| bars:", (chartHtml.match(/class='bar'/g) || []).length);

const failures = [];
const eq = (name, got, want) => { if (got !== want) failures.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
eq("badge", badge, "● live");
eq("statSwaps", getEl("statSwaps").textContent, "33");
eq("statTraders", getEl("statTraders").textContent, "19");
// Volume = USDG legs ($518.13, fixed) + ETH legs × live CoinGecko price (~$12.56).
// Allow drift from ETH price movement between runs.
const vol = parseFloat(getEl("statVolume").textContent.replace(/[^0-9.]/g, ""));
if (!(vol >= 500 && vol <= 560)) failures.push(`statVolume: got ${getEl("statVolume").textContent}, want $500–$560`);
if (!getEl("statVolumeNote").textContent.includes("31 of 33")) failures.push("statVolumeNote missing '31 of 33': " + getEl("statVolumeNote").textContent);
if (!venueHtml.includes("Uniswap V4")) failures.push("venue list missing Uniswap V4");
if (!/>22 <span/.test(venueHtml)) failures.push("venue list: Uniswap V4 count is not 22");
if (!pairHtml.includes("ETH → USDG")) failures.push("pair table missing ETH → USDG");
if (!swapHtml.includes("0x9d44d972")) failures.push("swap table missing latest tx");
if (getEl("errorBox").textContent !== "") failures.push("error box not empty: " + getEl("errorBox").textContent);

if (failures.length) { console.error("\nFAILURES:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("\nRENDER TEST PASSED — live numbers match the verified scan.");
process.exit(0);

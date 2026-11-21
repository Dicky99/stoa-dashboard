# Stoa Swaps — Robinhood Chain Dashboard

Live public dashboard of swaps routed through the **Stoa router on Robinhood Chain** (chain ID 4663): total volume, swap count, unique traders, top pairs, routes per venue, a daily volume chart, and a recent-swaps table — plus a live quote box.

Every number on the page is read from the chain at load time. No build step, no server, no API key, no tracking. Static HTML/CSS/JS, deployable to GitHub Pages as-is.

**Bounty:** Stoa build bounty #3 — “Public dashboard” ($50 in USDG on Robinhood Chain, first working entry; open until 20 Dec 2026, 23:59 UTC). One entry per person; code must be open on GitHub and the dashboard live and public.

## Live numbers (verified 2026-11-21)

Read from the chain while building this repo (window: last 30M blocks, ≈ 36 days — covers all activity to date):

| Metric | Value |
|---|---|
| Swaps (all time) | **33** |
| Unique traders | **19** |
| Total volume (USD, known-value swaps) | **$530.69** (31 of 33 swaps have a known USD value) |
| Top venue | **Uniswap V4** (first adapter) — 22 swaps |
| 2nd venue | **Uniswap V3** — 11 swaps |
| First swap | block 114,378,637 — 2026-11-14 19:00:34 UTC |
| Most recent swap (at build time) | block 119,392,232 — tx `0x9d44d972…` (confirmed `success` on Blockscout) |

Volume is small because the router is young (first swap 14 Nov 2026). The dashboard shows the real numbers, however small — nothing is invented or inflated.

## Data sources & exact queries

**Contract:** StoaRouter on Robinhood Chain — `0x2F2804fad735a38015650f32f95Ad5E08D6B3eE5` (published in truncated form `0x2F28…3eE5` on [stoadex.com/build](https://stoadex.com/build#bounties); full address taken from the same page's HTML and confirmed independently: Stoa's quote API returns `tx.to` = this address).

**Event:** `Routed(address sender, address to, address referrer, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, address mid, address venue1, address venue2)` — `sender`/`to`/`referrer` indexed, the rest in `data` (7 words).

```
topic0 = keccak256("Routed(address,address,address,address,address,uint256,uint256,address,address,address)")
       = 0x2bbce25631e8fa58085b7ea5929726c3acdf2df8d6b1f099eb32fb7425a4f6da
```

**Query (shared, reproducible):**

```json
POST https://rpc.mainnet.chain.robinhood.com
{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{
  "fromBlock": "0x<start>", "toBlock": "latest",
  "address": "0x2F2804fad735a38015650f32f95Ad5E08D6B3eE5",
  "topics": ["0x2bbce25631e8fa58085b7ea5929726c3acdf2df8d6b1f099eb32fb7425a4f6da"]
}]}
```

- **Block-range strategy:** 1,000,000-block chunks, 6 in parallel. A 1M-block range answers in ~200 ms. Windows: 24h ≈ 830,769 blocks, 7d ≈ 5.8M, 30d ≈ 24.9M, “All time” starts at block 114,378,637 (first `Routed` event; verified: zero `Routed` events in blocks 59,492,423–89,492,423 and 89,492,423–114,378,637).
- **RPCs:** primary `https://rpc.mainnet.chain.robinhood.com`, fallback `https://robinhood.drpc.org`. Both return `Access-Control-Allow-Origin: *`, so the page reads the chain directly from the visitor's browser. Chain ID verified live: `0x1237` = 4663. Block time ≈ 0.104 s/block (measured 2026-11-21).
- **Auto-refresh:** every 60 s the page fetches only new blocks since the last scanned tip and merges them in.
- **Daily chart:** one `eth_getBlockByNumber` per distinct event block (batched, capped at 300 blocks; beyond that, dates are estimated from block time and the chart says so).
- **ETH price:** CoinGecko free API, no key (`/simple/price?ids=ethereum&vs_currencies=usd`, CORS `*`).

**ABI:** `StoaRouter.json` (82 entries) is fetched from `https://stoadex.com/abi/StoaRouter.json` in `tools/` — the page itself needs only `topic0` and the event layout above.

## How USD volume is computed

- A swap's USD value comes from its **USDG leg** (USDG = $1, 6 decimals) when present, otherwise its **ETH/WETH leg × live CoinGecko ETH price**.
- Swaps with neither leg (e.g. STOA ↔ SPCX) have **no USD value** — they are counted in swap/trader totals but excluded from USD totals, and the dashboard says how many swaps have a known USD value.
- Token symbols/decimals are resolved on-chain via `symbol()`/`decimals()` (verified 2026-11-21). Unknown future tokens are resolved the same way at runtime, falling back to a truncated address.

## Tokens & venues seen so far

| Token | Address | Notes |
|---|---|---|
| ETH (native) | `0x0000…0000` | native coin |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | 6 dp, $1 |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | 18 dp |
| STOA | `0x13E6993417616De724F2b337D65063f229e96718` | official $STOA, 18 dp |
| STOA | `0x1dd577f4c1b9a201cb099af9af74dcac012395c9` | **different token, same symbol** — shown with an address hint |
| SPCX | `0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea` | 18 dp |
| GOOGL | `0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3` | Robinhood stock token, 18 dp |
| NOVAAI | `0x51250b135174ca09450ec01c4aff73cf69dbb590` | 18 dp |

Venue names come from [Stoa's official contracts page](https://stoadex.com/docs/contracts) (addresses verified against that page):

| Venue | Address | Swaps (30d window, 2026-11-21) |
|---|---|---|
| Uniswap V4 (first adapter; removed from router 19 Nov 2026) | `0x8965140Fb51b2E99a0Cd31a0E99Eae01D36517B8` | 22 |
| Uniswap V3 | `0x28802Ad6F9859d14dfC6226eA9A8b60686D3A2E6` | 11 |
| Uniswap V4 V2 (in router since 19 Nov 2026) | `0x27958279F95225b2a5517E7DD12b6Fc0317E5c5d` | 2 |
| Pons Curve | `0x58c2C83b66088B57B9dd487Ba1090992Bc9eEbe0` | 2 |
| Aero | `0xF0904B95D66f565De215cC7dc58B6054F72A9352` | 1 |
| Ramses | `0x87b3B896beAbdC421F9d9B0A3FD3dBbAE1ddd568` | 1 |

A swap that uses two venues (via a `mid` token) counts once per venue. Unknown venues show a truncated address — never a guessed name.

## Referrer

The bounty requires every swap the entry sends to name the builder's address as `referrer`. This dashboard wires that in two ways:

1. **Quote box** (on the page): calls Stoa's HTTP API `GET /api/v1/quote?chain=robinhood&…&referrer=0x4e1460e9b71686c7fC437C43028d286AA625d36E`. Verified live 2026-11-21: the returned unsigned swap transaction's calldata ends with `…004e1460e9b71686c7fc437c43028d286aa625d36e` — the referrer is embedded in the swap itself. The box is read-only (no wallet connection, no signing).
2. **“Swap on Stoa” button**: opens `https://stoadex.com/trade?referrer=0x4e1460e9b71686c7fC437C43028d286AA625d36E`. Note: Stoa's trade UI builds every swap with a `referrer` field (confirmed in its shipped JS), but whether it reads the `referrer` query parameter was **not** verified — the quote box above is the verified path.

Referrer address: `0x4e1460e9b71686c7fC437C43028d286AA625d36E`.

## Deploy to GitHub Pages (3 steps)

No build step — the repo is the site.

**Option A — web UI (no git needed):**
1. Create a new public repo (e.g. `stoa-dashboard`) on GitHub and upload `index.html`, `style.css`, `app.js`, `README.md`, `LICENSE`, `.nojekyll`.
2. Repo → Settings → Pages → Source: “Deploy from a branch”, branch `main`, folder `/ (root)` → Save.
3. Open the published URL (shown on the Pages settings page, `https://<you>.github.io/stoa-dashboard/`).

**Option B — command line:**

```bash
git init && git add index.html style.css app.js README.md LICENSE .nojekyll
git commit -m "Stoa swaps dashboard — Robinhood Chain (bounty #3)"
git branch -M main
git remote add origin https://github.com/<you>/stoa-dashboard.git
git push -u origin main
# then enable Pages as in step 2 above (Settings → Pages → main / root)
```

## Bounty submission

- Live URL: `https://<you>.github.io/stoa-dashboard/` *(fill in after deploying)*
- Repo URL: `https://github.com/<you>/stoa-dashboard` *(fill in after publishing)*
- Submit on GitHub as Stoa's bounty page instructs ([stoadex.com/build#bounties](https://stoadex.com/build#bounties)). Stoa checks each entry before paying; one bounty per person; no wash trading (this entry sends no swaps itself and inflates nothing — it only reads).

## Files

- `index.html` — page structure
- `style.css` — dark theme, Stoa-blue accent, mobile-readable
- `app.js` — all data fetching, decoding, aggregation, rendering, quote box
- `tools/` — the verification scripts used while building (RPC checks, event scan/decode, token resolution, render test). Run `node tools/render-test.mjs` to re-verify the live numbers end-to-end.
- `README.md`, `LICENSE` (MIT), `.nojekyll`

## Known limitations

- Volume is genuinely tiny (33 swaps all-time at build time) — the dashboard reports that honestly rather than annualising or inflating it.
- ETH-leg USD uses the *current* CoinGecko price, not the historical price at swap time.
- The `?referrer=` deep link to Stoa's trade UI is best-effort (see Referrer above); the verified referrer path is the on-page quote box.
- If both public RPCs ever block browser requests, the page shows an error state instead of stale numbers.

Not affiliated with Stoa or Robinhood. Nothing here is investment advice.

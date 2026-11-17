// CBBTC range rider v2: a long-only, single-asset range bot for agent-fun/bars-replay/v1.
//
// Idea, in one paragraph: on the dev window one-minute cbBTC bars are mostly
// noise (about 6 bps of standard deviation per minute) while a full round trip
// costs about 26 bps in fee, slippage and price impact, so fast trend systems
// bleed out on whipsaws (the kit's EMA-cross baseline loses $106 here). But the
// day still swings about 1% on 4-6 hour timescales: it drifts down, rallies
// 2.5% from trough to peak, then fades. So this bot trades the range, not the
// noise: it buys only when the close sits within 40 bps of the lowest close of
// the last 480 bars (8 hours), and sells when the close reaches within 10 bps
// of the highest close of the same window, with a trailing stop and a hard stop
// as the exits of last resort. The 8-hour window matters: the day's trough and
// peak are 8 hours apart, so a 6-hour window kept re-anchoring mid-move and
// sold the rally early, while the 8-hour window holds through it. That is two
// round trips a day, each sized at full equity, each expected to clear the
// round-trip cost by a wide margin. It never shorts, never uses leverage,
// never reads the clock, the environment or Math.random, and every comparison
// is exact bigint arithmetic, so the same bars always give the same orders.
//
// Rules (all comparisons on closes; decisions on bar k fill at bar k+1's open):
//   - History: every close is kept; the rolling window is the last 480 closes.
//     Indicators are fed every batch, warm-up included; no order is sent while
//     warming up.
//   - Entry, when flat and at least 480 closes are known: the close is within
//     40 bps above the rolling 480-bar low, and at least 30 batches have passed
//     since the last exit. Buys with all cash (capped by max_weight_bps).
//   - Exit, the whole position: the close is within 10 bps below the rolling
//     480-bar high, or the close falls 100 bps under the highest close since
//     entry (trailing stop), or the position is worth 200 bps under its cost
//     (hard stop).
//   - Each order caps slippage at 100 bps past the close it was decided on, so
//     a sell into a gap is refused and retried rather than filled for nothing.

import { BPS, runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Rolling window for the range, in bars (480 minutes = 8 hours). */
const WINDOW_BARS = 480;
/** Buy when the close is within this many bps above the rolling low. */
const BUY_BAND_BPS = 40;
/** Sell when the close is within this many bps below the rolling high. */
const SELL_BAND_BPS = 10;
/** Batches to wait after an exit before the next entry. */
const COOLDOWN_BARS = 30;
/** Trailing stop: exit when the close falls this far under the peak since entry, in bps. */
const TRAIL_STOP_BPS = 100;
/** Hard stop: exit when the position is worth this far under its cost, in bps. */
const HARD_STOP_BPS = 200;
const MAX_SLIPPAGE_BPS = 100;

/** Closes by batch seq, newest last; null when a bar is missing. */
const closes: (bigint | null)[] = [];
/** Highest close since the current entry; null while flat. */
let peakSinceEntry: bigint | null = null;
/** Batch seq of the last exit; -1e9 so the first entry is never cooled down. */
let lastExitSeq = -1e9;

function rollingLow(): bigint | null {
  let lo: bigint | null = null;
  const start = closes.length > WINDOW_BARS ? closes.length - WINDOW_BARS : 0;
  for (let i = start; i < closes.length; i++) {
    const c = closes[i];
    if (c !== null && (lo === null || c < lo)) lo = c;
  }
  return lo;
}

function rollingHigh(): bigint | null {
  let hi: bigint | null = null;
  const start = closes.length > WINDOW_BARS ? closes.length - WINDOW_BARS : 0;
  for (let i = start; i < closes.length; i++) {
    const c = closes[i];
    if (c !== null && (hi === null || c > hi)) hi = c;
  }
  return hi;
}

await runBars({
  onBatch(state: BarsState, _batch) {
    const close = state.close(SYMBOL);
    closes.push(close);
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    const { caps, fees } = state.hello;

    if (held !== undefined) {
      if (close !== null) {
        if (peakSinceEntry === null || close > peakSinceEntry) peakSinceEntry = close;
      }
      const value = state.value(SYMBOL, held.qty);
      const atHigh =
        close !== null &&
        (() => {
          const hi = rollingHigh();
          return hi !== null && close * 10000n > hi * BigInt(10000 - SELL_BAND_BPS);
        })();
      const trailing =
        peakSinceEntry !== null && close !== null && close * 10000n < peakSinceEntry * BigInt(10000 - TRAIL_STOP_BPS);
      const hardStop = value * 10000n <= held.cost * BigInt(10000 - HARD_STOP_BPS);
      if (atHigh || trailing || hardStop) {
        lastExitSeq = state.seq;
        peakSinceEntry = null;
        const order: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [order];
      }
      return [];
    }

    peakSinceEntry = null;
    if (closes.length <= WINDOW_BARS) return [];
    if (state.seq - lastExitSeq < COOLDOWN_BARS) return [];
    if (close === null) return [];
    const lo = rollingLow();
    if (lo === null) return [];
    if (close * 10000n >= lo * BigInt(10000 + BUY_BAND_BPS)) return [];

    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    const slice = state.cash < byWeight ? state.cash : byWeight;
    if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) return [];
    const order: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [order];
  },
});

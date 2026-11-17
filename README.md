# cbbtc-race-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/Idnafaa/cbbtc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/Idnafaa/cbbtc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

CBBTC range rider: a long-only trading bot for Coinbase Wrapped BTC that buys near the 8-hour range low and sells near the range high, with a trailing stop and a hard stop. It trades one-minute bars of cbBTC/USDC from the Orca Whirlpool, starts with $1,000 of paper money, and made +$28.03 on the 24-hour dev window (v2: 480-bar window, 40 bps buy band, 10 bps sell band; v1 with a 360-bar window made +$12.38).

## Run it

```sh
node cli/makefun.mjs grade-local --kit ../btc-race-24h-20261117-0603-kit --bot . --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=01tnmm85&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>

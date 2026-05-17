# iqoptionapi-node

TypeScript SDK for the IQOption WebSocket API — unofficial, reverse-engineered.

[![CI](https://github.com/TupythonDev/iqoptionapi-node/actions/workflows/ci.yml/badge.svg)](https://github.com/TupythonDev/iqoptionapi-node/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/iqoptionapi-node)](https://www.npmjs.com/package/iqoptionapi-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Warning:** This is an unofficial SDK that reverse-engineers a proprietary protocol. It may break without notice when IQOption updates their API.

## Features

- Typed, promise-based API (TypeScript strict mode)
- Authentication via email/password or SSID session restore
- Real-time candle and tick streaming with auto-reconnect
- Historical candles
- Binary and digital options trading
- Circuit breaker on trading (suspends after 5 consecutive failures)
- PRACTICE account by default — REAL requires explicit opt-in
- WSS enforced — no insecure connections

## Installation

```bash
npm install iqoptionapi-node
```

Requires **Node.js ≥ 18**.

## Quick Start

```typescript
import { IQOptionClient, Direction, TimeFrame } from 'iqoptionapi-node';

const client = new IQOptionClient();
await client.connect();

const profile = await client.login({ email: 'you@example.com', password: 'secret' });
console.log(`Balance: ${profile.balance} ${profile.currency}`);

// Fetch candles
const candles = await client.getCandles('EURUSD', TimeFrame.M1, 10);

// Place a binary option (PRACTICE account)
const { orderId } = await client.buyBinaryOption({
  symbol: 'EURUSD',
  direction: Direction.Call,
  amount: 1,
  durationSeconds: 60,
});

const result = await client.checkBinaryOptionResult(orderId, 70_000);
console.log(result.win, result.profitAmount);

await client.disconnect();
```

## API

### `new IQOptionClient(options?)`

| Option                | Type      | Default          | Description               |
| --------------------- | --------- | ---------------- | ------------------------- |
| `url`                 | `string`  | IQOption WSS URL | Custom WebSocket endpoint |
| `logger`              | `ILogger` | console logger   | Injectable logger         |
| `silent`              | `boolean` | `false`          | Suppress all log output   |
| `requestTimeoutMs`    | `number`  | `10000`          | Request timeout in ms     |
| `maxReconnectRetries` | `number`  | `5`              | Max reconnection attempts |

### Connection

```typescript
await client.connect();
await client.disconnect();
```

### Authentication

```typescript
const profile = await client.login({ email, password });
const profile = await client.restoreSession(ssid);
const profile = client.getProfile();
```

### Assets

```typescript
client.getAllAssets(); // IQAsset[]
client.getOpenAssets(); // IQAsset[] — currently tradeable
client.getOtcAssets(); // IQAsset[] — OTC only
client.getNonOtcAssets(); // IQAsset[] — non-OTC only
client.getAsset('EURUSD'); // IQAsset | undefined
```

### Market Data

```typescript
// Historical candles
const candles = await client.getCandles('EURUSD', TimeFrame.M1, 100)
const candles = await client.getCandles('EURUSD', TimeFrame.M5, 50, Date.now())

// Real-time candle stream
client.subscribeCandles('EURUSD', TimeFrame.M1, (candle) => { ... })
client.unsubscribeCandles('EURUSD', TimeFrame.M1)

// Tick quotes
client.subscribeQuotes('EURUSD', (tick) => { ... })
client.unsubscribeQuotes('EURUSD')
```

### Trading

```typescript
// Binary options
const { orderId } = await client.buyBinaryOption({
  symbol: 'EURUSD',
  direction: Direction.Call,  // or Direction.Put
  amount: 10,
  durationSeconds: 60,
})
const result = await client.checkBinaryOptionResult(orderId, 70_000)
// result: { orderId, win: 'win' | 'loss' | 'equal', profitAmount: number | null }

// Digital options
const { orderId } = await client.buyDigitalOption({ ... })
const result = await client.checkDigitalOptionResult(orderId, 70_000)

// Positions
const open   = client.getOpenPositions()
const closed = client.getClosedPositions(10)  // last 10
```

### TimeFrame enum

```typescript
import { TimeFrame } from 'iqoptionapi-node';

TimeFrame.S1; // 1 second
TimeFrame.M1; // 1 minute
TimeFrame.M5; // 5 minutes
TimeFrame.M15; // 15 minutes
TimeFrame.M30; // 30 minutes
TimeFrame.H1; // 1 hour
TimeFrame.H4; // 4 hours
TimeFrame.D1; // 1 day
TimeFrame.W1; // 1 week
TimeFrame.MN1; // 1 month
```

## Environment Variables

```bash
IQ_EMAIL=you@example.com
IQ_PASSWORD=secret
IQ_SSID=optional-session-token   # restore an existing session
IQ_ACCOUNT_TYPE=PRACTICE          # PRACTICE (default) | REAL
IQ_LOG_LEVEL=info                 # debug | info | warn | error
IQ_REQUEST_TIMEOUT_MS=10000
IQ_MAX_RECONNECT_RETRIES=5
```

## Examples

See the [`examples/`](./examples) directory:

| File                                                        | Description                            |
| ----------------------------------------------------------- | -------------------------------------- |
| [01-connect-auth.ts](./examples/01-connect-auth.ts)         | Connect and authenticate               |
| [02-fetch-candles.ts](./examples/02-fetch-candles.ts)       | Fetch historical candles               |
| [03-subscribe-stream.ts](./examples/03-subscribe-stream.ts) | Real-time candle + tick stream         |
| [04-buy-option.ts](./examples/04-buy-option.ts)             | Place a binary option and check result |
| [05-get-balance.ts](./examples/05-get-balance.ts)           | Restore session, inspect positions     |

Run any example with:

```bash
IQ_EMAIL=you@example.com IQ_PASSWORD=secret npx ts-node examples/01-connect-auth.ts
```

## Error Hierarchy

```
IQOptionError
  ├── AuthenticationError   — login / session failures
  ├── ConnectionError       — WebSocket connect / send failures
  ├── ProtocolError         — unexpected server messages
  ├── TradingError          — order placement / circuit breaker
  ├── TimeoutError          — request or result timeout
  └── ValidationError       — bad input (unknown symbol, insecure URL)
```

## Circuit Breaker

The trading modules (`BinaryOptions`, `DigitalOptions`) automatically suspend after **5 consecutive failures** and emit a `tradingCircuitOpen` event. No further orders can be placed until the circuit is reset.

This protects against rapid-fire losses during connectivity issues or server-side errors.

## Security Notes

- Credentials are never logged. The sanitizer strips SSID, email, and password from all log output.
- `ws://` connections are rejected with `ValidationError` — WSS only.
- `rejectUnauthorized: true` is hardcoded with no override.

## Publishing / CI

This project uses:

- **GitHub Actions** — runs tests on Node 18 + 20 for every PR
- **semantic-release** — automated versioning and npm publish on merge to `main`
- **Conventional Commits** — `feat:` bumps minor, `fix:` bumps patch, `BREAKING CHANGE` bumps major

To publish, set these secrets in your GitHub repository:

- `NPM_TOKEN` — npm automation token
- `GITHUB_TOKEN` — provided automatically by GitHub Actions

## License

MIT

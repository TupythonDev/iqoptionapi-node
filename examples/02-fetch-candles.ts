/**
 * Example 02 — Fetch historical candles for EURUSD (1-minute, last 10).
 *
 * Run:
 *   IQ_EMAIL=you@example.com IQ_PASSWORD=secret npx ts-node examples/02-fetch-candles.ts
 */
import { IQOptionClient, TimeFrame } from '../src';

async function main() {
  const client = new IQOptionClient();
  await client.connect();

  const email = process.env['IQ_EMAIL'];
  const password = process.env['IQ_PASSWORD'];
  if (!email || !password) throw new Error('Set IQ_EMAIL and IQ_PASSWORD env vars');

  await client.login({ email, password });

  const candles = await client.getCandles('EURUSD', TimeFrame.M1, 10);
  console.log(`Fetched ${candles.length} candles for EURUSD (1m):`);
  for (const c of candles) {
    const time = new Date(c.time).toISOString();
    console.log(`  ${time}  O:${c.open}  H:${c.high}  L:${c.low}  C:${c.close}  V:${c.volume}`);
  }

  client.disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

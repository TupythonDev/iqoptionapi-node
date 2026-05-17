/**
 * Example 03 — Subscribe to real-time 1-minute candles and live tick quotes.
 *
 * Prints 5 candle updates then exits cleanly.
 *
 * Run:
 *   IQ_EMAIL=you@example.com IQ_PASSWORD=secret npx ts-node examples/03-subscribe-stream.ts
 */
import { IQOptionClient, TimeFrame } from '../src';

async function main() {
  const client = new IQOptionClient();
  await client.connect();

  const email = process.env['IQ_EMAIL'];
  const password = process.env['IQ_PASSWORD'];
  if (!email || !password) throw new Error('Set IQ_EMAIL and IQ_PASSWORD env vars');

  await client.login({ email, password });

  let candleCount = 0;

  await new Promise<void>((resolve) => {
    client.subscribeCandles('EURUSD', TimeFrame.M1, (candle) => {
      candleCount++;
      console.log(
        `Candle #${candleCount}: close=${candle.close} at ${new Date(candle.time).toISOString()}`,
      );
      if (candleCount >= 5) resolve();
    });

    client.subscribeQuotes('EURUSD', (tick) => {
      console.log(`Tick: bid=${tick.bid} ask=${tick.ask}`);
    });

    console.log('Subscribed — waiting for 5 candle updates...');
  });

  client.unsubscribeCandles('EURUSD', TimeFrame.M1);
  client.unsubscribeQuotes('EURUSD');
  client.disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

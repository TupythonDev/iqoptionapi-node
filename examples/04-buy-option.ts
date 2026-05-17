/**
 * Example 04 — Place a binary option and wait for the result.
 *
 * IMPORTANT: Uses PRACTICE account by default. Never risks real funds without explicit opt-in.
 *
 * Run:
 *   IQ_EMAIL=you@example.com IQ_PASSWORD=secret npx ts-node examples/04-buy-option.ts
 */
import { IQOptionClient, Direction } from '../src';

async function main() {
  const client = new IQOptionClient();
  await client.connect();

  const email = process.env['IQ_EMAIL'];
  const password = process.env['IQ_PASSWORD'];
  if (!email || !password) throw new Error('Set IQ_EMAIL and IQ_PASSWORD env vars');

  await client.login({ email, password });

  console.log('Placing binary CALL on EURUSD, $1, 1 minute expiry...');
  const { orderId } = await client.buyBinaryOption({
    symbol: 'EURUSD',
    direction: Direction.Call,
    amount: 1,
    durationSeconds: 60,
  });
  console.log(`Order placed: ${orderId}`);

  console.log('Waiting for result (up to 70s)...');
  const result = await client.checkBinaryOptionResult(orderId, 70_000);
  console.log(`Result: ${result.win.toUpperCase()} — profit: ${result.profitAmount ?? 0}`);

  client.disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

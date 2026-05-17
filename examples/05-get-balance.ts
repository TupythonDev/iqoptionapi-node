/**
 * Example 05 — Restore session via SSID and inspect open/closed positions.
 *
 * Run:
 *   IQ_SSID=your-ssid-token npx ts-node examples/05-get-balance.ts
 */
import { IQOptionClient } from '../src';

async function main() {
  const ssid = process.env['IQ_SSID'];
  if (!ssid) throw new Error('Set IQ_SSID env var');

  const client = new IQOptionClient();
  await client.connect();

  const profile = await client.restoreSession(ssid);
  console.log(`Session restored — ${profile.firstName} ${profile.lastName}`);
  console.log(`Account type: ${profile.accountType}`);
  console.log(`Balance: ${profile.balance} ${profile.currency}`);

  const open = client.getOpenPositions();
  const closed = client.getClosedPositions(5);

  console.log(`\nOpen positions: ${open.length}`);
  for (const p of open) {
    console.log(`  [${p.orderId}] ${p.direction} — amount: ${p.amount}`);
  }

  console.log(`\nLast 5 closed positions: ${closed.length}`);
  for (const p of closed) {
    console.log(`  [${p.orderId}] ${p.win ?? 'unknown'} — profit: ${p.profitAmount ?? 0}`);
  }

  client.disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

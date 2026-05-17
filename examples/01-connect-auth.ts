/**
 * Example 01 — Connect and authenticate via email/password.
 *
 * Run:
 *   IQ_EMAIL=you@example.com IQ_PASSWORD=secret npx ts-node examples/01-connect-auth.ts
 */
import { IQOptionClient } from '../src';

async function main() {
  const client = new IQOptionClient();

  await client.connect();
  console.log('Connected to IQOption WebSocket');

  const email = process.env['IQ_EMAIL'];
  const password = process.env['IQ_PASSWORD'];
  if (!email || !password) throw new Error('Set IQ_EMAIL and IQ_PASSWORD env vars');

  const profile = await client.login({ email, password });
  console.log(
    `Logged in as: ${profile.firstName} ${profile.lastName} (balance: ${profile.balance} ${profile.currency})`,
  );

  client.disconnect();
  console.log('Disconnected');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

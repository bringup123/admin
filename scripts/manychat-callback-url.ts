// Prints the URL ManyChat's External Request posts a Lead's reply to
// (src/domain/lead-replies.ts). The token is derived from CRON_SECRET, so run
// it with the production CRON_SECRET in the environment.
// Usage: npx tsx scripts/manychat-callback-url.ts [base-url]
import { manychatCallbackToken } from '../src/domain/lead-replies.js';

const base = process.argv[2] ?? 'https://bringup-v3.vercel.app';
const token = manychatCallbackToken({ cronSecret: process.env.CRON_SECRET ?? '' });
if (!token) {
  console.error('CRON_SECRET is empty');
  process.exit(2);
}
console.log(`${base}/webhooks/manychat?token=${token}`);

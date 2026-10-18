// Turn new venue requests (wrangler d1 --json output) into a GitHub issue body.
// Usage: node scripts/requests-issue.mjs rows.json body.md ids.txt  (writes nothing when there are none)
import { readFileSync, writeFileSync } from 'node:fs';

const [input, bodyPath, idsPath] = process.argv.slice(2);
const parsed = JSON.parse(readFileSync(input, 'utf8'));
const rows = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((r) => r.results ?? []);
if (!rows.length) { console.log('no new venue requests'); process.exit(0); }
// Requests are typed by site visitors: keep them as plain quoted text.
const plain = (s) => String(s ?? '').replace(/[<>`@]/g, ' ').replace(/\s+/g, ' ').trim();
const body = [
  'サイトの「施設のリクエスト」から届いた、掲載してほしい美術館・ギャラリーです（訪問者の入力をそのまま載せています）。',
  '',
  ...rows.map((r) => `- **${plain(r.name)}**${r.url ? ` ${plain(r.url)}` : ''}${r.note ? `\n  > ${plain(r.note)}` : ''}\n  （${r.created_at}）`),
].join('\n');
writeFileSync(bodyPath, body + '\n');
writeFileSync(idsPath, rows.map((r) => Number(r.id)).filter(Number.isInteger).join(','));
console.log(`${rows.length} new venue requests`);

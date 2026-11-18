// Weekly usage summary (wrangler d1 --json outputs) as a GitHub issue comment.
// Usage: node scripts/stats-report.mjs dir out.md   (dir holds users.json, kinds.json, pages.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
const rows = (f) => { const p = JSON.parse(readFileSync(join(dir, f), 'utf8')); return (Array.isArray(p) ? p : [p]).flatMap((r) => r.results ?? []); };
const LABEL = { 'line-header': '画面上部「LINEで受け取る」', 'line-artist': '作家ページ下の固定バー', 'line-artist-card': '作家ページ内のお知らせ欄', 'line-about': 'トップの説明「LINEで友だち追加」', 'line-search': '検索「この条件をLINEで受け取る」' };
const u = rows('users.json')[0] ?? {};
const kinds = rows('kinds.json');
const pages = rows('pages.json');
const cm = (() => { try { return rows('comments.json')[0] ?? {}; } catch { return {}; } })();
const sum = (k) => kinds.reduce((n, r) => n + (r[k] ?? 0), 0);
const md = [
  `## 利用状況（${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)}）`,
  '',
  `- LINEの登録者: ${u.users ?? 0}人（この7日で +${u.new_users ?? 0}人）`,
  `- 登録された作家: ${u.follows ?? 0}件（${u.followers ?? 0}人）、検索条件: ${u.searches ?? 0}件`,
  `- 感想コメント: 掲載中 ${cm.shown ?? 0}件（この7日の投稿 ${cm.new7 ?? 0}件）、自動チェックで不掲載 ${cm.rejected ?? 0}件、通報で非表示 ${cm.hidden ?? 0}件、未確認 ${cm.pending ?? 0}件`,
  '',
  '### LINEボタンが押された回数',
  '| ボタン | 7日間 | 30日間 |',
  '|---|---:|---:|',
  ...kinds.map((r) => `| ${LABEL[r.kind] ?? r.kind} | ${r.d7} | ${r.d30} |`),
  `| 合計 | ${sum('d7')} | ${sum('d30')} |`,
  '',
  '### よく押されたページ（30日間）',
  ...(pages.length ? pages.map((r) => `- ${r.page} … ${r.n}回`) : ['- まだありません']),
].join('\n');
writeFileSync(out, md + '\n');
console.log(md);

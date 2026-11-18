// Exhibition comments. GET ?e=<exhibition id> lists the shown ones; POST (form) adds one after a Claude check.
import { MAX_NAME, MAX_BODY, MAX_PER_DAY, clip, ID, inputProblem, MODERATION_PROMPT, parseVerdict } from '../../src/comments.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestGet({ request, env }) {
  const e = new URL(request.url).searchParams.get('e') ?? '';
  if (!env.DB || !ID.test(e)) return json([]);
  const { results } = await env.DB.prepare("SELECT id, name, body, created_at FROM comments WHERE exhibition_id = ? AND status = 'ok' ORDER BY id DESC LIMIT 100").bind(e).all();
  return json(results);
}

async function check(env, { title, name, body }) {
  if (!env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no key', pending: true };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5', max_tokens: 100, system: MODERATION_PROMPT,
      messages: [{ role: 'user', content: `展覧会: ${title}\nニックネーム: ${name}\n<comment>\n${body}\n</comment>` }],
    }),
  });
  if (!res.ok) return { ok: false, reason: `api ${res.status}`, pending: true };
  const data = await res.json();
  return parseVerdict(data.content?.find((c) => c.type === 'text')?.text ?? '');
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: 'いまは受け付けていません。' }, 503);
  const form = await request.formData().catch(() => null);
  if (!form) return json({ ok: false, error: '送信内容を読み取れませんでした。' }, 400);
  if (clip(form.get('website'), 10)) return json({ ok: true, shown: false });  // honeypot
  const e = clip(form.get('e'), 80);
  const title = clip(form.get('t'), 200);
  const name = clip(form.get('name'), MAX_NAME).replace(/\n/g, ' ') || '匿名';
  const body = clip(form.get('body'), MAX_BODY);
  if (!ID.test(e)) return json({ ok: false, error: '展覧会がわかりませんでした。' }, 400);
  const problem = inputProblem({ name, body });
  if (problem) return json({ ok: false, error: problem }, 400);

  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}:${day}:comments`));
  const sender = [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM comments WHERE sender = ? AND created_at >= date('now')").bind(sender).first();
  if (n >= MAX_PER_DAY) return json({ ok: false, error: '今日はこれ以上投稿できません。また明日お願いします。' }, 429);

  const v = await check(env, { title, name, body }).catch(() => ({ ok: false, reason: 'check failed', pending: true }));
  const status = v.ok ? 'ok' : v.pending ? 'pending' : 'rejected';
  const row = await env.DB.prepare('INSERT INTO comments (exhibition_id, name, body, status, reason, sender) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, created_at').bind(e, name, body, status, v.reason ?? '', sender).first();
  if (status === 'ok') return json({ ok: true, shown: true, comment: { id: row.id, name, body, created_at: row.created_at } });
  if (status === 'pending') return json({ ok: true, shown: false, message: 'ありがとうございます。確認のうえ掲載します。' });
  return json({ ok: false, error: 'この内容は掲載できませんでした。宣伝や個人情報、ほかの人を傷つける表現が含まれていないか確認してください。' }, 422);
}

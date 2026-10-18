// "Please add this venue" form (/request/). Stored in D1; the build workflow turns new ones into a GitHub issue.
const MAX_PER_DAY = 5;
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: 'いまは受け付けていません。' }, 503);
  const form = await request.formData().catch(() => null);
  if (!form) return json({ ok: false, error: '送信内容を読み取れませんでした。' }, 400);
  // Hidden field that people never fill in; bots often do.
  if (clip(form.get('website'), 10)) return json({ ok: true });
  const name = clip(form.get('name'), 80);
  const url = clip(form.get('url'), 300);
  const note = clip(form.get('note'), 500);
  if (!name) return json({ ok: false, error: '施設名を入れてください。' }, 400);
  if (url && !/^https?:\/\/[^\s]+$/.test(url)) return json({ ok: false, error: 'URLは http から始まる形で入れてください。' }, 400);

  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}:${day}`));
  const sender = [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM venue_requests WHERE sender = ? AND created_at >= date('now')").bind(sender).first();
  if (n >= MAX_PER_DAY) return json({ ok: false, error: '今日はこれ以上送れません。また明日お願いします。' }, 429);

  await env.DB.prepare('INSERT INTO venue_requests (name, url, note, sender) VALUES (?, ?, ?, ?)').bind(name, url, note, sender).run();
  return json({ ok: true });
}

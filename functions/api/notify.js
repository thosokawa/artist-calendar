// Called by the build workflow after each deploy: tell followers (of artists, or of saved search conditions) about newly announced exhibitions.
// Reads /data/recent.json (announcements of the last 14 days); the notified table keeps it to once per person per exhibition.
// Only people who followed by the announcement day are told (someone who follows later sees it on the artist page).
// One push per person per run, so each person costs one message from the monthly LINE quota.
import { notifyKey, exhibitionCarousel, lineApi } from '../../src/line.mjs';
import { parseFilter, matchExhibition } from '../../src/filter.mjs';

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('authorization') ?? '';
  if (!env.LINE_CHANNEL_SECRET || auth !== `Bearer ${await notifyKey(env.LINE_CHANNEL_SECRET)}`) return new Response('forbidden', { status: 403 });
  if (!env.DB) return new Response('not ready', { status: 503 });
  const siteUrl = new URL(request.url).origin;
  const recent = await (await env.ASSETS.fetch(new URL('/data/recent.json', request.url))).json();

  const perUser = new Map();
  const add = (userId, e) => { const l = perUser.get(userId) ?? perUser.set(userId, []).get(userId); if (!l.some((x) => x.id === e.id)) l.push(e); };
  for (const e of recent) {
    if (!e.slugs.length) continue;
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT f.user_id FROM follows f JOIN users u ON u.id = f.user_id AND u.active = 1
       WHERE f.artist IN (${e.slugs.map(() => '?').join(',')})
       AND f.created_at <= ?
       AND NOT EXISTS (SELECT 1 FROM notified n WHERE n.user_id = f.user_id AND n.exhibition_id = ?)`,
    ).bind(...e.slugs, `${e.announcedAt} 23:59:59`, e.id).all();
    for (const { user_id } of results) add(user_id, e);
  }

  // Saved search conditions: the same rules as the search page, judged on what the show is.
  const { results: searches } = await env.DB.prepare(
    'SELECT s.user_id, s.query, s.created_at FROM searches s JOIN users u ON u.id = s.user_id AND u.active = 1',
  ).all();
  if (searches.length) {
    const { results: done } = await env.DB.prepare(
      `SELECT user_id, exhibition_id FROM notified WHERE exhibition_id IN (${recent.map(() => '?').join(',') || "''"})`,
    ).bind(...recent.map((e) => e.id)).all();
    const already = new Set(done.map((d) => `${d.user_id} ${d.exhibition_id}`));
    for (const s of searches) {
      const f = parseFilter(s.query);
      for (const e of recent) {
        if (!e.rec || s.created_at > `${e.announcedAt} 23:59:59` || already.has(`${s.user_id} ${e.id}`)) continue;
        if (matchExhibition(e.rec, f, e.announcedAt, { forAlert: true })) add(s.user_id, e);
      }
    }
  }

  let sent = 0;
  const errors = [];
  for (const [userId, list] of perUser) {
    try {
      await lineApi('push', env.LINE_CHANNEL_ACCESS_TOKEN, { to: userId, messages: exhibitionCarousel(list, siteUrl, '登録中の作家や条件に合う、新しい展覧会が発表されました。') });
      await env.DB.batch(list.slice(0, 10).map((e) => env.DB.prepare('INSERT OR IGNORE INTO notified (user_id, exhibition_id) VALUES (?, ?)').bind(userId, e.id)));
      sent += 1;
    } catch (e) {
      errors.push(e.message);
    }
  }
  return new Response(JSON.stringify({ people: perUser.size, sent, errors: errors.slice(0, 5) }), { headers: { 'content-type': 'application/json' } });
}

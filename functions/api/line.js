// LINE webhook: friends register artists by sending a name (or the text pre-filled by the website).
// Replies are free on LINE; only notifications (functions/api/notify.js) count toward the monthly quota.
import { validSignature, parseText, searchArtists, quickReply, lineApi, HELP, MAX_FOLLOWS, MAX_SEARCHES, SLUG } from '../../src/line.mjs';
import { parseFilter, filterQuery, alertable, describeFilter } from '../../src/filter.mjs';

async function siteData(request, env, path) {
  const res = await env.ASSETS.fetch(new URL(path, request.url));
  return res.ok ? res.json() : {};
}

async function savedSearches(db, userId) {
  const { results } = await db.prepare('SELECT id, label FROM searches WHERE user_id = ? ORDER BY created_at').bind(userId).all();
  return results;
}

async function follows(db, userId) {
  const { results } = await db.prepare('SELECT artist FROM follows WHERE user_id = ? ORDER BY created_at').bind(userId).all();
  return results.map((r) => r.artist);
}

async function handle(event, { db, names, museumNames, siteUrl }) {
  const userId = event.source?.userId;
  if (!userId) return null;
  if (event.type === 'unfollow') {
    await db.prepare('UPDATE users SET active = 0 WHERE id = ?').bind(userId).run();
    return null;
  }
  await db.prepare('INSERT INTO users (id) VALUES (?) ON CONFLICT(id) DO UPDATE SET active = 1').bind(userId).run();
  if (event.type === 'follow') return [{ type: 'text', text: `友だち追加ありがとうございます。\n${HELP}` }];

  let action;
  if (event.type === 'postback') {
    const [verb, slug] = String(event.postback?.data ?? '').split(':');
    action = { kind: verb, slug };
  } else if (event.type === 'message' && event.message?.type === 'text') {
    action = parseText(event.message.text);
  } else {
    return [{ type: 'text', text: HELP }];
  }

  if (action.kind === 'follow' || action.kind === 'unfollow') {
    const name = names[action.slug];
    if (!SLUG.test(action.slug ?? '') || !name) return [{ type: 'text', text: 'その作家が見つかりませんでした。作家名を送ってください。' }];
    if (action.kind === 'follow') {
      const mine = await follows(db, userId);
      if (!mine.includes(action.slug) && mine.length >= MAX_FOLLOWS) return [{ type: 'text', text: `登録できるのは${MAX_FOLLOWS}人までです。「一覧」から解除してください。` }];
      await db.prepare('INSERT OR IGNORE INTO follows (user_id, artist) VALUES (?, ?)').bind(userId, action.slug).run();
      return [{ type: 'text', text: `「${name}」を登録しました。新しい展覧会が決まったらお知らせします。\n今の展覧会: ${siteUrl}/artists/${action.slug}/` }];
    }
    await db.prepare('DELETE FROM follows WHERE user_id = ? AND artist = ?').bind(userId, action.slug).run();
    return [{ type: 'text', text: `「${name}」の登録を解除しました。` }];
  }
  if (action.kind === 'save') {
    const f = parseFilter(action.query);
    if (!alertable(f)) return [{ type: 'text', text: `条件が読み取れませんでした。サイトの「探す」で地域・ジャンル・キーワードを選んでからボタンを押してください。\n${siteUrl}/search/` }];
    const query = filterQuery(f, { alertOnly: true });
    const label = describeFilter(f, { museumNames, alertOnly: true }).slice(0, 120);
    const mine = await savedSearches(db, userId);
    if (mine.length >= MAX_SEARCHES) return [{ type: 'text', text: `登録できる条件は${MAX_SEARCHES}件までです。「一覧」から解除してください。` }];
    await db.prepare('INSERT OR IGNORE INTO searches (user_id, query, label) VALUES (?, ?, ?)').bind(userId, query, label).run();
    return [{ type: 'text', text: `条件「${label}」を登録しました。合う展覧会が新しく発表されたらお知らせします。\n今の検索結果: ${siteUrl}/search/?${query}` }];
  }
  if (action.kind === 'unsave') {
    await db.prepare('DELETE FROM searches WHERE user_id = ? AND id = ?').bind(userId, Number(action.slug)).run();
    return [{ type: 'text', text: '条件の登録を解除しました。' }];
  }
  if (action.kind === 'list') {
    const mine = await follows(db, userId);
    const searches = await savedSearches(db, userId);
    if (!mine.length && !searches.length) return [{ type: 'text', text: `まだ何も登録していません。\n${HELP}` }];
    const lines = [];
    if (mine.length) lines.push(`登録中の作家（${mine.length}人）\n${mine.map((s) => `・${names[s] ?? s}`).join('\n')}`);
    if (searches.length) lines.push(`登録中の条件（${searches.length}件）\n${searches.map((x) => `・${x.label}`).join('\n')}`);
    const buttons = [...searches.map((x) => ({ text: `解除: ${x.label}`, data: `unsave:${x.id}` })), ...mine.map((s) => ({ text: `解除: ${names[s] ?? s}`, data: `unfollow:${s}` }))];
    return [{
      type: 'text',
      text: `${lines.join('\n\n')}\n\n解除するには下のボタンを押してください。${buttons.length > 13 ? '（ボタンは最初の13件まで）' : ''}`,
      quickReply: quickReply(buttons),
    }];
  }
  if (action.kind === 'search') {
    const hits = searchArtists(names, action.query);
    if (!hits.length) return [{ type: 'text', text: `「${action.query.slice(0, 30)}」に合う作家が見つかりませんでした。掲載している美術館で展覧会が決まった作家だけが登録できます。\n作家一覧: ${siteUrl}/artists/` }];
    return [{ type: 'text', text: '登録する作家を選んでください。', quickReply: quickReply(hits.map((s) => ({ text: names[s], data: `follow:${s}` }))) }];
  }
  return [{ type: 'text', text: HELP }];
}

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (!(await validSignature(body, request.headers.get('x-line-signature'), env.LINE_CHANNEL_SECRET))) return new Response('bad signature', { status: 401 });
  if (!env.DB) return new Response('not ready', { status: 503 });
  const { events = [] } = JSON.parse(body);
  const siteUrl = new URL(request.url).origin;
  const [names, museumNames] = await Promise.all([siteData(request, env, '/data/artists.json'), siteData(request, env, '/data/museum-names.json')]);
  for (const event of events) {
    const messages = await handle(event, { db: env.DB, names, museumNames, siteUrl });
    if (messages && event.replyToken) await lineApi('reply', env.LINE_CHANNEL_ACCESS_TOKEN, { replyToken: event.replyToken, messages });
  }
  return new Response('ok');
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, artistSlug, resolveArtist } from '../src/artists.mjs';
import { mergeExhibitions, normalizeTitle, isSameTour, statusOn } from '../src/exhibitions.mjs';
import { buildCalendar, exhibitionEvent, googleCalendarUrl } from '../src/ics.mjs';
import { artistProfiles, recommend } from '../src/recommend.mjs';

test('variant kanji and spacing resolve to one artist', () => {
  assert.equal(normalizeName('草間 彌生'), normalizeName('草間弥生'));
  const reg = {};
  const a = resolveArtist(reg, { name: '草間彌生', nameRomaji: 'Yayoi Kusama' });
  const b = resolveArtist(reg, { name: '草間 弥生', nameRomaji: 'Kusama Yayoi' });
  assert.equal(a, 'yayoi-kusama');
  assert.equal(b, a);
  // Same Latin name, different Japanese spelling: alias on the same record.
  const c = resolveArtist(reg, { name: 'クサマ・ヤヨイ', nameRomaji: 'Yayoi Kusama' });
  assert.equal(c, a);
  assert.deepEqual(reg[a].aliases, ['クサマ・ヤヨイ']);
});

test('slug falls back to a hash when there is no Latin name', () => {
  assert.match(artistSlug({ name: '作者不詳', nameRomaji: '' }), /^a-[0-9a-f]{10}$/);
  assert.equal(artistSlug({ name: 'x', nameRomaji: 'Claude Monet' }), 'claude-monet');
});

const raw = (over = {}) => ({ title: '山口晃 見／世／物（仮称）', startDate: '2027-06-18', endDate: '2027-08-29', kind: 'special', artists: [{ name: '山口晃', nameRomaji: 'Akira Yamaguchi' }], genres: ['現代美術', '日本画', 'ゲーム'], detailUrl: null, summary: '要約', ...over });

test('merge adds new shows once and updates them when the title is finalized', () => {
  const reg = {};
  const first = mergeExhibitions({ museumId: 'momat', stored: [], fresh: [raw()], registry: reg, today: '2026-10-16' });
  assert.equal(first.added.length, 1);
  assert.deepEqual(first.exhibitions[0].genres, ['現代美術', '日本画']);
  const id = first.exhibitions[0].id;
  const second = mergeExhibitions({ museumId: 'momat', stored: first.exhibitions, fresh: [raw({ title: '山口晃 見／世／物', endDate: '2027-08-30' })], registry: reg, today: '2026-11-01' });
  assert.equal(second.added.length, 0);
  assert.equal(second.exhibitions.length, 1);
  assert.equal(second.exhibitions[0].id, id);
  assert.equal(second.exhibitions[0].endDate, '2027-08-30');
  assert.equal(second.exhibitions[0].firstSeenAt, '2026-10-16');
  // A differently worded title with no artists named is still the same show when the dates match.
  const third = mergeExhibitions({ museumId: 'momat', stored: second.exhibitions, fresh: [raw({ title: '見／世／物', artists: [], endDate: '2027-08-30' })], registry: reg, today: '2026-11-02' });
  assert.equal(third.added.length, 0);
});

test('merge folds a show that was stored twice', () => {
  const twin = (id, artist, seen) => ({ id, museumId: 'fukuoka-city', title: '仙厓展 後期展示', startDate: '2026-09-30', endDate: '2026-11-29', kind: 'collection', artists: [artist], genres: [], detailUrl: null, summary: '', firstSeenAt: seen, lastSeenAt: seen });
  const stored = [twin('b', 'sengai-gibon', '2026-10-16'), twin('a', 'sengai', '2026-10-15')];
  const { exhibitions, added } = mergeExhibitions({ museumId: 'fukuoka-city', stored, fresh: [], registry: {}, today: '2026-10-17' });
  assert.equal(exhibitions.length, 1);
  assert.equal(exhibitions[0].id, 'a');
  assert.deepEqual(exhibitions[0].artists, ['sengai', 'sengai-gibon']);
  assert.equal(added.length, 0);
});

test('merge drops entries with bad dates', () => {
  const r = mergeExhibitions({ museumId: 'x', stored: [], fresh: [raw({ startDate: '2027年春' }), raw({ endDate: '2027-01-01' })], registry: {}, today: '2026-10-16' });
  assert.equal(r.exhibitions.length, 0);
});

test('touring shows are matched across museums', () => {
  assert.equal(normalizeTitle('「〇〇展」（仮称）'), normalizeTitle('〇〇展'));
  const a = { id: '1', museumId: 'a', title: 'ミルトン・エイヴリー展', artists: ['milton-avery'] };
  const b = { id: '2', museumId: 'b', title: 'ミルトン・エイヴリー展 色彩の詩', artists: ['milton-avery'] };
  const c = { id: '3', museumId: 'b', title: '近代絵画の百年', artists: ['milton-avery'] };
  assert.equal(isSameTour(a, b), true);
  assert.equal(isSameTour(a, c), false);
  assert.equal(statusOn({ startDate: '2026-10-01', endDate: '2026-10-16' }, '2026-10-16'), 'current');
});

test('one-event calendar file and Google link cover the whole run, folded safely', () => {
  const e = { id: 'momat-20270618-abc123', title: '山口晃 見／世／物 とても長いタイトルが続いて折り返しが必要になる展覧会', startDate: '2027-06-18', endDate: '2027-08-29', detailUrl: 'https://www.momat.go.jp/x' };
  const museum = { name: '東京国立近代美術館', exhibitionsUrl: 'https://www.momat.go.jp/exhibitions' };
  const ics = buildCalendar([exhibitionEvent(e, { museum, siteUrl: 'https://example.com', host: 'example.com' })], { name: e.title, now: new Date('2026-10-16T00:00:00Z') });
  assert.match(ics, /DTSTART;VALUE=DATE:20270618/);
  assert.match(ics, /DTEND;VALUE=DATE:20270830/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.ok(!ics.includes('\uFFFD'));
  const g = new URL(googleCalendarUrl(e, { museum, siteUrl: 'https://example.com' }));
  assert.equal(g.searchParams.get('dates'), '20270618/20270830');
  assert.ok(g.href.length < 1000, 'LINE uri actions allow 1000 characters');
});

test('recommendations prefer artists shown together', () => {
  const ex = [
    { id: 'e1', museumId: 'm1', artists: ['a', 'b'], genres: ['現代美術'] },
    { id: 'e2', museumId: 'm2', artists: ['c'], genres: ['現代美術', '写真'] },
    { id: 'e3', museumId: 'm3', artists: ['a'], genres: ['写真'] },
    { id: 'e4', museumId: 'm4', artists: ['d'], genres: ['書'] },
  ];
  const recs = recommend('a', artistProfiles(ex));
  assert.deepEqual(recs.map((r) => r.slug), ['b', 'c']);
});

test('titles are found on the page despite brackets, marks and line breaks', async () => {
  const { titleOnPage } = await import('../src/exhibitions.mjs');
  assert.equal(titleOnPage('特集 王一亭とその時代（仮題）', '展覧会\n特集　王一亭と\nその時代\n2027年'), true);
  assert.equal(titleOnPage('アニマル☆蒔絵—漆芸にみる動物表現—', 'アニマル☆蒔絵 ― 漆芸にみる動物表現 ―'), true);
  assert.equal(titleOnPage('存在しない展覧会', 'アニマル☆蒔絵'), false);
});


test('LINE: signatures, pre-filled follow text, search and the notification carousel', async () => {
  const { validSignature, notifyKey, parseText, followText, searchArtists, exhibitionCarousel } = await import('../src/line.mjs');
  const { createHmac } = await import('node:crypto');
  const body = '{"events":[]}';
  const sig = createHmac('sha256', 'secret').update(body).digest('base64');
  assert.equal(await validSignature(body, sig, 'secret'), true);
  assert.equal(await validSignature(body, sig, 'other'), false);
  assert.match(await notifyKey('secret'), /^[0-9a-f]{64}$/);

  assert.deepEqual(parseText(followText('草間彌生', 'yayoi-kusama')), { kind: 'follow', slug: 'yayoi-kusama' });
  assert.deepEqual(parseText('一覧'), { kind: 'list' });
  assert.deepEqual(parseText('草間'), { kind: 'search', query: '草間' });

  const names = { 'yayoi-kusama': '草間彌生', 'akira-yamaguchi': '山口 晃', 'akira-minagawa': '皆川明' };
  assert.deepEqual(searchArtists(names, '山口晃'), ['akira-yamaguchi']);
  assert.deepEqual(searchArtists(names, 'akira').sort(), ['akira-minagawa', 'akira-yamaguchi']);
  assert.deepEqual(searchArtists(names, '草'), []);

  const ex = (i) => ({ id: `x-${i}`, title: 'とても長い展覧会のタイトルが四十文字を超えるとLINEに断られるので切り詰める必要がある', museum: '国立新美術館', startDate: '2027-01-05', endDate: '2027-03-31', artists: ['草間彌生'], gcal: 'https://calendar.google.com/x' });
  const [text, carousel] = exhibitionCarousel(Array.from({ length: 12 }, (_, i) => ex(i)), 'https://example.com');
  assert.match(text.text, /草間彌生/);
  assert.equal(carousel.template.columns.length, 10);
  for (const c of carousel.template.columns) {
    assert.ok(c.title.length <= 40);
    assert.ok(c.text.length <= 60);
    assert.ok(c.actions.every((a) => a.label.length <= 20));
  }
});

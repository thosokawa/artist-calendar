import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, artistSlug, resolveArtist } from '../src/artists.mjs';
import { mergeExhibitions, normalizeTitle, isSameTour, statusOn } from '../src/exhibitions.mjs';
import { buildCalendar, exhibitionEvents, subscribeLinks } from '../src/ics.mjs';
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

test('artist calendar has an opening event and a closing reminder, folded safely', () => {
  const e = { id: 'momat-20270618-abc123', title: '山口晃 見／世／物 とても長いタイトルが続いて折り返しが必要になる展覧会', startDate: '2027-06-18', endDate: '2027-08-29', detailUrl: 'https://www.momat.go.jp/x' };
  const events = exhibitionEvents(e, { museum: { name: '東京国立近代美術館', exhibitionsUrl: 'https://www.momat.go.jp/exhibitions' }, siteUrl: 'https://example.com', host: 'example.com', today: '2026-10-16' });
  assert.equal(events.length, 2);
  assert.equal(events[1].date, '2027-08-22');
  const ics = buildCalendar(events, { name: '山口晃の展覧会', now: new Date('2026-10-16T00:00:00Z') });
  assert.match(ics, /DTSTART;VALUE=DATE:20270618/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.ok(!ics.includes('�'));
  const l = subscribeLinks('https://example.com/artists/akira-yamaguchi.ics');
  assert.equal(l.webcal, 'webcal://example.com/artists/akira-yamaguchi.ics');
  assert.match(l.google, /cid=webcal%3A%2F%2F/);
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

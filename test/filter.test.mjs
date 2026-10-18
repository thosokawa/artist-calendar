import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFilter, filterQuery, filterText, matchExhibition, alertable, describeFilter, whenRange, normText } from '../src/filter.mjs';
import { parseText } from '../src/line.mjs';

const rec = (over = {}) => ({ id: 'x', t: '草間彌生 永遠の永遠の永遠', s: '2026-11-01', e: '2027-01-31', k: 'special', g: ['現代美術'], m: '国立新美術館', mid: 'nact', p: '東京都', r: 'kanto', a: [['yayoi-kusama', '草間彌生', 'Yayoi Kusama']], f: '2026-10-17', ...over });

test('a condition survives the URL round trip and drops unknown values', () => {
  const f = parseFilter('?area=kanto,mars&genre=写真,現代美術,料理&pref=東京都&q=草間&when=range&from=2026-11-01&sort=end');
  assert.deepEqual(f.areas, ['kanto']);
  assert.deepEqual(f.genres, ['写真', '現代美術']);
  assert.equal(filterQuery(f), 'q=%E8%8D%89%E9%96%93&area=kanto&pref=%E6%9D%B1%E4%BA%AC%E9%83%BD&genre=%E5%86%99%E7%9C%9F%2C%E7%8F%BE%E4%BB%A3%E7%BE%8E%E8%A1%93&when=range&from=2026-11-01&sort=end');
  assert.equal(filterText(f), 'q=草間&area=kanto&pref=東京都&genre=写真,現代美術');
  assert.deepEqual(parseFilter(filterText(f)).genres, ['写真', '現代美術']);
  assert.equal(describeFilter(f, { alertOnly: true }), '関東・東京都 ／ 写真・現代美術 ／ 「草間」');
});

test('region matches an area or a prefecture; genres match any', () => {
  assert.ok(matchExhibition(rec(), parseFilter('pref=大阪府&area=kanto'), '2026-10-17'));
  assert.ok(!matchExhibition(rec(), parseFilter('pref=大阪府'), '2026-10-17'));
  assert.ok(matchExhibition(rec(), parseFilter('genre=写真,現代美術'), '2026-10-17'));
  assert.ok(matchExhibition(rec(), parseFilter('q=yayoi 新美術'), '2026-10-17'));
  assert.ok(!matchExhibition(rec({ k: 'collection' }), parseFilter('special=1'), '2026-10-17'));
});

test('time filters', () => {
  const today = '2026-10-17'; // Saturday
  assert.ok(!matchExhibition(rec(), parseFilter('when=current'), today));
  assert.ok(matchExhibition(rec(), parseFilter('when=upcoming'), today));
  assert.ok(matchExhibition(rec({ s: '2026-10-01', e: '2026-10-25' }), parseFilter('when=ending'), today));
  assert.deepEqual(whenRange(parseFilter('when=weekend'), today), ['2026-10-17', '2026-10-18']);
  assert.ok(matchExhibition(rec(), parseFilter('when=range&from=2026-12-24&to=2026-12-26'), today));
  assert.ok(!matchExhibition(rec(), parseFilter('when=range&to=2026-10-31'), today));
  // Alerts look only at what the show is.
  assert.ok(matchExhibition(rec(), parseFilter('when=current&area=kanto'), today, { forAlert: true }));
});

test('alerts need something to narrow by, and the bot reads the saved condition', () => {
  assert.equal(alertable(parseFilter('when=current&special=1')), false);
  assert.equal(alertable(parseFilter('genre=写真')), true);
  assert.deepEqual(parseText('この条件の新着を通知: 関東 ／ 写真 [s:area=kanto&genre=写真]'), { kind: 'save', query: 'area=kanto&genre=写真' });
  assert.deepEqual(parseText('草間彌生の展覧会を通知 [yayoi-kusama]'), { kind: 'follow', slug: 'yayoi-kusama' });
});

test('hiragana and katakana readings match each other', () => {
  assert.equal(normText('よしだ ひろし'), normText('ヨシダヒロシ'));
  const r = { t: '新版画展', m: '某美術館', p: '東京都', a: [['hiroshi-yoshida', '吉田博', 'Hiroshi Yoshida', 'よしだひろし']] };
  assert.equal(normText([r.t, r.m, r.p, ...r.a.flat()].join(' ')).includes(normText('ヨシダ')), true);
});

test('venue narrows to museums or galleries', () => {
  const g = { id: 'x', t: 'A', s: '2026-01-01', e: '2026-12-31', k: 'special', g: [], m: 'G', mid: 'g', v: 'gallery', p: '東京都', r: 'kanto', a: [] };
  const m = { ...g, mid: 'm', v: undefined };
  const f = parseFilter('venue=gallery');
  assert.equal(matchExhibition(g, f, '2026-06-01'), true);
  assert.equal(matchExhibition(m, f, '2026-06-01'), false);
  assert.equal(matchExhibition(m, parseFilter('venue=museum'), '2026-06-01'), true);
  assert.equal(filterQuery(parseFilter('venue=bogus&genre=写真')), 'genre=%E5%86%99%E7%9C%9F');
});

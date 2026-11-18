import { test } from 'node:test';
import assert from 'node:assert/strict';

test('cleanTitle drops news-heading decoration', async () => {
  const { cleanTitle } = await import('../src/exhibitions.mjs');
  assert.equal(cleanTitle('【個展】三成花奈｜Kana Mitsunari「拘束」開催のお知らせ'), '三成花奈「拘束」');
  assert.equal(cleanTitle('【開催予告】 栗林隆展'), '栗林隆展');
  assert.equal(cleanTitle('2026年コレクション展 Ⅲ 【特集展示】竹のカタチ'), '2026年コレクション展 Ⅲ 【特集展示】竹のカタチ');
  assert.equal(cleanTitle('【予告】'), '【予告】');
});

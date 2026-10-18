import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSnsUrl, snsLinksInHtml, htmlLinksTo } from '../src/sns.mjs';

test('account links are recognised, share buttons and posts are not', () => {
  assert.equal(parseSnsUrl('https://www.instagram.com/MOTcontemporary/?hl=ja').url, 'https://www.instagram.com/motcontemporary/');
  assert.equal(parseSnsUrl('https://twitter.com/MOT_art_museum').url, 'https://x.com/MOT_art_museum');
  assert.equal(parseSnsUrl('https://www.youtube.com/@mot').kind, 'youtube');
  assert.equal(parseSnsUrl('https://twitter.com/intent/tweet?text=a'), null);
  assert.equal(parseSnsUrl('https://www.facebook.com/sharer/sharer.php?u=x'), null);
  assert.equal(parseSnsUrl('https://www.instagram.com/p/abc/'), null);
  assert.equal(parseSnsUrl('https://example.com/instagram'), null);
});

test('links on a page are grouped by kind, most frequent first', () => {
  const html = '<a href="https://instagram.com/b">b</a><a href="https://www.instagram.com/a/">a</a><a href="https://instagram.com/a">a</a>';
  assert.deepEqual(snsLinksInHtml(html).instagram, ['https://www.instagram.com/a/', 'https://www.instagram.com/b/']);
  assert.ok(htmlLinksTo(html, 'https://www.instagram.com/B/'));
  assert.ok(!htmlLinksTo(html, 'https://www.instagram.com/c/'));
});

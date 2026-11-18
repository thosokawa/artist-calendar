import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBooks } from '../src/books.mjs';

test('pickBooks keeps covers by the artist, once per title', () => {
  const items = [
    { title: '草間彌生 作品集', author: '草間 彌生/著', itemPrice: 3300, largeImageUrl: 'https://thumbnail.image.rakuten.co.jp/a.jpg?_ex=200x200', itemUrl: 'https://books.rakuten.co.jp/rb/1/', affiliateUrl: 'https://hb.afl.rakuten.co.jp/x' },
    { title: '草間彌生 作品集（新装版）', author: '草間彌生', largeImageUrl: 'https://thumbnail.image.rakuten.co.jp/b.jpg', itemUrl: 'u2' },
    { title: '別人の本', author: '草間太郎', largeImageUrl: 'https://thumbnail.image.rakuten.co.jp/c.jpg', itemUrl: 'u3' },
    { title: '画像なし', author: '草間彌生', largeImageUrl: 'https://thumbnail.image.rakuten.co.jp/noimage_01.gif', itemUrl: 'u4' },
  ];
  const got = pickBooks(['草間彌生'], items);
  assert.equal(got.length, 1);
  assert.equal(got[0].url, 'https://hb.afl.rakuten.co.jp/x');
  assert.equal(got[0].affiliate, true);
  assert.match(got[0].image, /_ex=240x240/);
});

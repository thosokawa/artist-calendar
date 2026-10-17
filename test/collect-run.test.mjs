// End-to-end run of scripts/collect.mjs against a local page and a faked Claude answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const filler = '<p>開館時間や休館日のご案内です。</p>'.repeat(12);
let body = `${filler}<h2>竹久夢二 時代を創る表現者</h2><p>2026.10.23 - 2027.1.11</p>`;

test('new exhibitions are added once and announced; invented titles are dropped', async () => {
  const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<html><body>${body}</body></html>`); });
  await new Promise((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/exhibitions`;
  const root = mkdtempSync(join(tmpdir(), 'art-'));
  mkdirSync(join(root, 'data/museums'), { recursive: true });
  writeFileSync(join(root, 'data/museums/demo.json'), JSON.stringify({ id: 'demo', name: 'デモ美術館', exhibitionsUrl: url, status: 'ok' }));
  const yumeji = { title: '竹久夢二 時代を創る表現者', startDate: '2026-10-23', endDate: '2027-01-11', kind: 'special', artists: [{ name: '竹久夢二', nameRomaji: 'Yumeji Takehisa' }], genres: ['日本画'], detailUrl: null, summary: 's' };
  const invented = { ...yumeji, title: '存在しない展覧会', artists: [] };
  const fake = join(root, 'fake.json');
  writeFileSync(fake, JSON.stringify({ demo: [yumeji, invented] }));
  const run = () => new Promise((resolve, reject) => execFile(process.execPath, ['scripts/collect.mjs'], { env: { ...process.env, ART_ROOT: root, COLLECT_FAKE_EXTRACTION: fake, COLLECT_TODAY: '2026-10-16' } }, (err, out) => (err ? reject(err) : resolve(out))));
  try {
    const first = await run();
    assert.match(first, /skipped: 存在しない展覧会/);
    assert.match(first, /1 new exhibition/);
    assert.match(await run(), /unchanged/);
    // First reading is the baseline: nothing announced yet.
    assert.equal(JSON.parse(readFileSync(join(root, 'data/announcements.json'), 'utf8')).length, 0);
    body += '<h2>斬新！速水御舟</h2><p>2027.3.19 - 5.9</p>';
    const gyoshu = { ...yumeji, title: '斬新！速水御舟', startDate: '2027-03-19', endDate: '2027-05-09', artists: [{ name: '速水御舟', nameRomaji: 'Gyoshu Hayami' }] };
    writeFileSync(fake, JSON.stringify({ demo: [yumeji, gyoshu] }));
    assert.match(await run(), /1 new exhibition/);
    const ex = JSON.parse(readFileSync(join(root, 'data/exhibitions/demo.json'), 'utf8'));
    assert.equal(ex.length, 2);
    assert.deepEqual(ex[0].artists, ['yumeji-takehisa']);
    const ann = JSON.parse(readFileSync(join(root, 'data/announcements.json'), 'utf8'));
    assert.equal(ann.length, 1);
    assert.deepEqual(ann[0].artists, ['gyoshu-hayami']);
    assert.equal(JSON.parse(readFileSync(join(root, 'data/artists.json'), 'utf8'))['yumeji-takehisa'].name, '竹久夢二');
  } finally {
    server.close();
  }
});

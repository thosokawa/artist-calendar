import test from 'node:test';
import assert from 'node:assert/strict';
import { inputProblem, parseVerdict, clip } from '../src/comments.mjs';

test('comment input rules', () => {
  assert.equal(inputProblem({ name: '', body: '短い' }), '感想は10文字以上で書いてください。');
  assert.equal(inputProblem({ name: 'a', body: '詳しくは https://example.com を見てください' }), 'URLは書けません。');
  assert.equal(inputProblem({ name: 'a', body: '平日の午前でも混んでいましたが、見応えがありました。' }), null);
  assert.equal(clip('a\r\n\n\n\nb\u0007', 400), 'a\n\nb');
});

test('moderation verdicts', () => {
  assert.deepEqual(parseVerdict('OK'), { ok: true, reason: '' });
  assert.deepEqual(parseVerdict('NG\n宣伝'), { ok: false, reason: '宣伝' });
  assert.equal(parseVerdict('たぶん大丈夫').ok, false);
});

// Visitor comments on exhibition pages: input rules and the moderation check (shared by the site function and tests).
export const MAX_NAME = 20;
export const MAX_BODY = 400;
export const MAX_PER_DAY = 3;
export const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
export const ID = /^[\w-]{1,80}$/;

/** A problem with the input as typed, or null. */
export function inputProblem({ name, body }) {
  if (!body || body.length < 10) return '感想は10文字以上で書いてください。';
  if (/https?:\/\/|www\.|\.(com|jp|net)\b/i.test(body + name)) return 'URLは書けません。';
  return null;
}

export const MODERATION_PROMPT = `あなたは美術展の情報サイトに投稿された感想コメントを確認します。次のどれかに当てはまれば NG、どれにも当てはまらなければ OK と答えます。
- 宣伝・勧誘・スパム、または展覧会と関係のない内容
- 作家・施設・ほかの人への誹謗中傷、差別、脅し、性的な内容
- 電話番号・メールアドレス・住所など個人を特定できる情報
- 意味のない文字の羅列
展覧会への辛口の感想（「混んでいた」「期待ほどではなかった」など）は OK です。
1行目に OK か NG だけを書き、NG なら2行目に短い理由を書きます。`;

/** Parse Claude's answer: { ok, reason }. Anything unclear counts as not ok. */
export function parseVerdict(text) {
  const [first = '', reason = ''] = String(text).trim().split('\n');
  return { ok: /^OK\b/i.test(first.trim()), reason: reason.trim().slice(0, 100) || (/^OK\b/i.test(first.trim()) ? '' : 'unclear') };
}

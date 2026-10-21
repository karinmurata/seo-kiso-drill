// 問題データのチェック。依存パッケージなし。使い方: node tools/check.js
// index.html から問題（Q）・出典（S）・用語（G）を読み取り、よくあるミスを検出する。
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];

const CAT = {};
const catLine = js.match(/const C1=[^\n]*/)[0];
for (const m of catLine.matchAll(/(C\d)='([^']+)'/g)) CAT[m[1]] = m[2];

const Q = eval(js.match(/const Q=(\[[\s\S]*?\n\]);/)[1].replace(/\bC(\d)\b/g, '"C$1"'));
const G = eval(js.match(/const G=(\[[\s\S]*?\n\]);/)[1]);
const S = js.match(/const S=\{([\s\S]*?)\n\};/)[1];

// 過去に使って削除した ID。記録データと衝突するので再利用しない
const RETIRED = [2, 24, 25, 26, 27, 35, 36, 48, 49, 115];

const errors = [];
const warns = [];
const ids = new Set();

for (const q of Q) {
  const tag = `id:${q.id}`;
  if (ids.has(q.id)) errors.push(`${tag} ID が重複しています`);
  ids.add(q.id);
  if (RETIRED.includes(q.id)) errors.push(`${tag} 削除済みの ID を再利用しています`);
  if (!CAT[q.c]) errors.push(`${tag} カテゴリ ${q.c} が未定義です`);
  if (!q.q || !q.e || !q.p) errors.push(`${tag} 問題文(q)・解説(e)・実務のポイント(p)のどれかが空です`);
  if (!new RegExp(`\\b${q.s}:`).test(S)) errors.push(`${tag} 出典キー '${q.s}' が S にありません`);
  if (q.o && q.o !== 'moz') errors.push(`${tag} o は 'moz' か省略（Google）のみです`);

  if (q.t === 'mc') {
    if (!Array.isArray(q.ch) || q.ch.length !== 4) errors.push(`${tag} 4択は選択肢を4つにしてください`);
    if (q.a !== 0) errors.push(`${tag} 4択は ch[0] を正解（a:0）にしてください。表示時にシャッフルされます`);
    if (q.why) for (const k of Object.keys(q.why)) {
      if (+k === q.a || !q.ch[k]) errors.push(`${tag} why のキー ${k} が不正です（正解以外の選択肢番号 1〜3）`);
    }
  } else if (q.t === 'tf') {
    if (q.a !== 0 && q.a !== 1) errors.push(`${tag} ○×は a:0（○）か a:1（×）です`);
    // 答えが言い回しで分かってしまう言葉
    const giveaway = q.q.match(/必ず|絶対|それだけで|だけから|まったく|ことがある|かもしれない|必ずしも/);
    if (giveaway) warns.push(`${tag} ○×の問題文に「${giveaway[0]}」があり、答えが推測されやすいです`);
  } else {
    errors.push(`${tag} t は 'mc' か 'tf' です`);
  }
}

const tf = Q.filter(q => q.t === 'tf');
const o = tf.filter(q => q.a === 0).length;
const x = tf.length - o;
if (Math.abs(o - x) > tf.length * 0.2) warns.push(`○×の答えが偏っています（○${o} / ×${x}）`);

const byCat = {};
for (const q of Q) {
  const k = CAT[q.c] || q.c;
  byCat[k] = byCat[k] || { google: 0, moz: 0 };
  byCat[k][q.o === 'moz' ? 'moz' : 'google']++;
}

const maxId = Math.max(...Q.map(q => q.id));
const noWhy = Q.filter(q => q.t === 'mc' && !q.why).map(q => q.id);

console.log(`問題数 ${Q.length}（Google ${Q.filter(q => !q.o).length} / Moz ${Q.filter(q => q.o === 'moz').length}）、○× ${tf.length}（○${o} / ×${x}）、用語 ${G.length}`);
console.table(byCat);
console.log(`次に使える ID: ${maxId + 1}〜（Google 由来・Moz 由来で共通）`);
if (noWhy.length) console.log(`「他の選択肢が違う理由」(why) がない4択: ${noWhy.join(', ')}`);
warns.forEach(w => console.log('注意: ' + w));
errors.forEach(e => console.log('エラー: ' + e));
if (errors.length) process.exit(1);
console.log(errors.length ? '' : 'OK');

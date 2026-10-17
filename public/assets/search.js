// Search page: filters /data/search.json in the browser with the same rules the LINE alerts use (filter.mjs).
// The condition is kept in the URL, so results can be shared and a condition can be sent to the LINE bot.
import { parseFilter, filterQuery, filterText, matchExhibition, sortResults, describeFilter, alertable } from './filter.mjs';

const form = document.getElementById('filters');
const out = document.getElementById('results');
const more = document.getElementById('more');
const PAGE = 60;
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 864e5).toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (d) => { const [y, m, dd] = d.split('-'); return `${y}年${+m}月${+dd}日`; };

const [data, museumNames] = await Promise.all(['/data/search.json', '/data/museum-names.json'].map(async (u) => (await fetch(u)).json()));
let shown = PAGE;

function readForm() {
  const p = new URLSearchParams();
  for (const name of ['area', 'pref', 'genre', 'museum']) p.set(name, [...form.querySelectorAll(`input[name=${name}]:checked`)].map((i) => i.value).join(','));
  for (const name of ['q', 'when', 'from', 'to', 'sort']) p.set(name, form.elements[name].value);
  if (form.elements.special.checked) p.set('special', '1');
  return parseFilter(p);
}

function writeForm(f) {
  form.elements.q.value = f.q;
  const on = { area: f.areas, pref: f.prefs, genre: f.genres, museum: f.museums };
  for (const [name, values] of Object.entries(on)) for (const i of form.querySelectorAll(`input[name=${name}]`)) i.checked = values.includes(i.value);
  form.elements.special.checked = f.special;
  form.elements.when.value = f.when;
  form.elements.from.value = f.from;
  form.elements.to.value = f.to;
  form.elements.sort.value = f.sort;
  if (f.museums.length) form.querySelector('[data-facet=museum]').open = true;
}

// What each folded row has chosen, e.g. 地域「関東・京都府」.
function updateFacetLabels(f) {
  const names = (list, all) => list.map((v) => all.find((i) => i.value === v)?.closest('label').querySelector('span').textContent ?? v);
  const pick = (sel) => [...form.querySelectorAll(sel)];
  const sel = {
    area: [...names(f.areas, pick('input[name=area]')), ...f.prefs],
    genre: f.genres,
    museum: names(f.museums, pick('input[name=museum]')),
    when: [f.when ? form.elements.when.selectedOptions[0].textContent : '', f.special ? '企画展のみ' : ''].filter(Boolean),
  };
  for (const [k, v] of Object.entries(sel)) {
    const el = form.querySelector(`[data-sel=${k}]`);
    el.textContent = v.length ? v.join('・') : '指定なし';
    el.classList.toggle('on', v.length > 0);
  }
}

// How many results each choice would give, with the rest of the condition kept.
function updateCounts(f) {
  const count = (g) => data.filter((r) => matchExhibition(r, g, today)).length;
  const variants = {
    area: (v) => ({ ...f, areas: [v], prefs: [] }),
    pref: (v) => ({ ...f, areas: [], prefs: [v] }),
    genre: (v) => ({ ...f, genres: [v] }),
    museum: (v) => ({ ...f, museums: [v] }),
  };
  for (const el of form.querySelectorAll('[data-count]')) {
    const [name, value] = el.dataset.count.split(':');
    const n = count(variants[name](value));
    el.textContent = n;
    el.closest('label').classList.toggle('zero', n === 0);
  }
}

function card(r) {
  const status = r.s > today ? ['upcoming', '開催予定'] : r.e <= soon ? ['ending', 'まもなく終了'] : ['current', '開催中'];
  const artists = r.a.map(([s, n]) => `<a href="/artists/${esc(s)}/">${esc(n)}</a>`).join('、');
  return `<li class="card"><span class="badge ${status[0]}">${status[1]}</span>${r.k === 'collection' ? ' <span class="badge past">コレクション展</span>' : ''}
<a class="title" href="/exhibitions/${esc(r.id)}/">${esc(r.t)}</a><div class="meta">${esc(r.m)}（${esc(r.p)}） · ${fmt(r.s)} 〜 ${fmt(r.e)}</div>
${artists ? `<div class="artists">${artists}</div>` : ''}${r.g.length ? `<div class="tags">${r.g.map((g) => `<span>${esc(g)}</span>`).join('')}</div>` : ''}</li>`;
}

function render({ resetPaging = true } = {}) {
  const f = readForm();
  if (resetPaging) shown = PAGE;
  form.classList.toggle('show-range', f.when === 'range');
  const hits = sortResults(data.filter((r) => matchExhibition(r, f, today)), f);
  document.getElementById('count').textContent = `${hits.length}件`;
  document.getElementById('go').textContent = `${hits.length}件の展覧会を見る`;
  updateFacetLabels(f);
  document.getElementById('summary').textContent = describeFilter(f, { museumNames });
  out.innerHTML = hits.length ? hits.slice(0, shown).map(card).join('') : '<li class="empty">条件に合う展覧会はありません。条件を減らしてみてください。</li>';
  more.hidden = hits.length <= shown;
  updateCounts(f);

  const query = filterQuery(f);
  history.replaceState(null, '', query ? `?${query}` : location.pathname);

  const box = document.getElementById('alert');
  const lineId = form.dataset.line;
  box.hidden = !lineId;
  const link = document.getElementById('alert-line');
  if (alertable(f)) {
    const text = `この条件の新着を通知: ${describeFilter(f, { museumNames, alertOnly: true })} [s:${filterText(f)}]`;
    link.href = `https://line.me/R/oaMessage/${encodeURIComponent(lineId)}/?${encodeURIComponent(text)}`;
    link.classList.remove('disabled');
    link.removeAttribute('aria-disabled');
    link.textContent = 'この条件をLINEで受け取る';
  } else {
    link.removeAttribute('href');
    link.classList.add('disabled');
    link.setAttribute('aria-disabled', 'true');
    link.textContent = '地域・ジャンル・キーワードを選ぶとLINEで受け取れます';
  }
}

writeForm(parseFilter(location.search));
form.addEventListener('input', () => render());
form.addEventListener('submit', (e) => {
  e.preventDefault();
  render();
  for (const d of form.querySelectorAll('details.facet')) d.open = false;
  document.activeElement?.blur();
  document.getElementById('result-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
form.addEventListener('reset', () => setTimeout(() => render()));
more.addEventListener('click', () => { shown += PAGE; render({ resetPaging: false }); });
document.getElementById('copy-link').addEventListener('click', async (e) => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'コピーしました'; } catch { e.target.textContent = location.href; }
});
render();

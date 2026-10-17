// Search box suggestions: artist and museum names (also by hiragana reading or Latin name), loaded on first focus.
// Picking one only fills in the box, so it can be combined with other conditions before searching.
const kata = (s) => s.normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/[\s・･.\-‐ー=＝]/g, '');
let list;
async function load() {
  if (!list) list = fetch('/data/suggest.json').then((r) => r.json()).then((rows) => rows.map(([kind, href, name, kana, latin]) => ({ kind, href, name, keys: [name, kana, latin].filter(Boolean).map(kata) })));
  return list;
}
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

document.querySelectorAll('.search-big input[name=q]').forEach((input) => {
  const box = input.closest('.search-big');
  const ul = document.createElement('ul');
  ul.className = 'suggest'; ul.id = 'suggest-' + Math.random().toString(36).slice(2); ul.setAttribute('role', 'listbox'); ul.hidden = true;
  box.append(ul);
  input.setAttribute('autocomplete', 'off'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', ul.id);
  let items = [], active = -1;
  const close = () => { ul.hidden = true; active = -1; input.removeAttribute('aria-activedescendant'); };
  const mark = (i) => {
    active = i;
    [...ul.children].forEach((li, j) => li.classList.toggle('on', j === i));
    if (i >= 0) input.setAttribute('aria-activedescendant', ul.children[i].id); else input.removeAttribute('aria-activedescendant');
  };
  const pick = (i) => {
    input.value = items[i].name;
    close();
    // Let the search page recount with the new word; `picked` keeps the list from reopening.
    picked = true; input.dispatchEvent(new Event('input', { bubbles: true })); picked = false;
    input.focus();
  };
  let picked = false;
  async function update() {
    if (picked) return;
    const q = kata(input.value);
    if (!q) return close();
    const all = await load();
    if (kata(input.value) !== q) return;
    const head = (x) => x.keys.some((k) => k.startsWith(q));
    items = all.filter((x) => x.keys.some((k) => k.includes(q))).sort((a, b) => (head(b) - head(a)) || a.name.length - b.name.length).slice(0, 8);
    if (!items.length) return close();
    ul.innerHTML = items.map((x, i) => `<li role="option" id="${ul.id}-${i}" data-i="${i}"><span class="k">${x.kind}</span>${esc(x.name)}</li>`).join('');
    ul.hidden = false; mark(-1);
  }
  input.addEventListener('focus', load, { once: true });
  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    if (ul.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = items.length; mark(((active + (e.key === 'ArrowDown' ? 1 : -1)) % n + n) % n); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') close();
  });
  // mousedown, not click, so the input keeps focus and blur does not close the list first.
  ul.addEventListener('mousedown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
  input.addEventListener('blur', () => setTimeout(close, 150));
});

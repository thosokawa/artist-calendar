// Search box suggestions: artist and museum names, loaded on first focus. Picking one opens its page.
const kata = (s) => s.normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/[\s・･.\-‐ー=＝]/g, '');
let list;
async function load() {
  if (!list) list = Promise.all([['/data/artists.json', '作家', '/artists/'], ['/data/museum-names.json', '美術館', '/museums/']].map(async ([u, kind, base]) =>
    Object.entries(await (await fetch(u)).json()).map(([slug, name]) => ({ name, kind, href: `${base}${slug}/`, key: kata(name) })))).then((a) => a.flat());
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
  async function update() {
    const q = kata(input.value);
    if (!q) return close();
    const all = await load();
    if (kata(input.value) !== q) return;
    items = all.filter((x) => x.key.includes(q)).sort((a, b) => (b.key.startsWith(q) - a.key.startsWith(q)) || a.key.length - b.key.length).slice(0, 8);
    if (!items.length) return close();
    ul.innerHTML = items.map((x, i) => `<li role="option" id="${ul.id}-${i}"><a href="${x.href}"><span class="k">${x.kind}</span>${esc(x.name)}</a></li>`).join('');
    ul.hidden = false; mark(-1);
  }
  input.addEventListener('focus', load, { once: true });
  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    if (ul.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = items.length; mark(((active + (e.key === 'ArrowDown' ? 1 : -1)) % n + n) % n); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); location.href = items[active].href; }
    else if (e.key === 'Escape') close();
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
});

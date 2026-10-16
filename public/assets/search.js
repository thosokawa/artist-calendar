// Filters /data/search.json in the browser. Keeps the filters in the URL so results can be shared.
(async () => {
  const form = document.getElementById('filters');
  const out = document.getElementById('results');
  const count = document.getElementById('count');
  const data = await (await fetch('/data/search.json')).json();
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const monthEnd = today.slice(0, 8) + '31';
  const norm = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[\s・]/g, '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (d) => { const [y, m, dd] = d.split('-'); return `${y}年${+m}月${+dd}日`; };

  const params = new URLSearchParams(location.search);
  for (const [k, v] of params) { const el = form.elements[k]; if (el) el.type === 'checkbox' ? (el.checked = true) : (el.value = v); }

  function render() {
    const f = new FormData(form);
    const q = norm(f.get('q') || '');
    const area = f.get('area'), genre = f.get('genre'), when = f.get('when'), special = f.get('special');
    const hits = data.filter((x) => {
      if (area && x.r !== area) return false;
      if (genre && !x.g.includes(genre)) return false;
      if (special && x.k !== 'special') return false;
      if (when === 'current' && x.s > today) return false;
      if (when === 'upcoming' && x.s <= today) return false;
      if (when === 'month' && (x.s > monthEnd || x.e < today)) return false;
      if (q && !norm([x.t, x.m, x.p, ...x.a.flat()].join(' ')).includes(q)) return false;
      return true;
    });
    count.textContent = `${hits.length}件`;
    out.innerHTML = hits.slice(0, 200).map((x) => `<li class="card"><span class="badge ${x.s > today ? 'upcoming' : 'current'}">${x.s > today ? '開催予定' : '開催中'}</span>
<a class="title" href="/exhibitions/${esc(x.id)}/">${esc(x.t)}</a><div class="meta">${esc(x.m)}（${esc(x.p)}） · ${fmt(x.s)} 〜 ${fmt(x.e)}</div>
${x.a.length ? `<div class="artists">${x.a.map(([s, n]) => `<a href="/artists/${esc(s)}/">${esc(n)}</a>`).join('、')}</div>` : ''}</li>`).join('');
    const p = new URLSearchParams([...f].filter(([, v]) => v));
    history.replaceState(null, '', p.size ? `?${p}` : location.pathname);
  }
  form.addEventListener('input', render);
  form.addEventListener('submit', (e) => { e.preventDefault(); render(); });
  render();
})();

// Exhibition comments: refresh the list, post a new one, report one.
const box = document.getElementById('comments');
if (box) {
  const list = box.querySelector('.comment-list');
  const empty = box.querySelector('.c-empty');
  const count = () => { const n = list.children.length; empty.hidden = n > 0; const h = box.querySelector('h2'); h.querySelector('.c-count')?.remove(); if (n) h.insertAdjacentHTML('beforeend', `<small class="c-count">${n}件</small>`); };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const item = (c) => `<li data-id="${esc(c.id)}"><p class="c-body">${esc(c.body).replace(/\n/g, '<br>')}</p><p class="c-meta"><span class="c-name">${esc(c.name)}</span><span>${esc(String(c.created_at).slice(0, 10).replace(/-/g, '/'))}</span><button type="button" class="c-report">通報</button></p></li>`;

  fetch(`/api/comments?e=${encodeURIComponent(box.dataset.e)}`).then((r) => (r.ok ? r.json() : null)).then((rows) => {
    if (!Array.isArray(rows)) return;
    list.innerHTML = rows.map(item).join('');
    count();
  }).catch(() => {});

  list.addEventListener('click', async (ev) => {
    const b = ev.target.closest('.c-report');
    if (!b) return;
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'この感想を通報する（もう一度押す）'; return; }
    const li = b.closest('li');
    const fd = new FormData(); fd.set('id', li.dataset.id);
    await fetch('/api/comments/report', { method: 'POST', body: fd }).catch(() => {});
    li.innerHTML = '<p class="c-body meta">通報を受け付けました。この感想は非表示になりました。</p>';
  });

  const form = box.querySelector('.comment-form');
  const out = form.querySelector('.c-result');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; out.hidden = false; out.textContent = '内容を確認しています…';
    try {
      const r = await (await fetch(form.action, { method: 'POST', body: new FormData(form) })).json();
      if (r.ok && r.shown) { list.insertAdjacentHTML('afterbegin', item(r.comment)); count(); form.reset(); out.textContent = '投稿しました。ありがとうございます。'; }
      else if (r.ok) { form.reset(); out.textContent = r.message ?? 'ありがとうございます。'; }
      else out.textContent = r.error;
    } catch { out.textContent = '送信できませんでした。時間をおいてもう一度お試しください。'; }
    btn.disabled = false;
  });
}

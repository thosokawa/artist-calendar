// LINE notify panel: two corner brackets (the logo's motif) slide along the edge from corner to corner,
// clockwise, pausing at each; the coral dot shows in a free corner while they rest.
// First time the panel comes into view: a short delay, then one bracket move (the content fades in by CSS, style.css nb-in).
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HOLD = 4000, MOVE = 1400, STEP = HOLD + MOVE, T = 4 * STEP, DELAY = 500, EASE = 'cubic-bezier(.6,0,.3,1)';

for (const card of document.querySelectorAll('.notify-card')) {
  const rect = card.querySelector('.nb-run rect'), dot = card.querySelector('.nb-dot');
  if (!rect || !dot || !card.animate) continue;
  let anims = [], started = false;

  const run = () => {
    anims.forEach((a) => a.cancel());
    const w = card.offsetWidth, h = card.offsetHeight, arm = 26, P = 2 * (w + h);
    // One dash every half perimeter puts a bracket on two opposite corners at once.
    rect.style.strokeDasharray = `${2 * arm} ${P / 2 - 2 * arm}`;
    const at = [arm, arm - w, arm - w - h, arm - 2 * w - h, arm - 2 * w - 2 * h];
    const free = [[w, 0], [w, h], [0, h], [0, 0]];
    if (still) { rect.style.strokeDashoffset = arm; dot.style.transform = `translate(${w}px,0)`; dot.style.opacity = 1; return; }
    const rk = [], dk = [];
    for (let i = 0; i < 4; i++) {
      const t = i * STEP, pos = `translate(${free[i][0]}px,${free[i][1]}px)`;
      rk.push({ offset: t / T, strokeDashoffset: at[i] }, { offset: (t + HOLD) / T, strokeDashoffset: at[i], easing: EASE });
      dk.push({ offset: t / T, opacity: 0, transform: pos }, { offset: (t + 300) / T, opacity: 1, transform: pos },
        { offset: (t + HOLD - 150) / T, opacity: 1, transform: pos }, { offset: (t + HOLD) / T, opacity: 0, transform: pos });
    }
    rk.push({ offset: 1, strokeDashoffset: at[4] });
    dk.push({ offset: 1, opacity: 0, transform: `translate(${free[0][0]}px,${free[0][1]}px)` });
    const opts = { duration: T, iterations: Infinity };
    anims = [rect.animate(rk, opts), dot.animate(dk, opts)];
    // On a resize keep the current place in the loop; on the first start, begin just before the first move.
    const now = started ? (performance.now() - startedAt) % T : HOLD - DELAY;
    anims.forEach((a) => { a.currentTime = now; });
    if (!started) { started = true; startedAt = performance.now() - now; }
  };
  let startedAt = 0;

  const begin = () => {
    run();
    new ResizeObserver(() => started && run()).observe(card);
  };
  if (still || !window.IntersectionObserver) { begin(); continue; }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); begin(); } }, { threshold: 0.4 });
  io.observe(card);
}

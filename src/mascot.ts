// Копи (от «копить») — персонаж СпендТрекера: монетка-колобок в фирменном градиенте с ростком на макушке.
// Рисуется SVG прямо в странице; настроение задаётся ртом, глазами и бровями.
// Покачивается и моргает на CSS, следит глазами за пальцем/курсором и подпрыгивает от нажатия — MASCOT_JS.

export type Mood = 'happy' | 'wave' | 'wow' | 'worried' | 'sleep' | 'wink';

const INK = '#1c1c2e';

function eyes(mood: Mood) {
  const open = (x: number) =>
    `<g class="kopi-eye"><ellipse cx="${x}" cy="58" rx="9" ry="10" fill="#fff"/><g class="kopi-pupil"><circle cx="${x}" cy="59" r="5.2" fill="${INK}"/><circle cx="${x + 1.8}" cy="56.6" r="1.7" fill="#fff"/></g></g>`;
  const closed = (x: number) => `<path d="M${x - 8} 59 Q${x} 66 ${x + 8} 59" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
  if (mood === 'sleep') return closed(45) + closed(75);
  if (mood === 'wink') return `<g class="kopi-eyes">${open(45)}</g>${closed(75)}`;
  return `<g class="kopi-eyes">${open(45)}${open(75)}</g>`;
}

function mouth(mood: Mood) {
  switch (mood) {
    case 'wow':
      return `<ellipse cx="60" cy="83" rx="5.5" ry="6.5" fill="${INK}"/>`;
    case 'worried':
      return `<path d="M50 85 Q55 79 60 84 Q65 89 70 83" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M37 45 L51 49 M83 45 L69 49" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'sleep':
      return `<ellipse cx="60" cy="82" rx="3.5" ry="3" fill="${INK}"/>
        <text class="kopi-z" x="92" y="30" font-size="14" font-weight="800" fill="#c9c3ff">z</text>
        <text class="kopi-z" x="101" y="17" font-size="10" font-weight="800" fill="#c9c3ff" style="animation-delay:.6s">z</text>`;
    default:
      return `<path d="M50 77 Q60 91 70 77 Z" fill="${INK}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M55.5 83.5 Q60 87.5 64.5 83.5 Q60 81 55.5 83.5 Z" fill="#ff7a9a"/>`;
  }
}

/** SVG-персонаж. size — ширина в пикселях. */
export function mascot(mood: Mood = 'happy', size = 96, extraClass = '') {
  const arm = (side: 'l' | 'r', wave: boolean) =>
    side === 'l'
      ? `<path d="M17 70 Q8 74 9 84" fill="none" stroke="url(#kopi-g)" stroke-width="7" stroke-linecap="round"/>`
      : wave
        ? `<g class="kopi-wave"><path d="M103 66 Q114 58 112 46" fill="none" stroke="url(#kopi-g)" stroke-width="7" stroke-linecap="round"/></g>`
        : `<path d="M103 70 Q112 74 111 84" fill="none" stroke="url(#kopi-g)" stroke-width="7" stroke-linecap="round"/>`;
  return `<span class="kopi ${extraClass}" role="img" aria-label="Копи, персонаж СпендТрекера" style="width:${size}px">
<svg viewBox="0 0 120 132" width="${size}" height="${Math.round((size * 132) / 120)}">
  <defs>
    <linearGradient id="kopi-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a78bfa"/><stop offset=".55" stop-color="#6f8dff"/><stop offset="1" stop-color="#5ad1c6"/>
    </linearGradient>
  </defs>
  <ellipse class="kopi-shadow" cx="60" cy="126" rx="28" ry="4.5" fill="#000" opacity=".35"/>
  <g class="kopi-body">
    <ellipse cx="47" cy="114" rx="9" ry="6" fill="#5b5bd6"/>
    <ellipse cx="73" cy="114" rx="9" ry="6" fill="#5b5bd6"/>
    ${arm('l', false)}${arm('r', mood === 'wave')}
    <path d="M60 18 Q59 9 63 3" fill="none" stroke="#5ad1c6" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M63 6 Q72 0 78 6 Q71 12 63 6 Z" fill="#5ad1c6"/>
    <circle cx="60" cy="64" r="46" fill="url(#kopi-g)"/>
    <circle cx="60" cy="64" r="39" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3"/>
    <ellipse cx="40" cy="36" rx="12" ry="6.5" fill="#fff" opacity=".32" transform="rotate(-32 40 36)"/>
    <ellipse cx="33" cy="75" rx="6.5" ry="3.8" fill="#ff8fb1" opacity=".6"/>
    <ellipse cx="87" cy="75" rx="6.5" ry="3.8" fill="#ff8fb1" opacity=".6"/>
    ${eyes(mood)}
    ${mouth(mood)}
  </g>
</svg></span>`;
}

export const MASCOT_CSS = `
  .kopi { display: inline-block; flex: none; line-height: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .kopi svg { overflow: visible; display: block; }
  .kopi .kopi-body { animation: kopi-float 3.4s ease-in-out infinite; }
  .kopi .kopi-shadow { animation: kopi-shadow 3.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  .kopi .kopi-eyes { animation: kopi-blink 4.8s infinite; transform-box: fill-box; transform-origin: center; }
  .kopi .kopi-pupil { transition: transform .25s var(--ease, ease); }
  .kopi .kopi-wave { animation: kopi-wave 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: 0% 100%; }
  .kopi .kopi-z { animation: kopi-z 2.4s ease-in-out infinite; }
  .kopi.jump .kopi-body { animation: kopi-jump .62s cubic-bezier(.3,1.6,.5,1); }
  @keyframes kopi-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @keyframes kopi-shadow { 0%, 100% { transform: scaleX(1); opacity: .35; } 50% { transform: scaleX(.86); opacity: .25; } }
  @keyframes kopi-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.08); } }
  @keyframes kopi-wave { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-18deg); } 75% { transform: rotate(14deg); } }
  @keyframes kopi-z { 0% { opacity: 0; transform: translateY(4px); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-8px); } }
  @keyframes kopi-jump { 0% { transform: translateY(0) scale(1, 1); } 25% { transform: translateY(2px) scale(1.06, .92); } 55% { transform: translateY(-14px) scale(.96, 1.05); } 100% { transform: translateY(0) scale(1, 1); } }
  @media (prefers-reduced-motion: reduce) { .kopi * { animation: none !important; } }

  .kopi-card { display: flex; align-items: flex-end; gap: 12px; margin: 0 0 14px; }
  .kopi-bubble {
    position: relative; flex: 1; min-width: 0; background: var(--surface); border: 0.5px solid var(--hair);
    border-radius: 20px 20px 20px 6px; padding: 12px 15px; font-size: 15px; line-height: 1.4; margin-bottom: 18px;
    transition: opacity .2s ease;
  }
  .kopi-bubble b { font-weight: 600; }
  .kopi-bubble .who { display: block; font-size: 12px; font-weight: 600; color: var(--accent); margin-bottom: 2px; }
  .kopi-empty { text-align: center; padding: 10px 0 4px; color: var(--text-2); font-size: 15px; }
  .kopi-empty .kopi { margin-bottom: 6px; }
`;

// Глаза следят за пальцем/курсором, нажатие — прыжок и следующая подсказка из data-tips
export const MASCOT_JS = `
(function () {
  var all = [].slice.call(document.querySelectorAll('.kopi'));
  if (!all.length) return;
  function look(x, y) {
    all.forEach(function (k) {
      var r = k.getBoundingClientRect();
      var dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height * 0.45);
      var d = Math.sqrt(dx * dx + dy * dy) || 1, m = Math.min(2.6, d / 40);
      [].forEach.call(k.querySelectorAll('.kopi-pupil'), function (p) {
        p.style.transform = 'translate(' + (dx / d * m).toFixed(2) + 'px,' + (dy / d * m).toFixed(2) + 'px)';
      });
    });
  }
  window.addEventListener('pointermove', function (e) { look(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener('pointerdown', function (e) { look(e.clientX, e.clientY); }, { passive: true });
  all.forEach(function (k) {
    k.addEventListener('click', function () {
      k.classList.remove('jump'); void k.offsetWidth; k.classList.add('jump');
      if (navigator.vibrate) navigator.vibrate(8);
      var card = k.closest('.kopi-card'), bubble = card && card.querySelector('.kopi-text');
      var tips = card && JSON.parse(card.getAttribute('data-tips') || '[]');
      if (!bubble || !tips.length) return;
      var i = (Number(card.getAttribute('data-i')) + 1) % tips.length;
      card.setAttribute('data-i', i);
      bubble.parentNode.style.opacity = 0;
      setTimeout(function () { bubble.innerHTML = tips[i]; bubble.parentNode.style.opacity = 1; }, 180);
    });
  });
})();
`;

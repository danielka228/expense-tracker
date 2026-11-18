// Трэк — персонаж СпендТрекера: монетка-колобок в фирменном градиенте с ростком на макушке.
// Рисуется SVG прямо в странице; настроение задаётся ртом, глазами и бровями.
// Покачивается и моргает на CSS, следит глазами за пальцем/курсором и подпрыгивает от нажатия — MASCOT_JS.

import type { Lang } from './i18n';

export type Mood = 'happy' | 'wave' | 'wow' | 'worried' | 'sleep' | 'wink' | 'love' | 'sad' | 'cool';

const INK = '#1c1c2e';

function eyes(mood: Mood) {
  const open = (x: number) =>
    `<g class="kopi-eye"><ellipse cx="${x}" cy="58" rx="9" ry="10" fill="#fff"/><g class="kopi-pupil"><circle cx="${x}" cy="59" r="5.2" fill="${INK}"/><circle cx="${x + 1.8}" cy="56.6" r="1.7" fill="#fff"/></g></g>`;
  const closed = (x: number) => `<path d="M${x - 8} 59 Q${x} 66 ${x + 8} 59" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
  if (mood === 'sleep') return closed(45) + closed(75);
  if (mood === 'wink') return `<g class="kopi-eyes">${open(45)}</g>${closed(75)}`;
  if (mood === 'love') {
    const heart = (x: number) =>
      `<path d="M${x} 66 C${x - 13} 57 ${x - 9} 46 ${x} 52 C${x + 9} 46 ${x + 13} 57 ${x} 66 Z" fill="#ff4d7d" stroke="#fff" stroke-width="1.5"/>`;
    return heart(45) + heart(75);
  }
  if (mood === 'cool') {
    return `<path d="M30 52 H90 V56 Q90 68 77 68 Q65 68 63 57 H57 Q55 68 43 68 Q30 68 30 56 Z" fill="${INK}"/>
      <path d="M36 55 L44 55" stroke="#fff" stroke-opacity=".5" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M68 55 L76 55" stroke="#fff" stroke-opacity=".5" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  if (mood === 'sad') {
    return `<g class="kopi-eyes">${open(45)}${open(75)}</g>
      <path d="M36 47 L50 43 M84 47 L70 43" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <path d="M38 68 Q34 76 38 79 Q42 76 38 68 Z" fill="#7cc8ff"/>`;
  }
  return `<g class="kopi-eyes">${open(45)}${open(75)}</g>`;
}

function mouth(mood: Mood) {
  switch (mood) {
    case 'wow':
      return `<ellipse cx="60" cy="83" rx="5.5" ry="6.5" fill="${INK}"/>`;
    case 'worried':
      return `<path d="M50 85 Q55 79 60 84 Q65 89 70 83" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M37 45 L51 49 M83 45 L69 49" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'sad':
      return `<path d="M51 86 Q60 78 69 86" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
    case 'cool':
      return `<path d="M52 80 Q62 86 70 78" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
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
export function mascot(mood: Mood = 'happy', size = 96, extraClass = '', lang: Lang = 'ru') {
  const arm = (side: 'l' | 'r', wave: boolean) =>
    side === 'l'
      ? `<g class="kopi-arm kopi-arm-left"><path d="M17 70 Q8 74 9 84" fill="none" stroke="url(#kopi-g)" stroke-width="7" stroke-linecap="round"/></g>`
      : wave
        ? `<g class="kopi-arm kopi-arm-right kopi-wave"><path d="M103 66 Q114 58 112 46" fill="none" stroke="url(#kopi-g)" stroke-width="7" stroke-linecap="round"/></g>`
        : `<g class="kopi-arm kopi-arm-right"><path d="M103 70 Q112 74 111 84" fill="none" stroke="url(#kopi-g)" stroke-width="7" stroke-linecap="round"/></g>`;
  const interactive = extraClass.split(/\s+/).includes('interactive');
  const role = interactive ? 'button' : 'img';
  return `<span class="kopi ${extraClass}" role="${role}" ${interactive ? 'tabindex="0"' : 'aria-hidden="true"'} aria-label="${lang === 'en' ? 'Track, the SpendTracker mascot' : 'Трэк, персонаж СпендТрекера'}" style="width:${size}px">
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
    <path class="kopi-stem" d="M60 18 Q59 9 63 3" fill="none" stroke="#5ad1c6" stroke-width="3.5" stroke-linecap="round"/>
    <path class="kopi-leaf" d="M63 6 Q72 0 78 6 Q71 12 63 6 Z" fill="#5ad1c6"/>
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
  .kopi { display: inline-block; flex: none; line-height: 0; cursor: default; -webkit-tap-highlight-color: transparent; }
  .kopi.interactive { cursor: pointer; touch-action: manipulation; }
  .kopi[role="button"] { outline: none; }
  .kopi[role="button"]:focus-visible { filter: drop-shadow(0 0 5px rgba(166,154,255,.7)); border-radius: 50%; }
  .kopi svg { overflow: visible; display: block; }
  .kopi .kopi-body { transform-box: fill-box; transform-origin: 50% 70%; animation: kopi-float 3.2s ease-in-out infinite; }
  .kopi .kopi-shadow { animation: kopi-shadow 3.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  .kopi .kopi-eyes { animation: kopi-blink 4.8s infinite; transform-box: fill-box; transform-origin: center; }
  .kopi .kopi-pupil { transition: transform .25s var(--ease, ease); }
  .kopi .kopi-arm { transform-box: fill-box; transform-origin: 50% 8%; }
  .kopi .kopi-arm-left { animation: kopi-gesture-left 3.8s ease-in-out infinite; }
  .kopi .kopi-arm-right { animation: kopi-gesture-right 4.3s ease-in-out infinite; }
  .kopi .kopi-wave { animation: kopi-wave 1s ease-in-out infinite; transform-box: fill-box; transform-origin: 8% 100%; }
  .kopi .kopi-stem { transform-origin: 60px 18px; transform-box: view-box; animation: kopi-stem 3.2s ease-in-out infinite; }
  .kopi .kopi-leaf { transform-origin: 63px 7px; transform-box: view-box; animation: kopi-leaf 2.4s ease-in-out infinite; }
  .kopi .kopi-z { animation: kopi-z 2.4s ease-in-out infinite; }
  .kopi.jump .kopi-body { animation: kopi-jump .72s cubic-bezier(.3,1.6,.5,1); }
  .kopi.jump .kopi-arm-left { animation: kopi-wave .8s ease-in-out 2; transform-origin: 100% 5%; }
  .kopi.jump .kopi-arm-right { animation: kopi-wave .8s ease-in-out 2; transform-origin: 0% 5%; }
  .kopi.jump .kopi-leaf { animation: kopi-leaf-excited .72s ease-out; }
  .kopi:hover .kopi-body { animation: kopi-hover .55s ease-in-out both; }
  .kopi:hover .kopi-arm-left, .kopi:hover .kopi-arm-right { animation: kopi-wave .8s ease-in-out 2; }
  @keyframes kopi-float { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-5px) rotate(-1.5deg); } }
  @keyframes kopi-shadow { 0%, 100% { transform: scaleX(1); opacity: .35; } 50% { transform: scaleX(.86); opacity: .25; } }
  @keyframes kopi-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.08); } }
  @keyframes kopi-wave { 0%, 100% { transform: rotate(0); } 30% { transform: rotate(-24deg); } 65% { transform: rotate(16deg); } }
  @keyframes kopi-gesture-left { 0%, 78%, 100% { transform: rotate(0); } 84% { transform: rotate(-12deg); } 90% { transform: rotate(5deg); } }
  @keyframes kopi-gesture-right { 0%, 72%, 100% { transform: rotate(0); } 79% { transform: rotate(10deg); } 86% { transform: rotate(-5deg); } }
  @keyframes kopi-stem { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(5deg); } }
  @keyframes kopi-leaf { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(12deg); } }
  @keyframes kopi-leaf-excited { 0% { transform: rotate(0); } 30% { transform: rotate(-28deg); } 65% { transform: rotate(20deg); } 100% { transform: rotate(0); } }
  @keyframes kopi-hover { 0%,100% { transform: translateY(0) rotate(0) scale(1); } 45% { transform: translateY(-7px) rotate(3deg) scale(1.035); } }
  @keyframes kopi-z { 0% { opacity: 0; transform: translateY(4px); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-8px); } }
  @keyframes kopi-jump { 0% { transform: translateY(0) rotate(0) scale(1, 1); } 18% { transform: translateY(3px) rotate(-4deg) scale(1.08, .9); } 52% { transform: translateY(-19px) rotate(4deg) scale(.96, 1.06); } 76% { transform: translateY(-5px) rotate(-2deg) scale(1.02, .98); } 100% { transform: translateY(0) rotate(0) scale(1, 1); } }
  @media (prefers-reduced-motion: reduce) { .kopi *, .kopi { animation: none !important; transition: none !important; } }

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
    if (!k.classList.contains('interactive')) return;
    function activate() {
      k.classList.remove('jump'); void k.offsetWidth; k.classList.add('jump');
      if (navigator.vibrate) navigator.vibrate(8);
      var card = k.closest('.kopi-card'), bubble = card && card.querySelector('.kopi-text');
      var tips = card && JSON.parse(card.getAttribute('data-tips') || '[]');
      if (!bubble || !tips.length) return;
      var i = (Number(card.getAttribute('data-i')) + 1) % tips.length;
      card.setAttribute('data-i', i);
      bubble.parentNode.style.opacity = 0;
      setTimeout(function () { bubble.innerHTML = tips[i]; bubble.parentNode.style.opacity = 1; }, 180);
    }
    k.addEventListener('click', activate);
    k.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });
})();
`;

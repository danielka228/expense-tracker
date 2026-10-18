// Общие стили: тёмная тема с фиолетово-бирюзовыми акцентами, стеклянные карточки, плавные анимации
export const BASE_CSS = `
  :root {
    --bg: #07080d;
    --bg-2: #0d0f18;
    --card: rgba(22, 24, 36, 0.72);
    --card-solid: #161824;
    --card-2: rgba(255, 255, 255, 0.055);
    --card-3: rgba(255, 255, 255, 0.09);
    --border: rgba(255, 255, 255, 0.07);
    --sep: rgba(255, 255, 255, 0.06);
    --text: #eef0f7;
    --muted: #8b90a6;
    --dim: #5d6178;
    --accent: #8b7bff;
    --accent-2: #45d4c4;
    --grad: linear-gradient(135deg, #8b7bff 0%, #6c8bff 45%, #45d4c4 100%);
    --accent2: #3ddc97;
    --danger: #ff6b81;
    --gold: #ffc861;
    --radius: 24px;
    --ease: cubic-bezier(.2, .8, .2, 1);
    --spring: cubic-bezier(.34, 1.56, .64, 1);
    --font: ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color-scheme: dark;
  }
  @view-transition { navigation: auto; }
  ::view-transition-old(root) { animation: vt-out .18s var(--ease) both; }
  ::view-transition-new(root) { animation: vt-in .32s var(--ease) both; }
  @keyframes vt-out { to { opacity: 0; transform: scale(.985); } }
  @keyframes vt-in { from { opacity: 0; transform: translateY(8px); } }

  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { background-color: var(--bg); }
  body {
    margin: 0;
    font-family: var(--font);
    color: var(--text);
    min-height: 100vh;
    overflow-y: scroll;
    overscroll-behavior: none;
    -webkit-font-smoothing: antialiased;
    background:
      radial-gradient(120% 60% at 15% -10%, rgba(139, 123, 255, 0.22), transparent 60%),
      radial-gradient(90% 50% at 100% 0%, rgba(69, 212, 196, 0.12), transparent 55%),
      var(--bg);
    background-attachment: fixed;
  }
  .wrap { max-width: 480px; margin: 0 auto; padding: 22px 16px 130px; }
  .center-wrap { max-width: 380px; margin: 10vh auto; padding: 0 20px; }
  h1, h2, h3 { margin: 0 0 8px; font-weight: 700; letter-spacing: -0.3px; }
  h3 { font-size: 17px; }

  .brand {
    font-weight: 800; font-size: 28px; letter-spacing: -0.6px;
    text-align: center; margin-bottom: 28px;
    background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .page-title {
    display: flex; align-items: center; gap: 10px;
    font-weight: 800; font-size: 26px; letter-spacing: -0.6px; margin: 4px 4px 18px;
  }
  .page-title .sub { margin-left: auto; font-size: 14px; font-weight: 600; color: var(--muted); letter-spacing: 0; }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 20px;
    margin-bottom: 14px;
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    backdrop-filter: blur(20px) saturate(140%);
    box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px rgba(0,0,0,0.25);
  }
  .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .card-head h3 { margin: 0; }
  .card-head .hint { font-size: 13px; color: var(--muted); }

  /* Плавное появление блоков страницы по очереди */
  .wrap > *, .center-wrap > * { animation: rise .55s var(--ease) both; }
  .wrap > *:nth-child(2), .center-wrap > *:nth-child(2) { animation-delay: .05s; }
  .wrap > *:nth-child(3), .center-wrap > *:nth-child(3) { animation-delay: .1s; }
  .wrap > *:nth-child(4) { animation-delay: .15s; }
  .wrap > *:nth-child(5) { animation-delay: .2s; }
  .wrap > *:nth-child(n+6) { animation-delay: .25s; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px) scale(.99); } }

  input, select {
    width: 100%;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1.5px solid transparent;
    background: var(--card-2);
    color: var(--text);
    font-family: var(--font);
    font-size: 16px;
    margin-bottom: 12px;
    -webkit-appearance: none;
    appearance: none;
    transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
  }
  select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%238b90a6' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 16px center;
  }
  input[type="date"] { min-height: 51px; }
  input::placeholder { color: var(--dim); }
  input:focus, select:focus {
    outline: none; border-color: rgba(139,123,255,.7); background-color: var(--card-3);
    box-shadow: 0 0 0 4px rgba(139,123,255,.15);
  }
  input.filled, select.filled { animation: filled 1.2s var(--ease); }
  @keyframes filled {
    0% { box-shadow: 0 0 0 0 rgba(69,212,196,.0); border-color: rgba(69,212,196,.9); }
    30% { box-shadow: 0 0 0 6px rgba(69,212,196,.25); border-color: rgba(69,212,196,.9); }
    100% { box-shadow: 0 0 0 0 rgba(69,212,196,0); }
  }
  label { font-size: 13px; color: var(--muted); display: block; margin: 0 0 6px 4px; }
  button, .btn {
    display: block;
    width: 100%;
    padding: 15px;
    border-radius: 16px;
    border: none;
    font-family: var(--font);
    font-weight: 700;
    font-size: 16px;
    text-align: center;
    cursor: pointer;
    background: var(--grad);
    color: #fff;
    box-shadow: 0 8px 24px rgba(108,139,255,.28);
    transition: transform .25s var(--spring), opacity .15s ease, box-shadow .2s ease;
  }
  button:active, .btn:active { transform: scale(0.96); opacity: 0.92; }
  .btn-secondary { background: var(--card-2); color: var(--text); box-shadow: none; border: 1px solid var(--border); }
  .btn-danger {
    background: rgba(255,107,129,0.12); color: var(--danger); border: none; box-shadow: none;
    font-weight: 600; padding: 7px 14px; width: auto; font-size: 13px; border-radius: 999px;
  }
  .btn-icon {
    width: 32px; height: 32px; padding: 0; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .btn-icon svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2.4; stroke-linecap: round; }
  a { color: var(--accent); text-decoration: none; }

  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
  .stat {
    background: var(--card-2); border: 1px solid var(--border);
    border-radius: 20px; padding: 16px 8px; text-align: center;
  }
  .stat .value { font-size: 19px; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; }
  .stat .label { font-size: 12px; color: var(--muted); margin-top: 4px; }

  .flash {
    padding: 12px 16px; border-radius: 16px; margin-bottom: 14px; font-size: 14px; font-weight: 600;
    border: 1px solid transparent; transition: opacity .4s ease, transform .4s var(--ease), margin .4s ease, padding .4s ease, max-height .4s ease;
    max-height: 80px; overflow: hidden;
  }
  .flash.success { background: rgba(61,220,151,0.1); color: var(--accent2); border-color: rgba(61,220,151,0.18); }
  .flash.error { background: rgba(255,107,129,0.1); color: var(--danger); border-color: rgba(255,107,129,0.2); }
  .flash.hide { opacity: 0; transform: translateY(-8px); max-height: 0; margin: 0; padding-top: 0; padding-bottom: 0; }

  .expense-row {
    display: flex; justify-content: space-between; align-items: center; gap: 10px;
    padding: 11px 0; border-bottom: 1px solid var(--sep);
  }
  .expense-row:last-child { border-bottom: none; }
  .expense-row .info { font-size: 15px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .expense-row .cat { color: var(--muted); font-size: 12px; font-weight: 500; margin-top: 2px; }
  .expense-row .amt { font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .day-label { font-size: 12px; font-weight: 700; color: var(--dim); text-transform: uppercase; letter-spacing: .6px; margin: 14px 0 2px; }
  .day-label:first-of-type { margin-top: 4px; }

  /* Иконки категорий: линейные значки в градиентных плитках */
  .ico {
    width: 40px; height: 40px; border-radius: 13px; flex: none;
    display: inline-flex; align-items: center; justify-content: center;
    margin-right: 12px; color: #fff;
    background: linear-gradient(145deg, #8b9dff, #5b6cf0);
    box-shadow: 0 6px 16px -6px rgba(91,108,240,.7), inset 0 1px 0 rgba(255,255,255,.25);
  }
  .ico svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
  .ico.green  { background: linear-gradient(145deg, #6ee7b0, #22b07a); box-shadow: 0 6px 16px -6px rgba(34,176,122,.7), inset 0 1px 0 rgba(255,255,255,.25); }
  .ico.orange { background: linear-gradient(145deg, #ffb46b, #f0772e); box-shadow: 0 6px 16px -6px rgba(240,119,46,.7), inset 0 1px 0 rgba(255,255,255,.25); }
  .ico.pink   { background: linear-gradient(145deg, #ff9cc2, #e8508a); box-shadow: 0 6px 16px -6px rgba(232,80,138,.7), inset 0 1px 0 rgba(255,255,255,.25); }
  .ico.purple { background: linear-gradient(145deg, #c4a6ff, #8a5cf5); box-shadow: 0 6px 16px -6px rgba(138,92,245,.7), inset 0 1px 0 rgba(255,255,255,.25); }
  .ico.red    { background: linear-gradient(145deg, #ff8f9e, #e5485f); box-shadow: 0 6px 16px -6px rgba(229,72,95,.7), inset 0 1px 0 rgba(255,255,255,.25); }
  .ico.teal   { background: linear-gradient(145deg, #74e6dc, #1fb3a5); box-shadow: 0 6px 16px -6px rgba(31,179,165,.7), inset 0 1px 0 rgba(255,255,255,.25); }
  .ico.yellow { background: linear-gradient(145deg, #ffdc7a, #eaa92a); box-shadow: 0 6px 16px -6px rgba(234,169,42,.7), inset 0 1px 0 rgba(255,255,255,.25); }
  .ico.blue   { background: linear-gradient(145deg, #8fb4ff, #4a78f0); box-shadow: 0 6px 16px -6px rgba(74,120,240,.7), inset 0 1px 0 rgba(255,255,255,.25); }

  .cat-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 14px; }
  .cat-bar .track { flex: 1; height: 6px; background: var(--card-2); border-radius: 999px; overflow: hidden; }
  .cat-bar .fill {
    height: 100%; border-radius: 999px; background: var(--grad);
    transform-origin: left; animation: grow 1s var(--ease) .2s both;
  }
  @keyframes grow { from { transform: scaleX(0); } }
  .footer-link { text-align: center; margin-top: 16px; font-size: 14px; color: var(--muted); }

  .tabbar {
    position: fixed;
    left: 14px; right: 14px;
    bottom: calc(14px + env(safe-area-inset-bottom));
    max-width: 452px; margin: 0 auto;
    height: 68px;
    display: flex; justify-content: space-between; align-items: center;
    gap: 4px; padding: 6px;
    background: rgba(18, 20, 31, 0.72);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,.05);
    z-index: 10;
    view-transition-name: tabbar;
  }
  .tab {
    flex: 1; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    color: var(--muted);
    font-size: 11px; font-weight: 600;
    border-radius: 999px;
    transition: background .3s var(--ease), color .3s var(--ease), transform .25s var(--spring);
  }
  .tab:active { transform: scale(.92); }
  .tab .icon { display: flex; line-height: 1; }
  .tab .icon svg {
    width: 24px; height: 24px; fill: none; stroke: currentColor;
    stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round;
  }
  .tab.active { color: #fff; background: linear-gradient(135deg, rgba(139,123,255,.28), rgba(69,212,196,.16)); }
  .tab.active .icon svg { stroke: url(#tab-grad); }

  .period-switch {
    display: flex; gap: 4px; padding: 4px; margin-bottom: 16px;
    background: var(--card); border: 1px solid var(--border); border-radius: 999px;
  }
  .period-switch a {
    flex: 1; text-align: center; padding: 9px 0; border-radius: 999px;
    color: var(--muted); font-size: 14px; font-weight: 600;
    transition: background .3s var(--ease), color .3s var(--ease);
  }
  .period-switch a.active { background: var(--grad); color: #fff; box-shadow: 0 6px 18px rgba(108,139,255,.3); }

  .board-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 0; border-bottom: 1px solid var(--sep);
  }
  .board-row:last-child { border-bottom: none; }
  .board-row .rank { width: 24px; text-align: center; font-weight: 800; color: var(--dim); }
  .board-row.rank-1 .rank { color: var(--gold); }
  .board-row .name { flex: 1; font-size: 16px; font-weight: 600; }
  .board-row.me .name { color: var(--accent); }
  .board-row .amount { font-weight: 800; font-variant-numeric: tabular-nums; }

  .friend-req-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--sep); }
  .friend-req-row:last-child { border-bottom: none; }
  .req-actions { display: flex; gap: 8px; }
  .req-actions button { width: auto; padding: 8px 16px; font-size: 14px; border-radius: 999px; }
  .btn-accept { background: linear-gradient(135deg, #3ddc97, #22b07a); color: #062014; box-shadow: none; }

  .profile-avatar {
    width: 84px; height: 84px; border-radius: 50%;
    background: var(--grad);
    display: flex; align-items: center; justify-content: center;
    font-size: 32px; font-weight: 800; color: #fff;
    margin: 0 auto 14px;
  }
  .profile-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0 2px; }
  .profile-stats .value { font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; }
  }
`;

// Виджеты главной и голосовой ввод
export const DASHBOARD_CSS = `
  .hero {
    position: relative; overflow: hidden;
    padding: 22px 22px 18px;
    background:
      radial-gradient(120% 140% at 100% 0%, rgba(69,212,196,.28), transparent 55%),
      radial-gradient(120% 140% at 0% 100%, rgba(139,123,255,.38), transparent 60%),
      rgba(24, 24, 44, .8);
  }
  .hero::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.06) 50%, transparent 70%);
    transform: translateX(-100%); animation: shine 2.8s var(--ease) .6s;
  }
  @keyframes shine { to { transform: translateX(100%); } }
  .hero .label { font-size: 14px; color: rgba(238,240,247,.7); font-weight: 600; }
  .hero .big {
    font-size: 44px; font-weight: 800; letter-spacing: -1.5px; line-height: 1.1;
    margin: 4px 0 16px; font-variant-numeric: tabular-nums;
  }
  .hero .big .cur { font-size: 26px; font-weight: 700; color: rgba(238,240,247,.6); margin-left: 4px; letter-spacing: 0; }
  .hero .chips { display: flex; gap: 8px; }
  .chip {
    flex: 1; padding: 10px 12px; border-radius: 16px;
    background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.08);
  }
  .chip .k { font-size: 12px; color: rgba(238,240,247,.6); font-weight: 600; }
  .chip .v { font-size: 17px; font-weight: 800; margin-top: 2px; font-variant-numeric: tabular-nums; }

  /* График за 7 дней */
  .week { display: flex; align-items: flex-end; gap: 8px; height: 128px; padding-top: 18px; }
  .week .col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end; }
  .week .bar-wrap { position: relative; width: 100%; flex: 1; display: flex; align-items: flex-end; }
  .week .bar {
    width: 100%; min-height: 6px; border-radius: 10px;
    background: linear-gradient(180deg, rgba(150,135,255,.85), rgba(139,123,255,.3));
    transform-origin: bottom; animation: rise-bar .9s var(--spring) both;
  }
  .week .col:nth-child(2) .bar { animation-delay: .04s; }
  .week .col:nth-child(3) .bar { animation-delay: .08s; }
  .week .col:nth-child(4) .bar { animation-delay: .12s; }
  .week .col:nth-child(5) .bar { animation-delay: .16s; }
  .week .col:nth-child(6) .bar { animation-delay: .2s; }
  .week .col:nth-child(7) .bar { animation-delay: .24s; }
  @keyframes rise-bar { from { transform: scaleY(0); } }
  .week .col.today .bar { background: var(--grad); box-shadow: 0 8px 22px -6px rgba(108,139,255,.7); }
  .week .val {
    position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--h) + 4px);
    font-size: 10px; font-weight: 700; color: var(--muted); white-space: nowrap;
  }
  .week .col.today .val { color: var(--text); }
  .week .day { font-size: 12px; font-weight: 600; color: var(--dim); }
  .week .col.today .day { color: var(--text); }

  /* Кольцевая диаграмма категорий */
  .donut-wrap { display: flex; align-items: center; gap: 18px; margin-bottom: 8px; }
  .donut { position: relative; width: 128px; height: 128px; flex: none; }
  .donut svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .donut circle { fill: none; stroke-width: 14; stroke-linecap: butt; }
  .donut .seg { animation: draw 1.1s var(--ease) both; }
  @keyframes draw { from { stroke-dasharray: 0 400; } }
  .donut .center {
    position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .donut .center .v { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .donut .center .k { font-size: 11px; color: var(--muted); font-weight: 600; }
  .legend { flex: 1; min-width: 0; }
  .legend .row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 0; }
  .legend .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .legend .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-weight: 600; }
  .legend .pct { font-weight: 700; font-variant-numeric: tabular-nums; }
  .cat-list { margin-top: 10px; }
  .cat-item { display: flex; align-items: center; margin-bottom: 12px; }
  .cat-item:last-child { margin-bottom: 0; }
  .cat-item .ico { width: 36px; height: 36px; border-radius: 12px; }
  .cat-item .ico svg { width: 18px; height: 18px; }

  /* Форма с голосовым вводом */
  .add-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .add-head h3 { margin: 0; }
  .mic-btn {
    position: relative; width: auto; display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 16px 9px 12px; border-radius: 999px; font-size: 14px;
  }
  .mic-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .mic-btn::before {
    content: ""; position: absolute; inset: -3px; border-radius: inherit; z-index: -1;
    background: var(--grad); opacity: .35; filter: blur(10px);
    animation: pulse 2.4s ease-in-out infinite;
  }
  @keyframes pulse { 50% { opacity: .7; transform: scale(1.05); } }
  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  .voice-back {
    position: fixed; inset: 0; z-index: 60;
    background: rgba(4,5,10,.6);
    -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
    display: flex; align-items: flex-end; justify-content: center;
    opacity: 0; pointer-events: none; transition: opacity .3s var(--ease);
  }
  .voice-back.open { opacity: 1; pointer-events: auto; }
  .voice-sheet {
    width: 100%; max-width: 480px;
    background: linear-gradient(180deg, rgba(28,28,48,.98), rgba(14,15,24,.98));
    border: 1px solid var(--border); border-bottom: none;
    border-radius: 32px 32px 0 0;
    padding: 14px 20px calc(26px + env(safe-area-inset-bottom));
    transform: translateY(100%); transition: transform .45s var(--ease);
    text-align: center;
  }
  .voice-back.open .voice-sheet { transform: none; }
  .voice-sheet .grip { width: 40px; height: 5px; border-radius: 3px; background: var(--card-3); margin: 0 auto 16px; }
  .voice-status { font-size: 15px; font-weight: 700; color: var(--muted); display: flex; align-items: center; justify-content: center; gap: 8px; }
  .voice-status .rec { width: 8px; height: 8px; border-radius: 50%; background: var(--danger); animation: blink 1.2s ease-in-out infinite; }
  @keyframes blink { 50% { opacity: .25; } }
  .eq { display: block; width: 100%; height: 150px; margin: 10px 0 6px; }
  .voice-text {
    min-height: 58px; font-size: 22px; font-weight: 700; letter-spacing: -.3px; line-height: 1.3;
    color: var(--text); margin-bottom: 6px; padding: 0 6px;
  }
  .voice-text .interim { color: var(--muted); }
  .voice-hint { font-size: 13px; color: var(--dim); margin-bottom: 18px; }
  .voice-actions { display: flex; gap: 10px; }
  .voice-actions button { flex: 1; }
  .stop-btn { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .stop-btn i { width: 12px; height: 12px; border-radius: 3px; background: #fff; display: inline-block; }
`;

export const FRIENDS_CSS = `
  .av {
    position: relative; width: 42px; height: 42px; flex: none;
    border-radius: 50%; overflow: hidden;
    background: var(--grad);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 17px; color: #fff;
    box-shadow: 0 6px 16px -6px rgba(108,139,255,.6);
  }
  .av img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .board-row .rank { width: 20px; }
  input[type="search"] { -webkit-appearance: none; appearance: none; }
  input[type="search"]::-webkit-search-cancel-button,
  input[type="search"]::-webkit-search-decoration { -webkit-appearance: none; display: none; }
`;

export const PROFILE_CSS = `
  .avatar-wrap { position: relative; width: 104px; height: 104px; margin: 0 auto 16px; }
  .avatar-wrap::before {
    content: ""; position: absolute; inset: -4px; border-radius: 50%;
    background: var(--grad); filter: blur(14px); opacity: .5;
  }
  .avatar-wrap .profile-avatar,
  .avatar-wrap img.avatar-img {
    position: relative;
    width: 104px; height: 104px; border-radius: 50%; margin: 0; display: flex;
    object-fit: cover; font-size: 40px;
    border: 3px solid rgba(255,255,255,.12);
  }
  .avatar-edit {
    position: absolute; right: -2px; bottom: -2px;
    width: 36px; height: 36px; border-radius: 50%;
    background: var(--grad); color: #fff;
    display: flex; align-items: center; justify-content: center;
    border: 3px solid var(--card-solid);
    cursor: pointer; margin: 0; padding: 0;
    transition: transform .25s var(--spring);
  }
  .avatar-edit svg {
    width: 18px; height: 18px; fill: none; stroke: currentColor;
    stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
  }
  .avatar-edit:active { transform: scale(0.88); }
  .avatar-remove {
    background: none; color: var(--muted); font-size: 13px; font-weight: 500; box-shadow: none;
    padding: 6px 12px; width: auto; display: inline-block; margin-top: -4px;
  }
  .token-box {
    background: var(--card-2); border: 1px solid var(--border); border-radius: 16px; padding: 14px 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px; word-break: break-all; user-select: all; -webkit-user-select: all;
    margin: 10px 0 12px; text-align: left;
  }
  .token-hint { color: var(--muted); font-size: 13px; line-height: 1.45; margin: 0 0 12px; }
  .row-btns { display: flex; gap: 10px; margin-bottom: 10px; }
  .row-btns > * { flex: 1; margin: 0; }
  .row-btns .btn, .row-btns button { padding: 13px 8px; font-size: 15px; }
  .btn-green { background: linear-gradient(135deg, #3ddc97, #22b07a); color: #062014; box-shadow: none; }

  .sheet-back {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(4,5,10,0.6);
    -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
    display: none; align-items: flex-end; justify-content: center;
  }
  .sheet-back.open { display: flex; }
  .sheet {
    width: 100%; max-width: 480px; max-height: 88vh; overflow-y: auto;
    background: var(--card-solid); border: 1px solid var(--border); border-bottom: none;
    border-radius: 28px 28px 0 0;
    padding: 12px 18px calc(24px + env(safe-area-inset-bottom));
    animation: slideup .4s var(--ease);
  }
  @keyframes slideup { from { transform: translateY(60px); opacity: 0; } to { transform: none; opacity: 1; } }
  .sheet-grip { width: 40px; height: 5px; border-radius: 3px; background: var(--card-3); margin: 0 auto 14px; }
  .sheet h3 { font-size: 20px; margin-bottom: 4px; }
  .sheet .sub { color: var(--muted); font-size: 14px; margin-bottom: 16px; }
  .step { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--sep); }
  .step:last-of-type { border-bottom: none; }
  .step .num {
    flex: none; width: 32px; height: 32px; border-radius: 50%;
    background: var(--grad);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 15px; color: #fff;
  }
  .step .t { font-weight: 700; font-size: 16px; margin-bottom: 3px; }
  .step .d { color: var(--muted); font-size: 14px; line-height: 1.45; }
  .step .d b { color: var(--text); font-weight: 600; }
  .tip {
    background: var(--card-2); border-radius: 16px; padding: 12px 14px;
    font-size: 13px; line-height: 1.45; color: var(--muted); margin-top: 6px;
  }
  .tip b { color: var(--text); }
`;

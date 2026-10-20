// Дизайн в духе iOS и Telegram: чистый чёрный фон, спокойные карточки, один акцентный цвет,
// системный шрифт Apple, плавные «пружинные» анимации и появление блоков при прокрутке.
export const BASE_CSS = `
  :root {
    --bg: #000;
    --surface: #121215;
    --surface-2: #1c1c1f;
    --fill: rgba(120, 120, 128, 0.16);
    --fill-2: rgba(120, 120, 128, 0.26);
    --hair: rgba(255, 255, 255, 0.06);
    --sep: rgba(84, 84, 88, 0.42);
    --text: #f5f5f7;
    --text-2: rgba(235, 235, 245, 0.6);
    --text-3: rgba(235, 235, 245, 0.3);
    --accent: #8e81ff;
    --accent-soft: rgba(142, 129, 255, 0.16);
    --grad: linear-gradient(135deg, #a194ff 0%, #6f8dff 50%, #4fd6c7 100%);
    --green: #30d158;
    --red: #ff453a;
    --gold: #ffd60a;
    --r-lg: 22px;
    --r-md: 14px;
    --ease: cubic-bezier(0.22, 1, 0.36, 1);
    --spring: cubic-bezier(0.34, 1.4, 0.5, 1);
    --sheet: cubic-bezier(0.32, 0.72, 0, 1);
    --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", "Segoe UI", Roboto, system-ui, sans-serif;
    /* совместимость со старыми именами */
    --muted: var(--text-2);
    --dim: var(--text-3);
    --card-2: var(--fill);
    --border: var(--hair);
    --danger: var(--red);
    --accent2: var(--green);
    color-scheme: dark;
  }
  @view-transition { navigation: auto; }
  ::view-transition-old(root) { animation: vt-out .2s var(--ease) both; }
  ::view-transition-new(root) { animation: vt-in .38s var(--ease) both; }
  @keyframes vt-out { to { opacity: 0; } }
  @keyframes vt-in { from { opacity: 0; transform: translateY(10px); } }

  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { background: var(--bg); -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
    font-family: var(--font); font-size: 17px; line-height: 1.35; letter-spacing: -0.2px;
    -webkit-font-smoothing: antialiased; overscroll-behavior-y: none;
  }
  a { color: var(--accent); text-decoration: none; }
  h1, h2, h3 { margin: 0; font-weight: 700; }
  h2 { font-size: 22px; letter-spacing: -0.4px; }
  h3 { font-size: 17px; font-weight: 600; letter-spacing: -0.3px; }
  ::selection { background: var(--accent-soft); }

  .wrap { max-width: 520px; margin: 0 auto; padding: 0 16px calc(120px + env(safe-area-inset-bottom)); }
  .center-wrap { max-width: 400px; margin: 0 auto; padding: 0 20px 40px; }

  /* ---------- навигация в стиле iOS: большой заголовок сворачивается в тонкую панель ---------- */
  .nav {
    position: sticky; top: 0; z-index: 20;
    margin: 0 -16px; padding: env(safe-area-inset-top) 16px 0;
    height: calc(48px + env(safe-area-inset-top));
    display: flex; align-items: center; justify-content: center;
    transition: background .3s ease, border-color .3s ease;
    border-bottom: 0.5px solid transparent;
  }
  .nav.compact {
    background: rgba(10, 10, 12, 0.72);
    -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
    border-bottom-color: var(--sep);
  }
  .nav-title {
    font-size: 17px; font-weight: 600; opacity: 0; transform: translateY(6px);
    transition: opacity .25s ease, transform .35s var(--ease);
  }
  .nav.compact .nav-title { opacity: 1; transform: none; }
  .nav-side { position: absolute; top: env(safe-area-inset-top); bottom: 0; display: flex; align-items: center; }
  .nav-side.right { right: 16px; }
  .nav-side.left { left: 16px; }
  .nav-back { gap: 6px; color: var(--accent); font-size: 17px; text-decoration: none; margin-left: -4px; transition: opacity .2s ease; }
  .nav-back svg { width: 11px; height: 19px; }
  .nav-back:active { opacity: .5; }
  .pill {
    display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; border-radius: 999px;
    font-size: 13px; font-weight: 600; background: var(--accent-soft); color: var(--accent);
  }
  .large-title {
    font-size: 34px; line-height: 41px; font-weight: 700; letter-spacing: 0.2px;
    margin: 2px 4px 2px;
  }
  .large-sub { color: var(--text-2); font-size: 15px; margin: 0 4px 18px; }
  .page-title { font-size: 34px; line-height: 41px; font-weight: 700; margin: 6px 4px 18px; }

  /* ---------- карточки, списки ---------- */
  .card {
    background: var(--surface); border-radius: var(--r-lg);
    padding: 18px 18px; margin-bottom: 14px;
    border: 0.5px solid var(--hair);
  }
  .card-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
  .card-head h3 { margin: 0; }
  .card-head .hint { font-size: 15px; color: var(--text-2); font-variant-numeric: tabular-nums; }
  .section-h { font-size: 13px; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.4px; margin: 22px 20px 7px; }
  .footnote { font-size: 13px; color: var(--text-2); margin: 8px 20px 18px; line-height: 1.4; }

  .list { background: var(--surface); border-radius: var(--r-lg); border: 0.5px solid var(--hair); overflow: hidden; margin-bottom: 14px; }
  .row {
    position: relative; display: flex; align-items: center; gap: 12px;
    min-height: 52px; padding: 8px 16px; color: var(--text);
    transition: background .2s ease;
  }
  /* Разделитель под каждой строкой списка, кроме последней (строки бывают вложены в формы) */
  .list .row::after {
    content: ""; position: absolute; bottom: 0; right: 0; left: var(--inset, 16px); height: 0.5px; background: var(--sep);
  }
  .list > .row:last-child::after, .list > :last-child > .row:last-child::after, .list > :last-child .row:only-child::after { display: none; }
  [hidden] { display: none !important; }
  a.row:active, button.row:active, label.row:active { background: var(--fill); }
  .row .grow { flex: 1; min-width: 0; }
  .row .value { color: var(--text-2); font-variant-numeric: tabular-nums; }
  .row .chev { width: 8px; height: 13px; flex: none; opacity: .35; }
  .row.danger { color: var(--red); }
  button.row { width: 100%; background: none; border: 0; font: inherit; text-align: left; cursor: pointer; border-radius: 0; box-shadow: none; }
  .sq {
    width: 30px; height: 30px; border-radius: 8px; flex: none; color: #fff;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .sq svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

  /* ---------- поля ввода ---------- */
  input, select, textarea {
    width: 100%; padding: 14px 16px; margin: 0 0 12px;
    border-radius: var(--r-md); border: 0; outline: none;
    background: var(--fill); color: var(--text);
    font: inherit; font-size: 17px; -webkit-appearance: none; appearance: none;
    transition: background .2s ease, box-shadow .25s ease;
  }
  input::placeholder { color: var(--text-3); }
  input:focus, select:focus { background: var(--fill-2); box-shadow: 0 0 0 3px var(--accent-soft); }
  input[type="date"] { min-height: 50px; }
  select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%23ebebf599' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 16px center; padding-right: 38px;
  }
  label { display: block; font-size: 13px; color: var(--text-2); margin: 0 0 6px 4px; }
  .filled { animation: filled 1.4s var(--ease); }
  @keyframes filled { 0%, 35% { box-shadow: 0 0 0 3px rgba(48, 209, 88, .55); } 100% { box-shadow: 0 0 0 3px rgba(48, 209, 88, 0); } }

  /* ---------- кнопки ---------- */
  button, .btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; min-height: 50px; padding: 0 18px; border: 0; border-radius: var(--r-md);
    font: inherit; font-size: 17px; font-weight: 600; letter-spacing: -0.3px; color: #fff;
    background: var(--accent); cursor: pointer;
    transition: transform .35s var(--spring), filter .2s ease, opacity .2s ease, background .2s ease;
  }
  button:active, .btn:active { transform: scale(0.97); filter: brightness(1.12); }
  button:disabled { opacity: .45; }
  .btn-secondary, .btn-gray { background: var(--fill); color: var(--text); }
  .btn-tinted { background: var(--accent-soft); color: var(--accent); }
  .btn-plain { background: none; color: var(--accent); min-height: 44px; }
  .btn-danger {
    width: auto; min-height: 30px; padding: 0 12px; border-radius: 999px;
    background: rgba(255, 69, 58, .14); color: var(--red); font-size: 14px;
  }
  .btn-icon { width: 30px; min-height: 30px; padding: 0; }
  .btn-icon svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2.6; stroke-linecap: round; }
  .btn-accept { background: var(--green); color: #00210b; }

  /* ---------- уведомления: капсула сверху, как в iOS ---------- */
  .toasts {
    position: fixed; z-index: 90; left: 0; right: 0; top: calc(10px + env(safe-area-inset-top));
    display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none;
  }
  .flash {
    display: flex; align-items: center; gap: 10px; max-width: calc(100% - 32px);
    padding: 11px 18px 11px 14px; border-radius: 999px; font-size: 15px; font-weight: 600;
    background: rgba(40, 40, 46, .86); color: var(--text);
    -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, .45), inset 0 0 0 0.5px rgba(255, 255, 255, .1);
    animation: toast-in .6s var(--spring) both; pointer-events: auto;
  }
  .flash::before { content: ""; width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .flash.success::before { background: var(--green); box-shadow: 0 0 10px var(--green); }
  .flash.error::before { background: var(--red); box-shadow: 0 0 10px var(--red); }
  .flash.hide { animation: toast-out .4s var(--ease) both; }
  @keyframes toast-in { from { opacity: 0; transform: translateY(-24px) scale(.9); } }
  @keyframes toast-out { to { opacity: 0; transform: translateY(-16px) scale(.94); } }

  /* ---------- плавное появление при прокрутке ---------- */
  .reveal { opacity: 0; transform: translateY(26px) scale(.985); transition: opacity .9s var(--ease), transform 1s var(--ease); transition-delay: var(--d, 0s); }
  .reveal.in { opacity: 1; transform: none; }
  .no-js .reveal { opacity: 1; transform: none; }

  /* ---------- значки категорий (без изменений) ---------- */
  .ico {
    width: 40px; height: 40px; border-radius: 12px; flex: none;
    display: inline-flex; align-items: center; justify-content: center;
    margin-right: 12px; color: #fff;
    background: linear-gradient(145deg, #8b9dff, #5b6cf0);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.22);
  }
  .ico svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
  .ico.green  { background: linear-gradient(145deg, #6ee7b0, #22b07a); }
  .ico.orange { background: linear-gradient(145deg, #ffb46b, #f0772e); }
  .ico.pink   { background: linear-gradient(145deg, #ff9cc2, #e8508a); }
  .ico.purple { background: linear-gradient(145deg, #c4a6ff, #8a5cf5); }
  .ico.red    { background: linear-gradient(145deg, #ff8f9e, #e5485f); }
  .ico.teal   { background: linear-gradient(145deg, #74e6dc, #1fb3a5); }
  .ico.yellow { background: linear-gradient(145deg, #ffdc7a, #eaa92a); }
  .ico.blue   { background: linear-gradient(145deg, #8fb4ff, #4a78f0); }
  .ico.slate  { background: linear-gradient(145deg, #a9b1c2, #5d6578); }

  /* ---------- записи ---------- */
  .expense-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; position: relative; }
  .expense-row + .expense-row::before { content: ""; position: absolute; top: 0; left: 52px; right: 0; height: 0.5px; background: var(--sep); }
  .expense-row .info { font-size: 17px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .expense-row .cat { color: var(--text-2); font-size: 14px; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .expense-row .amt { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .expense-row .main { display: flex; align-items: center; min-width: 0; flex: 1; }
  .expense-row .btn-danger { opacity: .55; }
  .day-label { font-size: 13px; font-weight: 600; color: var(--text-2); text-transform: uppercase; letter-spacing: .4px; margin: 16px 0 2px; }
  .day-label:first-of-type { margin-top: 6px; }

  .cat-bar { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .cat-bar .track { flex: 1; height: 6px; background: var(--fill); border-radius: 999px; overflow: hidden; }
  .cat-bar .fill { height: 100%; border-radius: 999px; background: var(--grad); transform-origin: left; transform: scaleX(0); transition: transform 1.2s var(--ease) .15s; }
  .in .cat-bar .fill, .cat-bar.in .fill { transform: none; }
  .footer-link { text-align: center; margin-top: 18px; font-size: 15px; color: var(--text-2); }

  .stat { background: var(--fill); border-radius: 16px; padding: 14px 8px; text-align: center; }
  .stat .value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat .label { font-size: 13px; color: var(--text-2); margin-top: 2px; }

  /* ---------- нижняя панель вкладок ---------- */
  .tabbar {
    position: fixed; z-index: 30; left: 16px; right: 16px; bottom: calc(12px + env(safe-area-inset-bottom));
    max-width: 488px; margin: 0 auto; height: 64px; padding: 6px;
    display: flex; gap: 2px; align-items: stretch;
    background: rgba(28, 28, 32, .72); border-radius: 999px;
    -webkit-backdrop-filter: saturate(180%) blur(24px); backdrop-filter: saturate(180%) blur(24px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, .55), inset 0 0 0 0.5px rgba(255, 255, 255, .12);
    view-transition-name: tabbar;
  }
  .tab {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    border-radius: 999px; color: var(--text-2); font-size: 10.5px; font-weight: 600; letter-spacing: 0;
    transition: color .3s ease, background .35s var(--ease), transform .35s var(--spring);
  }
  .tab:active { transform: scale(.9); }
  .tab .icon { display: flex; }
  .tab .icon svg { width: 25px; height: 25px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .tab.active { color: var(--accent); background: rgba(142, 129, 255, .14); }

  /* ---------- шторка снизу (как в iOS): открывается пружиной, смахивается вниз ---------- */
  .sheet-back {
    position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center;
    background: rgba(0, 0, 0, 0); pointer-events: none; transition: background .45s ease;
  }
  .sheet-back.open { background: rgba(0, 0, 0, .55); pointer-events: auto; }
  .sheet {
    width: 100%; max-width: 520px; max-height: 92vh; overflow-y: auto; overscroll-behavior: contain;
    background: var(--surface-2); border-radius: 28px 28px 0 0;
    padding: 8px 20px calc(24px + env(safe-area-inset-bottom));
    transform: translateY(105%); transition: transform .55s var(--sheet);
    box-shadow: 0 -10px 40px rgba(0, 0, 0, .4), inset 0 0.5px 0 rgba(255, 255, 255, .1);
  }
  .sheet-back.open .sheet { transform: translateY(var(--drag, 0px)); }
  .sheet.dragging { transition: none; }
  .grip { width: 36px; height: 5px; border-radius: 3px; background: var(--fill-2); margin: 0 auto 14px; }
  .sheet h3 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .sheet .sub { color: var(--text-2); font-size: 15px; margin-bottom: 14px; }

  .seg {
    position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
    padding: 2px; margin-bottom: 16px; border-radius: 10px; background: var(--fill);
  }
  .seg a { position: relative; z-index: 1; text-align: center; padding: 7px 0; font-size: 14px; font-weight: 600; color: var(--text); }
  .seg-thumb {
    position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / var(--n));
    border-radius: 8px; background: #636366; box-shadow: 0 3px 8px rgba(0,0,0,.25);
    transform: translateX(calc(var(--i) * 100%)); transition: transform .45s var(--spring);
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; }
    .reveal { opacity: 1; transform: none; }
  }
`;

// Главная: виджеты, быстрые действия, голосовой ввод и сканер
export const DASHBOARD_CSS = `
  .hero {
    position: relative; overflow: hidden; padding: 20px 20px 18px;
    background:
      radial-gradient(90% 120% at 100% 0%, rgba(79, 214, 199, .16), transparent 60%),
      radial-gradient(100% 120% at 0% 100%, rgba(142, 129, 255, .26), transparent 62%),
      var(--surface);
    transform: scale(calc(1 - var(--sp, 0) * .04)); opacity: calc(1 - var(--sp, 0) * .35);
    transform-origin: top center; will-change: transform;
  }
  .hero .label { font-size: 15px; color: var(--text-2); font-weight: 500; }
  .hero .big { font-size: 52px; font-weight: 700; letter-spacing: -2px; line-height: 1.05; margin: 6px 0 18px; font-variant-numeric: tabular-nums; }
  .hero .big .cur { font-size: 28px; font-weight: 600; color: var(--text-2); margin-left: 6px; letter-spacing: 0; }
  .hero .chips { display: flex; gap: 10px; }
  .chip { flex: 1; padding: 11px 13px; border-radius: 16px; background: rgba(255, 255, 255, .06); }
  .chip .k { font-size: 13px; color: var(--text-2); }
  .chip .v { font-size: 18px; font-weight: 600; margin-top: 1px; font-variant-numeric: tabular-nums; }

  /* Быстрые действия под карточкой */
  .actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 0 14px; }
  .action {
    display: flex; flex-direction: column; align-items: center; gap: 8px; min-height: 0;
    padding: 14px 6px 12px; border-radius: 20px; background: var(--surface); border: 0.5px solid var(--hair);
    color: var(--text); font-size: 13px; font-weight: 600;
  }
  .action .ring {
    width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--accent-soft); color: var(--accent);
  }
  .action .ring svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .action.voice .ring { background: var(--grad); color: #fff; box-shadow: 0 6px 20px -6px rgba(111, 141, 255, .8); }

  /* Форма добавления: сумма крупно, как в Apple Pay, остальное — строками */
  .amount-wrap { display: flex; align-items: baseline; justify-content: center; gap: 6px; padding: 6px 0 14px; }
  .amount-input {
    width: 3.2ch; min-width: 1.4ch; max-width: 100%; padding: 0; margin: 0; background: none !important; box-shadow: none !important;
    font-size: 54px; font-weight: 700; letter-spacing: -2px; text-align: right; caret-color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
  .amount-cur { font-size: 30px; font-weight: 600; color: var(--text-2); }
  .form-rows { background: var(--fill); border-radius: 16px; margin-bottom: 14px; overflow: hidden; }
  .form-row { position: relative; display: flex; align-items: center; gap: 10px; min-height: 50px; padding: 0 6px 0 16px; margin: 0; font-size: 17px; color: var(--text); }
  .form-row + .form-row::before { content: ""; position: absolute; top: 0; left: 16px; right: 0; height: 0.5px; background: var(--sep); }
  .form-row > span { color: var(--text-2); font-size: 16px; width: 96px; flex: none; }
  .form-row input, .form-row select {
    margin: 0; padding: 13px 10px 13px 0; background: none !important; box-shadow: none !important; border-radius: 0;
    text-align: right; text-align-last: right; color: var(--text);
  }
  .form-row select { background-position: right 10px center !important; padding-right: 32px; }
  .form-row .loc {
    width: 36px; min-height: 36px; padding: 0; flex: none; border-radius: 50%; background: var(--accent-soft); color: var(--accent);
  }
  .form-row .loc svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .store-chips { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 12px; margin: -4px 0 4px; scrollbar-width: none; }
  .store-chips::-webkit-scrollbar { display: none; }
  .store-chips:empty { display: none; }

  .schip {
    flex: none; display: inline-flex; align-items: center; gap: 8px; width: auto; min-height: 36px;
    padding: 0 14px 0 6px; border-radius: 999px; background: var(--fill); color: var(--text);
    font-size: 15px; font-weight: 500; animation: chip-in .5s var(--spring) both; animation-delay: var(--d, 0s);
  }
  .schip .logo { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: 700; }
  .schip small { color: var(--text-2); font-size: 13px; font-weight: 500; }
  .schip.on { background: var(--accent); color: #fff; }
  .schip.on small { color: rgba(255,255,255,.75); }
  .schip.skeleton { width: 120px; background: linear-gradient(90deg, var(--fill) 0%, var(--fill-2) 50%, var(--fill) 100%); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
  @keyframes shimmer { to { background-position: -200% 0; } }
  @keyframes chip-in { from { opacity: 0; transform: translateX(14px) scale(.92); } }

  /* График за 7 дней */
  .week { display: flex; align-items: flex-end; gap: 8px; height: 132px; padding-top: 20px; }
  .week .col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end; }
  .week .bar-wrap { position: relative; width: 100%; flex: 1; display: flex; align-items: flex-end; }
  .week .bar {
    width: 100%; min-height: 6px; border-radius: 8px; background: rgba(142, 129, 255, .55);
    transform-origin: bottom; transform: scaleY(0); transition: transform .9s var(--spring); transition-delay: calc(var(--k, 0) * 45ms + .1s);
  }
  .in .week .bar { transform: none; }
  .week .col.today .bar { background: var(--grad); }
  .week .val {
    position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--h) + 5px);
    font-size: 11px; font-weight: 600; color: var(--text-2); white-space: nowrap; opacity: 0; transition: opacity .5s ease .6s;
  }
  .in .week .val { opacity: 1; }
  .week .col.today .val { color: var(--text); }
  .week .day { font-size: 12px; font-weight: 600; color: var(--text-3); }
  .week .col.today .day { color: var(--text); }

  /* Кольцевая диаграмма */
  .donut-wrap { display: flex; align-items: center; gap: 18px; margin-bottom: 14px; }
  .donut { position: relative; width: 128px; height: 128px; flex: none; }
  .donut svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .donut circle { fill: none; stroke-width: 14; }
  .donut .seg { stroke-dasharray: 0 400; transition: stroke-dasharray 1.3s var(--ease) .15s; }
  .in .donut .seg { stroke-dasharray: var(--dash); }
  .donut .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .donut .center .v { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .donut .center .k { font-size: 12px; color: var(--text-2); }
  .legend { flex: 1; min-width: 0; }
  .legend .row { min-height: 0; padding: 4px 0; gap: 8px; font-size: 14px; }
  .legend .row + .row::before { display: none; }
  .legend .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .legend .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); }
  .legend .pct { font-weight: 600; font-variant-numeric: tabular-nums; }
  .cat-item { display: flex; align-items: center; margin-bottom: 12px; }
  .cat-item:last-child { margin-bottom: 0; }
  .cat-item .ico { width: 36px; height: 36px; border-radius: 11px; }
  .cat-item .ico svg { width: 18px; height: 18px; }
  .cat-item .top { display: flex; justify-content: space-between; margin-bottom: 7px; font-size: 16px; font-weight: 500; }
  .cat-item .top span:last-child { font-variant-numeric: tabular-nums; }

  /* Голосовой ввод */
  .voice-status { font-size: 15px; font-weight: 600; color: var(--text-2); display: flex; align-items: center; justify-content: center; gap: 8px; }
  .voice-status .rec { width: 8px; height: 8px; border-radius: 50%; background: var(--red); animation: blink 1.2s ease-in-out infinite; }
  @keyframes blink { 50% { opacity: .25; } }
  .eq { display: block; width: 100%; height: 140px; margin: 10px 0 6px; }
  .voice-text { min-height: 58px; font-size: 24px; font-weight: 600; letter-spacing: -.5px; line-height: 1.25; text-align: center; padding: 0 6px; margin-bottom: 6px; }
  .voice-text .interim { color: var(--text-2); }
  .voice-hint { font-size: 14px; color: var(--text-3); text-align: center; margin-bottom: 18px; }
  .sheet-actions { display: flex; gap: 10px; }
  .sheet-actions button { flex: 1; }
  .stop-btn i { width: 12px; height: 12px; border-radius: 3px; background: #fff; display: inline-block; }

  /* Сканер штрих-кодов */
  .scan-sheet { padding-top: 8px; }
  .viewfinder {
    position: relative; overflow: hidden; border-radius: 24px; background: #050506;
    aspect-ratio: 4 / 3; margin-bottom: 14px; transition: aspect-ratio .6s var(--ease), height .6s var(--ease);
  }
  .viewfinder.done { aspect-ratio: 16 / 7; }
  .viewfinder video, .viewfinder .snap { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .viewfinder.done .snap { filter: brightness(.8); transition: filter .6s ease; }
  .viewfinder .frame {
    position: absolute; left: 14%; right: 14%; top: 26%; bottom: 26%; border-radius: 18px;
    box-shadow: 0 0 0 999px rgba(0, 0, 0, .38); transition: all .5s var(--spring);
  }
  .viewfinder .frame::before {
    content: ""; position: absolute; inset: -2px; border-radius: 20px; border: 3px solid #fff;
    -webkit-mask: linear-gradient(#000 0 0) top left / 28px 28px no-repeat, linear-gradient(#000 0 0) top right / 28px 28px no-repeat,
                  linear-gradient(#000 0 0) bottom left / 28px 28px no-repeat, linear-gradient(#000 0 0) bottom right / 28px 28px no-repeat;
            mask: linear-gradient(#000 0 0) top left / 28px 28px no-repeat, linear-gradient(#000 0 0) top right / 28px 28px no-repeat,
                  linear-gradient(#000 0 0) bottom left / 28px 28px no-repeat, linear-gradient(#000 0 0) bottom right / 28px 28px no-repeat;
    transition: border-color .3s ease;
  }
  .viewfinder .line {
    position: absolute; left: 16%; right: 16%; height: 2px; top: 30%; border-radius: 2px;
    background: linear-gradient(90deg, transparent, #4fd6c7, #a194ff, transparent);
    box-shadow: 0 0 16px 2px rgba(111, 141, 255, .7); animation: scanline 2.2s ease-in-out infinite;
  }
  @keyframes scanline { 50% { top: 70%; } }
  .viewfinder.hit .frame { left: 8%; right: 8%; top: 12%; bottom: 12%; }
  .viewfinder.hit .frame::before { border-color: var(--green); }
  .viewfinder.hit .line, .viewfinder.done .line { opacity: 0; }
  /* Рамка, линия и подпись не перехватывают касания — иначе кнопку вспышки не нажать */
  .viewfinder .frame, .viewfinder .line, .viewfinder .vf-msg, .viewfinder .snap { pointer-events: none; }
  .vf-btn {
    position: absolute; z-index: 3; top: 12px; right: 12px; width: 42px; min-height: 42px; padding: 0; border-radius: 50%;
    background: rgba(0, 0, 0, .45); color: #fff; -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
    transition: background .25s ease, color .25s ease, transform .35s var(--spring);
  }
  .vf-btn svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .vf-btn.on { background: #ffd60a; color: #000; box-shadow: 0 0 24px rgba(255, 214, 10, .6); }
  .viewfinder.done .vf-btn { opacity: 0; pointer-events: none; }
  .viewfinder .vf-msg {
    position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
    padding: 7px 14px; border-radius: 999px; font-size: 14px; font-weight: 600; white-space: nowrap;
    background: rgba(0, 0, 0, .55); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  }
  .viewfinder .vf-msg:empty { display: none; }
  .product {
    display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 18px; background: var(--fill);
    margin-bottom: 14px; animation: rise-in .6s var(--spring) both;
  }
  .product .pic { width: 56px; height: 56px; border-radius: 12px; flex: none; background: #fff center / contain no-repeat; }
  .product .pic.none { background: var(--grad); display: flex; align-items: center; justify-content: center; }
  .product .pic.none svg { width: 26px; height: 26px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; }
  .product .pn { font-size: 17px; font-weight: 600; line-height: 1.25; }
  .product .pb { font-size: 14px; color: var(--text-2); margin-top: 2px; }
  .prices { font-size: 14px; color: var(--text-2); margin: -4px 4px 14px; line-height: 1.5; animation: rise-in .6s var(--spring) .08s both; }
  .prices b { color: var(--text); font-weight: 600; }
  .scan-step { animation: rise-in .6s var(--spring) both; animation-delay: var(--d, 0s); }
  .scan-step > label { margin-top: 4px; }
  @keyframes rise-in { from { opacity: 0; transform: translateY(14px); } }
  .manual-code { display: flex; gap: 8px; }
  .manual-code input { margin: 0; }
  .manual-code button { width: auto; flex: none; }
  .photo-ask { margin: 10px 0 4px; }
  .photo-ask button { width: 100%; }
  .photo-msg { margin-top: 8px; font-size: 13px; line-height: 1.4; color: var(--text-2); text-align: center; }
  .photo-msg.bad { color: var(--red); }
`;

export const FRIENDS_CSS = `
  .av {
    position: relative; width: 42px; height: 42px; flex: none; border-radius: 50%; overflow: hidden;
    background: var(--grad); display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 17px; color: #fff;
  }
  .av img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .board-row { position: relative; display: flex; align-items: center; gap: 12px; padding: 10px 0; }
  .board-row + .board-row::before { content: ""; position: absolute; top: 0; left: 86px; right: 0; height: 0.5px; background: var(--sep); }
  .board-row .rank { width: 20px; text-align: center; font-weight: 700; color: var(--text-3); font-variant-numeric: tabular-nums; }
  .board-row.rank-1 .rank { color: var(--gold); }
  .board-row .name { flex: 1; font-size: 17px; font-weight: 500; }
  .board-row.me .name { color: var(--accent); }
  .board-row .amount { font-weight: 600; font-variant-numeric: tabular-nums; }
  a.board-row { color: inherit; text-decoration: none; margin: 0 -18px; padding: 10px 18px; -webkit-tap-highlight-color: transparent; transition: background .2s ease; }
  a.board-row:active { background: var(--fill); }
  a.board-row + a.board-row::before { left: 104px; right: 18px; }
  .board-row .chev { width: 8px; height: 13px; flex: none; opacity: .35; margin-left: -2px; }
  .friend-req-row { position: relative; display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 0; }
  .friend-req-row + .friend-req-row::before { content: ""; position: absolute; top: 0; left: 54px; right: 0; height: 0.5px; background: var(--sep); }
  .req-actions { display: flex; gap: 8px; }
  .req-actions button { width: auto; min-height: 34px; padding: 0 14px; font-size: 15px; border-radius: 999px; }
  input[type="search"]::-webkit-search-cancel-button, input[type="search"]::-webkit-search-decoration { -webkit-appearance: none; display: none; }
  .add-friend { display: flex; gap: 8px; }
  .add-friend input { margin: 0; }
  .add-friend button { width: auto; flex: none; padding: 0 18px; }
`;

export const PROFILE_CSS = `
  .profile-head { text-align: center; padding: 8px 0 18px; }
  .avatar-wrap { position: relative; width: 108px; height: 108px; margin: 0 auto 14px; }
  .avatar-wrap .profile-avatar, .avatar-wrap img.avatar-img {
    width: 108px; height: 108px; border-radius: 50%; margin: 0; display: flex; align-items: center; justify-content: center;
    object-fit: cover; font-size: 44px; font-weight: 700; color: #fff; background: var(--grad);
  }
  .avatar-edit {
    position: absolute; right: -2px; bottom: -2px; width: 34px; height: 34px; border-radius: 50%; margin: 0; padding: 0;
    background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center;
    border: 3px solid var(--bg); cursor: pointer; transition: transform .35s var(--spring);
  }
  .avatar-edit svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .avatar-edit:active { transform: scale(.88); }
  .profile-head h2 { font-size: 28px; letter-spacing: -0.6px; }
  .profile-head .since { color: var(--text-2); font-size: 15px; margin-top: 2px; }
  .avatar-remove { width: auto; min-height: 32px; margin: 4px auto 0; background: none; color: var(--accent); font-size: 15px; font-weight: 500; }
  .profile-stats { display: grid; grid-template-columns: repeat(3, 1fr); padding: 6px 0; }
  .profile-stats > div { text-align: center; padding: 6px 4px; position: relative; }
  .profile-stats > div + div::before { content: ""; position: absolute; left: 0; top: 18%; bottom: 18%; width: 0.5px; background: var(--sep); }
  .profile-stats .value { font-size: 20px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
  .profile-stats .label { font-size: 13px; color: var(--text-2); margin-top: 2px; }
  .token-box {
    background: var(--fill); border-radius: 14px; padding: 13px 15px; margin: 12px 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; word-break: break-all; user-select: all; -webkit-user-select: all;
  }
  .token-hint { color: var(--text-2); font-size: 15px; line-height: 1.4; margin: 4px 0 12px; }
  .row-btns { display: flex; gap: 10px; margin-bottom: 10px; }
  .row-btns > * { flex: 1; margin: 0; }
  .btn-green { background: var(--green); color: #00210b; }
  .step { display: flex; gap: 14px; padding: 13px 0; position: relative; }
  .step + .step::before { content: ""; position: absolute; top: 0; left: 46px; right: 0; height: 0.5px; background: var(--sep); }
  .step .num { flex: none; width: 32px; height: 32px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; }
  .step .t { font-weight: 600; margin-bottom: 2px; }
  .step .d { color: var(--text-2); font-size: 15px; line-height: 1.4; }
  .step .d b { color: var(--text); font-weight: 600; }
  .tip { background: var(--fill); border-radius: 14px; padding: 12px 14px; font-size: 14px; line-height: 1.45; color: var(--text-2); margin-top: 8px; }
  .tip b { color: var(--text); }
`;

export const SETTINGS_CSS = `
  details.row-group > summary { list-style: none; }
  details.row-group > summary::-webkit-details-marker { display: none; }
  details.row-group .chev { transition: transform .35s var(--spring); }
  details.row-group[open] .chev { transform: rotate(90deg); }
  .expand { padding: 4px 16px 16px; animation: rise-in .5s var(--spring) both; }
  @keyframes rise-in { from { opacity: 0; transform: translateY(-6px); } }
  .row select.overlay { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
`;

// Страница-презентация для тех, кто ещё не вошёл
export const LANDING_CSS = `
  body { overflow-x: hidden; }
  .l-nav {
    position: fixed; z-index: 40; top: 0; left: 0; right: 0; height: calc(52px + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 20px 0; display: flex; align-items: center; justify-content: space-between;
    background: rgba(0, 0, 0, .6); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
    border-bottom: 0.5px solid var(--sep);
  }
  .l-logo { display: flex; align-items: center; gap: 9px; font-weight: 600; font-size: 17px; color: var(--text); }
  .l-logo i { width: 26px; height: 26px; border-radius: 7px; background: var(--grad); display: inline-flex; align-items: center; justify-content: center; }
  .l-logo i svg { width: 16px; height: 16px; fill: none; stroke: #fff; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .l-nav .pill { background: var(--fill); color: var(--text); height: 30px; padding: 0 14px; font-size: 14px; }
  .l-wrap { max-width: 980px; margin: 0 auto; padding: 0 22px; }
  .l-hero { display: flex; flex-direction: column; align-items: center; text-align: center; padding: calc(96px + env(safe-area-inset-top)) 0 30px; }
  .eyebrow { font-size: 17px; font-weight: 600; background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 12px; }
  .l-h1 { font-size: clamp(48px, 12vw, 96px); line-height: 1.02; letter-spacing: -0.04em; font-weight: 700; margin: 0 0 18px; }
  .l-h1 .g { background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .l-lead { font-size: clamp(19px, 4.6vw, 24px); line-height: 1.35; color: var(--text-2); max-width: 620px; margin: 0 auto 30px; letter-spacing: -0.3px; }
  .l-ctas { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  .l-ctas .btn { width: auto; padding: 0 26px; border-radius: 999px; min-height: 48px; }
  .l-ctas .btn-plain { padding: 0 10px; }
  .device {
    width: min(360px, 88vw); margin: 44px auto 0; padding: 20px; border-radius: 34px; text-align: left;
    background: var(--surface); border: 0.5px solid var(--hair);
    box-shadow: 0 40px 120px -30px rgba(111, 141, 255, .45), 0 0 0 10px #0b0b0d, 0 0 0 11px rgba(255,255,255,.08);
    transform: perspective(1200px) rotateX(calc(18deg - var(--p, 0) * 18deg)) scale(calc(.92 + var(--p, 0) * .08));
    transform-origin: top center; will-change: transform;
  }
  .device .hero { transform: none; opacity: 1; margin: 0; }
  .l-sec { padding: 80px 0; }
  .l-h2 { font-size: clamp(38px, 9vw, 72px); line-height: 1.05; letter-spacing: -0.035em; font-weight: 700; margin: 0 0 18px; }
  .l-p { font-size: clamp(19px, 4.4vw, 24px); line-height: 1.4; color: var(--text-2); max-width: 640px; letter-spacing: -0.3px; }
  .scrub { font-size: clamp(30px, 7.4vw, 56px); line-height: 1.15; letter-spacing: -0.03em; font-weight: 700; max-width: 900px; }
  .scrub span { color: var(--text-3); transition: color .35s ease; }
  .scrub span.lit { color: var(--text); }
  .scrub span.lit.g { background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .showcase { margin-top: 44px; display: grid; gap: 14px; }
  @media (min-width: 760px) { .showcase.two { grid-template-columns: 1fr 1fr; } }
  .tile { background: var(--surface); border: 0.5px solid var(--hair); border-radius: 28px; padding: 26px; overflow: hidden; position: relative; }
  .tile h4 { margin: 0 0 6px; font-size: 22px; letter-spacing: -0.4px; }
  .tile p { margin: 0; color: var(--text-2); font-size: 16px; line-height: 1.4; }
  .bubble { display: inline-block; padding: 10px 16px; border-radius: 20px 20px 6px 20px; background: var(--accent); font-size: 17px; font-weight: 500; margin: 6px 0 14px; }
  .mini-eq { display: flex; align-items: center; justify-content: center; gap: 5px; height: 90px; margin: 10px 0 14px; }
  .mini-eq i { width: 7px; border-radius: 4px; background: linear-gradient(180deg, #a194ff, #4fd6c7); animation: eqb 1.1s ease-in-out infinite; animation-delay: calc(var(--k) * -0.13s); height: 20%; }
  @keyframes eqb { 50% { height: calc(25% + var(--a) * 1%); } }
  .mock-vf { position: relative; height: 190px; border-radius: 22px; background: radial-gradient(120% 120% at 50% 40%, #26262c, #0b0b0d); margin: 6px 0 16px; overflow: hidden; }
  .mock-vf .bars { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; gap: 3px; height: 70px; }
  .mock-vf .bars i { background: #f2f2f2; width: var(--w); height: 100%; border-radius: 1px; }
  .mock-vf .line { position: absolute; left: 18%; right: 18%; top: 30%; height: 2px; background: linear-gradient(90deg, transparent, #4fd6c7, #a194ff, transparent); box-shadow: 0 0 16px 2px rgba(111,141,255,.7); animation: scanline 2.2s ease-in-out infinite; }
  @keyframes scanline { 50% { top: 70%; } }
  .mock-vf .frame { position: absolute; left: 16%; right: 16%; top: 20%; bottom: 20%; border-radius: 18px; border: 3px solid rgba(255,255,255,.9);
    -webkit-mask: linear-gradient(#000 0 0) top left / 26px 26px no-repeat, linear-gradient(#000 0 0) top right / 26px 26px no-repeat, linear-gradient(#000 0 0) bottom left / 26px 26px no-repeat, linear-gradient(#000 0 0) bottom right / 26px 26px no-repeat;
            mask: linear-gradient(#000 0 0) top left / 26px 26px no-repeat, linear-gradient(#000 0 0) top right / 26px 26px no-repeat, linear-gradient(#000 0 0) bottom left / 26px 26px no-repeat, linear-gradient(#000 0 0) bottom right / 26px 26px no-repeat; }
  .l-cta { text-align: center; padding: 120px 0 calc(80px + env(safe-area-inset-bottom)); }
  .l-foot { text-align: center; color: var(--text-3); font-size: 13px; padding-bottom: 40px; }
`;

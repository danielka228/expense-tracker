// Общие стили (перенесены без изменений из base.html)
export const BASE_CSS = `
  :root {
    --bg: #000000;
    --card: #1c1c1e;
    --card-2: #2c2c2e;
    --sep: rgba(255,255,255,0.08);
    --text: #ffffff;
    --muted: #8e8e93;
    --accent: #5b9dff;
    --accent2: #5fd68a;
    --danger: #ff7a7a;
    --gold: #ffd166;
    --radius: 22px;
    --font: ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
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
  }
  .wrap { max-width: 480px; margin: 0 auto; padding: 24px 16px 130px; }
  .center-wrap { max-width: 380px; margin: 10vh auto; padding: 0 20px; }
  h1, h2, h3 { margin: 0 0 8px; font-weight: 700; letter-spacing: -0.2px; }

  .brand {
    font-weight: 800; font-size: 28px; letter-spacing: -0.5px;
    text-align: center; margin-bottom: 28px; color: var(--text);
  }

  .card {
    background: var(--card);
    border-radius: var(--radius);
    padding: 18px 20px;
    margin-bottom: 14px;
  }

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
    transition: border-color .2s ease;
  }
  input::placeholder { color: var(--muted); }
  input:focus, select:focus { outline: none; border-color: var(--accent); }
  label { font-size: 13px; color: var(--muted); display: block; margin: 0 0 6px 4px; }
  button, .btn {
    display: block;
    width: 100%;
    padding: 14px;
    border-radius: 16px;
    border: none;
    font-family: var(--font);
    font-weight: 700;
    font-size: 16px;
    text-align: center;
    cursor: pointer;
    background: var(--accent);
    color: #fff;
    transition: transform .12s ease, opacity .12s ease;
  }
  button:active, .btn:active { transform: scale(0.97); opacity: 0.9; }
  .btn-secondary { background: var(--card-2); color: var(--text); }
  .btn-danger {
    background: rgba(255,122,122,0.14); color: var(--danger); border: none;
    font-weight: 600; padding: 7px 14px; width: auto; font-size: 13px; border-radius: 999px;
  }
  a { color: var(--accent); text-decoration: none; }

  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
  .stat { background: var(--card); border-radius: 20px; padding: 16px 8px; text-align: center; }
  .stat .value { font-size: 19px; font-weight: 800; color: var(--text); }
  .stat .label { font-size: 12px; color: var(--muted); margin-top: 4px; }

  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .topbar .hi { font-size: 15px; color: var(--muted); }

  .flash { padding: 12px 16px; border-radius: 16px; margin-bottom: 14px; font-size: 14px; }
  .flash.success { background: rgba(95,214,138,0.14); color: var(--accent2); }
  .flash.error { background: rgba(255,122,122,0.14); color: var(--danger); }

  .expense-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 0; border-bottom: 1px solid var(--sep);
  }
  .expense-row:last-child { border-bottom: none; }
  .expense-row .info { font-size: 15px; font-weight: 600; }
  .expense-row .cat { color: var(--muted); font-size: 12px; font-weight: 400; margin-top: 2px; }
  .expense-row .amt { font-weight: 700; }

  .ico {
    width: 38px; height: 38px; border-radius: 12px; flex: none;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 19px; margin-right: 12px;
    background: linear-gradient(145deg, #7aa8ff, #4a7fe0);
  }
  .ico.green  { background: linear-gradient(145deg, #7ee3a0, #3fb868); }
  .ico.orange { background: linear-gradient(145deg, #ffb877, #f08a3c); }
  .ico.pink   { background: linear-gradient(145deg, #ff9db8, #ee6590); }
  .ico.purple { background: linear-gradient(145deg, #c3a2ff, #8f6af0); }
  .ico.red    { background: linear-gradient(145deg, #ff8f8f, #e65454); }
  .ico.teal   { background: linear-gradient(145deg, #7fe0e0, #3ab5b5); }
  .ico.yellow { background: linear-gradient(145deg, #ffe08a, #f2b83a); }

  .cat-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 14px; }
  .cat-bar .track { flex: 1; height: 8px; background: var(--card-2); border-radius: 999px; overflow: hidden; }
  .cat-bar .fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #7aa8ff, #5fd68a); }
  .footer-link { text-align: center; margin-top: 16px; font-size: 14px; color: var(--muted); }

  .tabbar {
    position: fixed;
    left: 14px; right: 14px;
    bottom: calc(14px + env(safe-area-inset-bottom));
    max-width: 452px; margin: 0 auto;
    height: 68px;
    display: flex; justify-content: space-between; align-items: center;
    gap: 4px; padding: 6px;
    background: rgba(28,28,30,0.78);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    z-index: 10;
  }
  .tab {
    flex: 1; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    color: var(--muted);
    font-size: 11px; font-weight: 600;
    border-radius: 999px;
    transition: background .2s ease, color .2s ease;
  }
  .tab .icon { display: flex; line-height: 1; }
  .tab .icon svg {
    width: 24px; height: 24px; fill: none; stroke: currentColor;
    stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round;
  }
  .tab.active { color: var(--accent); background: rgba(255,255,255,0.09); }

  .period-switch {
    display: flex; gap: 4px; padding: 4px; margin-bottom: 16px;
    background: var(--card); border-radius: 999px;
  }
  .period-switch a {
    flex: 1; text-align: center; padding: 9px 0; border-radius: 999px;
    color: var(--muted); font-size: 14px; font-weight: 600;
    transition: background .2s ease, color .2s ease;
  }
  .period-switch a.active { background: var(--card-2); color: var(--text); }

  .board-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 0; border-bottom: 1px solid var(--sep);
  }
  .board-row:last-child { border-bottom: none; }
  .board-row .rank { width: 24px; text-align: center; font-weight: 800; color: var(--muted); }
  .board-row.rank-1 .rank { color: var(--gold); }
  .board-row .name { flex: 1; font-size: 16px; font-weight: 600; }
  .board-row.me .name { color: var(--accent); }
  .board-row .amount { font-weight: 800; }

  .friend-req-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--sep); }
  .friend-req-row:last-child { border-bottom: none; }
  .req-actions { display: flex; gap: 8px; }
  .req-actions button { width: auto; padding: 8px 16px; font-size: 14px; border-radius: 999px; }
  .btn-accept { background: var(--accent2); color: #0b2415; }

  .profile-avatar {
    width: 84px; height: 84px; border-radius: 50%;
    background: linear-gradient(145deg, #7aa8ff, #c3a2ff);
    display: flex; align-items: center; justify-content: center;
    font-size: 32px; font-weight: 800; color: #fff;
    margin: 0 auto 14px;
  }
  .profile-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0; }

  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; }
  }
`;

export const FRIENDS_CSS = `
  .av {
    position: relative; width: 42px; height: 42px; flex: none;
    border-radius: 50%; overflow: hidden;
    background: linear-gradient(145deg, #7aa8ff, #c3a2ff);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 17px; color: #fff;
  }
  .av img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .board-row .rank { width: 20px; }
  input[type="search"] { -webkit-appearance: none; appearance: none; }
  input[type="search"]::-webkit-search-cancel-button,
  input[type="search"]::-webkit-search-decoration { -webkit-appearance: none; display: none; }
`;

export const PROFILE_CSS = `
  .avatar-wrap { position: relative; width: 104px; height: 104px; margin: 0 auto 16px; }
  .avatar-wrap .profile-avatar,
  .avatar-wrap img.avatar-img {
    width: 104px; height: 104px; border-radius: 50%; margin: 0; display: flex;
    object-fit: cover; font-size: 40px;
  }
  .avatar-edit {
    position: absolute; right: -2px; bottom: -2px;
    width: 36px; height: 36px; border-radius: 50%;
    background: var(--accent); color: #fff;
    display: flex; align-items: center; justify-content: center;
    border: 3px solid var(--card);
    cursor: pointer; margin: 0; padding: 0;
  }
  .avatar-edit svg {
    width: 18px; height: 18px; fill: none; stroke: currentColor;
    stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
  }
  .avatar-edit:active { transform: scale(0.92); }
  .avatar-remove {
    background: none; color: var(--muted); font-size: 13px; font-weight: 500;
    padding: 6px 12px; width: auto; display: inline-block; margin-top: -4px;
  }
  .token-box {
    background: var(--card-2); border-radius: 16px; padding: 14px 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px; word-break: break-all; user-select: all; -webkit-user-select: all;
    margin: 10px 0 12px; text-align: left;
  }
  .token-hint { color: var(--muted); font-size: 13px; line-height: 1.45; margin: 0 0 12px; }
  .row-btns { display: flex; gap: 10px; margin-bottom: 10px; }
  .row-btns > * { flex: 1; margin: 0; }
  .row-btns .btn, .row-btns button { padding: 13px 8px; font-size: 15px; }
  .btn-green { background: var(--accent2); color: #0b2415; }

  /* Instruction sheet */
  .sheet-back {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(0,0,0,0.6);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
    display: none; align-items: flex-end; justify-content: center;
  }
  .sheet-back.open { display: flex; }
  .sheet {
    width: 100%; max-width: 480px; max-height: 88vh; overflow-y: auto;
    background: var(--card); border-radius: 28px 28px 0 0;
    padding: 12px 18px calc(24px + env(safe-area-inset-bottom));
    animation: slideup .25s ease;
  }
  @keyframes slideup { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
  .sheet-grip { width: 40px; height: 5px; border-radius: 3px; background: var(--card-2); margin: 0 auto 14px; }
  .sheet h3 { font-size: 20px; margin-bottom: 4px; }
  .sheet .sub { color: var(--muted); font-size: 14px; margin-bottom: 16px; }
  .step { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--sep); }
  .step:last-of-type { border-bottom: none; }
  .step .num {
    flex: none; width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(145deg, #7aa8ff, #4a7fe0);
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

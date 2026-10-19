import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { COMMON_JS, DASH_JS, LANDING_JS, PARSE_JS, SCAN_JS, VOICE_JS } from './client';
import { BASE_CSS, DASHBOARD_CSS, FRIENDS_CSS, LANDING_CSS, PROFILE_CSS, SETTINGS_CSS } from './styles';

type H = HtmlEscapedString | Promise<HtmlEscapedString>;
export type Flash = [category: string, message: string];

export interface Currency {
  label: string;
  symbol: string;
}

// Аналог '%.0f'|format(x) из Jinja (Python округляет .5 к чётному: 350.5 -> 350) + пробелы между разрядами
export const fmt0 = (n: number) => {
  const x = Number(n) || 0;
  const r = Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : Math.round(x);
  return (r || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// Число, которое плавно «докручивается» от нуля, когда появляется на экране
const countUp = (n: number) => html`<span data-count="${Math.round(Number(n) || 0)}" data-final="${fmt0(n)}">${fmt0(n)}</span>`;

const TAB_ICONS = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1" fill="currentColor"/></svg>',
  friends: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3c2.2.6 3.5 2.5 3.5 5.7"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
};
type Tab = keyof typeof TAB_ICONS;
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Траты',
  friends: 'Друзья',
  profile: 'Профиль',
  settings: 'Настройки',
};

const WALLET_SVG = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1" fill="currentColor"/></svg>';
const CHEV = raw('<svg class="chev" viewBox="0 0 8 13"><path d="M1.5 1.5 6.5 6.5 1.5 11.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');

interface LayoutOpts {
  title: string;
  flashes: Flash[];
  loggedIn: boolean;
  activeTab?: Tab;
  center?: boolean;
  bare?: boolean; // без общей обёртки (страница-презентация)
  extraCss?: string;
  scripts?: string;
}

export function layout(o: LayoutOpts, content: H) {
  const tabs = (Object.keys(TAB_ICONS) as Tab[]).map(
    (t) => html`
    <a class="tab ${o.activeTab === t ? 'active' : ''}" href="/${t}">
      <span class="icon">${raw(TAB_ICONS[t])}</span><span>${TAB_LABELS[t]}</span>
    </a>`,
  );
  return html`<!DOCTYPE html>
<html lang="ru" class="no-js">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="СпендТрекер">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<title>${o.title}</title>
<style>
${raw(BASE_CSS)}${raw(o.extraCss ?? '')}</style>
</head>
<body>
  <div class="toasts">${o.flashes.map(([cat, msg]) => html`<div class="flash ${cat}">${msg}</div>`)}</div>
  ${o.bare ? content : html`<div class="${o.center ? 'center-wrap' : 'wrap'}">${content}</div>`}
  ${o.loggedIn ? html`<nav class="tabbar">${tabs}
  </nav>` : ''}
  <script>${raw(COMMON_JS)}${raw(o.scripts ?? '')}</script>
</body>
</html>`;
}

// Панель сверху + большой заголовок, который при прокрутке «уезжает» в панель (как в iOS)
function header(title: string, right?: H | string, sub?: H | string) {
  return html`<header class="nav"><div class="nav-title">${title}</div>${right ? html`<div class="nav-side right">${right}</div>` : ''}</header>
<h1 class="large-title">${title}</h1>
${sub ? html`<div class="large-sub">${sub}</div>` : html`<div style="height:14px"></div>`}`;
}

// ---------- страница-презентация ----------

// Каждое слово — отдельный span: так текст «проявляется» по мере прокрутки
function scrub(text: string, accentFrom?: number) {
  return text.split(' ').map((w, i) => html`<span class="${accentFrom !== undefined && i >= accentFrom ? 'g' : ''}">${w} </span>`);
}

export function landingPage(d: { demo: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(today) - (6 - i) * 86400000).toISOString().slice(0, 10));
  const sampleWeek = days.map((date, i) => ({ date, total: [1500, 640, 2300, 890, 4500, 1200, 350][i] }));
  const sampleCats = [
    { category: 'Жильё', total: 18000 },
    { category: 'Еда', total: 7400 },
    { category: 'Одежда', total: 4500 },
    { category: 'Транспорт', total: 3700 },
    { category: 'Развлечения', total: 2800 },
  ];
  const cta = d.demo
    ? html`<form method="POST" action="/demo" style="margin:0"><button type="submit" class="btn">Открыть демо</button></form>
       <a class="btn btn-plain" href="/register">Создать аккаунт ›</a>`
    : html`<a class="btn" href="/register">Начать бесплатно</a><a class="btn btn-plain" href="/login">Войти ›</a>`;
  const barcode = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 1, 3, 1, 2, 1];

  return layout(
    { title: 'СпендТрекер — траты под контролем', flashes: [], loggedIn: false, bare: true, extraCss: DASHBOARD_CSS + FRIENDS_CSS + LANDING_CSS, scripts: LANDING_JS },
    html`<header class="l-nav">
  <a class="l-logo" href="/"><i>${raw(WALLET_SVG)}</i>СпендТрекер</a>
  <a class="pill" href="/login">Войти</a>
</header>
<main class="l-wrap">
  <section class="l-hero">
    <div class="eyebrow reveal">Новый СпендТрекер</div>
    <h1 class="l-h1 reveal" style="--d:.08s">Деньги.<br><span class="g">Под контролем.</span></h1>
    <p class="l-lead reveal" style="--d:.16s">Записывай траты голосом, сканируй покупки и смотри, куда уходят деньги. Красиво и без лишних шагов.</p>
    <div class="l-ctas reveal" style="--d:.24s">${cta}</div>
    <div class="device reveal" style="--d:.32s">
      <div class="card hero" style="margin-bottom:10px">
        <div class="label">Потрачено в октябре</div>
        <div class="big">${countUp(36400)}<span class="cur">₽</span></div>
        <div class="chips">
          <div class="chip"><div class="k">Сегодня</div><div class="v">439 ₽</div></div>
          <div class="chip"><div class="k">Эта неделя</div><div class="v">11 380 ₽</div></div>
        </div>
      </div>
      ${[
        ['Coca-Cola 0,5 л', 'Еда · Пятёрочка', 89, 'Еда'],
        ['Такси до работы', 'Транспорт', 1200, 'Транспорт'],
        ['Кроссовки', 'Одежда', 4500, 'Одежда'],
      ].map(
        ([n, c, a, cat]) => html`<div class="expense-row"><div class="main">${ico(String(cat))}<div style="min-width:0"><div class="info">${n}</div><div class="cat">${c}</div></div></div><div class="amt">${fmt0(Number(a))} ₽</div></div>`,
      )}
    </div>
  </section>

  <section class="l-sec"><p class="scrub">${scrub('Каждая трата — в два касания. Скажи её, отсканируй или впиши. СпендТрекер сам поймёт сумму, категорию и даже магазин.', 17)}</p></section>

  <section class="l-sec">
    <h2 class="l-h2 reveal">Скажи — <span class="g">и готово.</span></h2>
    <p class="l-p reveal">«Вчера такси 1 200» — и сумма, категория и дата заполнятся сами. Эквалайзер слышит твой голос.</p>
    <div class="showcase two">
      <div class="tile reveal">
        <div class="mini-eq">${Array.from({ length: 23 }, (_, k) => html`<i style="--k:${k}; --a:${Math.round(30 + 60 * Math.sin((k / 22) * Math.PI))}"></i>`)}</div>
        <div style="text-align:right"><span class="bubble">кофе с другом 350</span></div>
        <h4>Голосом</h4><p>Понимает «тысячи», «полторы», «вчера» и сам подбирает категорию.</p>
      </div>
      <div class="tile reveal" style="--d:.1s">
        <div class="expense-row" style="margin:6px 0 18px"><div class="main">${ico('Еда')}<div style="min-width:0"><div class="info">Кофе с другом</div><div class="cat">Еда</div></div></div><div class="amt">350 ₽</div></div>
        <h4>Сразу в списке</h4><p>Без форм и лишних касаний. Проверил — нажал «Добавить».</p>
      </div>
    </div>
  </section>

  <section class="l-sec">
    <h2 class="l-h2 reveal">Наведи камеру.<br><span class="g">Остальное — наше.</span></h2>
    <p class="l-p reveal">Отсканируй штрих-код — СпендТрекер найдёт товар, поймёт, в каком ты магазине, и подскажет цену.</p>
    <div class="showcase two">
      <div class="tile reveal">
        <div class="mock-vf"><div class="bars">${barcode.map((w) => html`<i style="--w:${w * 2}px"></i>`)}</div><div class="frame"></div><div class="line"></div></div>
        <h4>Штрих-код</h4><p>Миллионы товаров из открытой базы Open Food Facts.</p>
      </div>
      <div class="tile reveal" style="--d:.1s">
        <div class="product" style="margin-top:6px"><div class="pic none">${raw('<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>')}</div><div><div class="pn">Coca-Cola 0,5 л</div><div class="pb">Coca-Cola · 500 мл</div></div></div>
        <div class="store-chips">
          <span class="schip on"><span class="logo" style="background:#e3262f">П</span>Пятёрочка <small>40 м</small></span>
          <span class="schip"><span class="logo" style="background:#e4003a">М</span>Магнит <small>120 м</small></span>
        </div>
        <div class="prices">В «Пятёрочке» обычно <b>87 ₽</b> · Магнит <b>95 ₽</b></div>
        <h4>Магазин рядом</h4><p>По геопозиции — только в момент сканирования. Цены — из настоящих покупок.</p>
      </div>
    </div>
  </section>

  <section class="l-sec">
    <h2 class="l-h2 reveal">Весь месяц.<br><span class="g">Одним взглядом.</span></h2>
    <div class="showcase two">
      <div class="reveal">${weekWidget(sampleWeek, today, '₽')}</div>
      <div class="reveal" style="--d:.1s">${categoriesWidget(sampleCats, today, '₽', false)}</div>
    </div>
  </section>

  <section class="l-sec">
    <p class="scrub">${scrub('С друзьями — веселее. Добавь их и смотри, кто в этом месяце потратил больше всех.', 0)}</p>
    <div class="showcase" style="max-width:520px">
      <div class="card reveal" style="margin:0">
        ${[['Аня', 9445, false], ['Ты', 7889, true], ['Макс', 3595, false]].map(
          ([n, t, me], i) => html`<div class="board-row ${i === 0 ? 'rank-1' : ''} ${me ? 'me' : ''}"><div class="rank">${i + 1}</div><div class="av">${String(n)[0]}</div><div class="name">${n}</div><div class="amount">${fmt0(Number(t))} ₽</div></div>`,
        )}
      </div>
    </div>
  </section>

  <section class="l-cta">
    <h2 class="l-h2 reveal">Начни сегодня.</h2>
    <p class="l-p reveal" style="margin:0 auto 28px">Бесплатно. Без рекламы. Прямо в браузере — и на главном экране iPhone.</p>
    <div class="l-ctas reveal">${cta}</div>
  </section>
  <footer class="l-foot">СпендТрекер · ${today.slice(0, 4)}</footer>
</main>`,
  );
}

// ---------- вход и регистрация ----------

export function authPage(kind: 'login' | 'register', flashes: Flash[], demo = false) {
  const isLogin = kind === 'login';
  return layout(
    { title: isLogin ? 'Вход' : 'Регистрация', flashes, loggedIn: false, center: true, extraCss: DASHBOARD_CSS },
    html`<div style="height: max(8vh, calc(24px + env(safe-area-inset-top)))"></div>
<a href="/" class="reveal" style="display:block; width:76px; height:76px; margin:0 auto 22px; border-radius:20px; background:var(--grad); color:#fff; box-shadow:0 18px 50px -14px rgba(111,141,255,.7)">
  <span style="display:flex; align-items:center; justify-content:center; height:100%">${raw(WALLET_SVG.replace('<svg ', '<svg style="width:40px;height:40px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round" '))}</span>
</a>
<h1 class="reveal" style="--d:.05s; text-align:center; font-size:34px; letter-spacing:.2px">${isLogin ? 'С возвращением' : 'Новый аккаунт'}</h1>
<p class="reveal" style="--d:.1s; text-align:center; color:var(--text-2); margin:6px 0 26px">${isLogin ? 'Войди, чтобы продолжить' : 'Пара секунд — и можно считать траты'}</p>
<form method="POST" class="reveal" style="--d:.15s">
  <div class="form-rows">
    <label class="form-row" style="margin:0"><span>Логин</span><input type="text" name="username" required autocapitalize="off" autocorrect="off" autocomplete="username" style="text-align:left"></label>
    <label class="form-row" style="margin:0"><span>Пароль</span><input type="password" name="password" required autocomplete="${isLogin ? 'current-password' : 'new-password'}" style="text-align:left"></label>
  </div>
  <button type="submit">${isLogin ? 'Войти' : 'Создать аккаунт'}</button>
</form>
${demo
  ? html`<form method="POST" action="/demo" class="reveal" style="--d:.2s; margin-top:10px"><button type="submit" class="btn-tinted">Войти в демо-аккаунт</button></form>`
  : ''}
${isLogin
  ? html`<div class="footer-link reveal" style="--d:.25s">Нет аккаунта? <a href="/register">Зарегистрироваться</a></div>`
  : html`<div class="footer-link reveal" style="--d:.25s">Уже есть аккаунт? <a href="/login">Войти</a></div>`}`,
  );
}

// ---------- сайт внутри Telegram (Mini App) ----------

export function tgAppPage(next: string) {
  return layout(
    {
      title: 'СпендТрекер',
      flashes: [],
      loggedIn: false,
      center: true,
      extraCss: `${DASHBOARD_CSS}
  .tg-spin { width: 26px; height: 26px; margin: 22px auto 0; border-radius: 50%; border: 2.5px solid var(--fill); border-top-color: var(--accent); animation: tg-spin .8s linear infinite; }
  @keyframes tg-spin { to { transform: rotate(360deg); } }`,
    },
    html`<div style="height: max(18vh, calc(24px + env(safe-area-inset-top)))"></div>
<div class="reveal" style="width:76px; height:76px; margin:0 auto 22px; border-radius:20px; background:var(--grad); color:#fff; box-shadow:0 18px 50px -14px rgba(111,141,255,.7)">
  <span style="display:flex; align-items:center; justify-content:center; height:100%">${raw(WALLET_SVG.replace('<svg ', '<svg style="width:40px;height:40px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round" '))}</span>
</div>
<h1 class="reveal" style="--d:.05s; text-align:center; font-size:30px">СпендТрекер</h1>
<p class="reveal" id="tg-status" style="--d:.1s; text-align:center; color:var(--text-2); margin:6px 0 0">Входим в аккаунт…</p>
<div class="tg-spin" id="tg-spin"></div>
<a class="btn reveal" id="tg-login" href="/login" style="--d:.15s; margin-top:26px" hidden>Войти по логину и паролю</a>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script>
(function () {
  var next = ${raw(JSON.stringify(next))};
  var tg = window.Telegram && window.Telegram.WebApp;
  function fail(text) {
    document.getElementById('tg-status').textContent = text;
    document.getElementById('tg-spin').hidden = true;
    document.getElementById('tg-login').hidden = false;
  }
  if (!tg || !tg.initData) return fail('Эта страница открывается из Telegram-бота.');
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor('#000000'); tg.setBackgroundColor('#000000'); } catch (e) {}
  fetch('/tg/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }), credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (j.ok) return location.replace(next);
      fail(j.error === 'not_linked'
        ? 'Этот Telegram ещё не подключён к аккаунту. Войди и нажми в профиле «Подключить Telegram».'
        : 'Не получилось войти автоматически.');
    })
    .catch(function () { fail('Нет связи с сервером. Попробуй ещё раз.'); });
})();
</script>`,
  );
}

// ---------- иконки категорий ----------

const ICONS = {
  food: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  game: '<path d="M6 12h4"/><path d="M8 10v4"/><path d="M15 13h.01"/><path d="M18 11h.01"/><rect x="2" y="6" width="20" height="12" rx="4"/>',
  health: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/><path d="M3.2 12h6.3l.5-1 2 4.5 2-7 1.5 3.5h5.3"/>',
  shirt: '<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.2a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.4-2.2z"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 18h.01"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/><path d="M6 15h4"/>',
  cig: '<path d="M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14"/><path d="M18 8c0-2.5-2-2.5-2-5"/><path d="M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M22 8c0-2.5-2-2.5-2-5"/><path d="M7 12v4"/>',
};
type IconName = keyof typeof ICONS;

// Цвет плитки и цвет сегмента на диаграмме
const COLORS: Record<string, string> = {
  blue: '#5f8cf7', green: '#2fc487', orange: '#f68a41', pink: '#ef6a9c',
  purple: '#9a72f7', teal: '#30c2b4', yellow: '#efb73d', red: '#ec5a70', slate: '#7d879c',
};

const ICO_RULES: [string[], string, IconName][] = [
  [['табак', 'сигарет', 'вейп', 'стики'], 'slate', 'cig'],
  [['еда', 'продукт', 'кафе', 'ресторан', 'кофе', 'обед'], 'orange', 'food'],
  [['транспорт', 'такси', 'авто', 'бензин'], 'blue', 'car'],
  [['дом', 'жиль', 'аренд', 'коммунал'], 'teal', 'home'],
  [['развлеч', 'кино', 'игр'], 'purple', 'game'],
  [['здоров', 'аптек', 'врач'], 'red', 'health'],
  [['одежд', 'шопинг', 'покуп'], 'pink', 'shirt'],
  [['подар'], 'pink', 'gift'],
  [['подпис', 'связ', 'интернет'], 'teal', 'phone'],
  [['путеш', 'отпуск', 'поездк'], 'yellow', 'plane'],
  [['обуч', 'курс', 'книг'], 'green', 'book'],
];
const ICO_COLORS = ['blue', 'green', 'orange', 'pink', 'purple', 'teal', 'yellow', 'red'];

function catStyle(cat: string): { color: string; icon: IconName } {
  const c = cat.toLowerCase();
  for (const [words, color, icon] of ICO_RULES) {
    if (words.some((w) => c.includes(w))) return { color, icon };
  }
  return { color: ICO_COLORS[[...cat].length % 8], icon: 'card' };
}

function ico(cat: string) {
  const { color, icon } = catStyle(cat);
  return html`<span class="ico ${color}"><svg viewBox="0 0 24 24">${raw(ICONS[icon])}</svg></span>`;
}

export interface ExpenseRow {
  id: number;
  amount: number;
  category: string;
  note: string | null;
  expense_date: string;
  store?: string | null;
}

const MONTHS_IN = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
export const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function dayTitle(iso: string, today: string) {
  const d = new Date(iso + 'T00:00:00Z');
  const diff = Math.round((Date.parse(today + 'T00:00:00Z') - d.getTime()) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

function shortNum(n: number) {
  if (n >= 10000) return `${Math.round(n / 1000)}к`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '').replace('.', ',')}к`;
  return fmt0(n);
}

function donut(byCategory: { category: string; total: number }[], sum: number, sym: string) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const gapLen = byCategory.length > 1 ? 3 : 0;
  let offset = 0;
  const segs = byCategory.map((r) => {
    const len = (r.total / sum) * C;
    const dash = Math.max(0.01, len - gapLen);
    // Длина сегмента задаётся через --dash: кольцо «дорисовывается», когда карточка появляется на экране
    const seg = html`<circle class="seg" cx="64" cy="64" r="${R}" stroke="${COLORS[catStyle(r.category).color]}"
      style="--dash: ${dash.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
    offset += len;
    return seg;
  });
  return html`<div class="donut">
    <svg viewBox="0 0 128 128"><circle cx="64" cy="64" r="${R}" stroke="rgba(255,255,255,.05)"/>${segs}</svg>
    <div class="center"><div class="v">${shortNum(sum)}</div><div class="k">${sym} за месяц</div></div>
  </div>`;
}

const MIC_SVG = '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/></svg>';
const SCAN_SVG = '<svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8"/><path d="M10.5 8v8"/><path d="M14 8v8"/><path d="M17 8v8"/></svg>';
const PLUS_SVG = '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
const TORCH_SVG = '<svg viewBox="0 0 24 24"><path d="M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12z"/><path d="M6 6h12"/><path d="M12 12v2"/></svg>';
const PIN_SVG = '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const X_SVG = '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

// ---------- виджеты (используются и на главной, и на странице-презентации) ----------

function weekWidget(week: { date: string; total: number }[], today: string, sym: string) {
  const maxDay = Math.max(...week.map((r) => r.total), 0);
  return html`<div class="card" style="margin:0 0 14px">
  <div class="card-head"><h3>Последние 7 дней</h3><span class="hint">${fmt0(week.reduce((s, r) => s + r.total, 0))} ${sym}</span></div>
  <div class="week">
    ${week.map((r, k) => {
      const h = maxDay ? Math.max(6, Math.round((r.total / maxDay) * 100)) : 6;
      const dow = WEEKDAYS[new Date(r.date + 'T00:00:00Z').getUTCDay()];
      return html`<div class="col ${r.date === today ? 'today' : ''}" style="--k:${k}">
        <div class="bar-wrap" style="--h: ${h}%">
          ${r.total ? html`<span class="val">${shortNum(r.total)}</span>` : ''}
          <div class="bar" style="height: ${h}%"></div>
        </div>
        <div class="day">${dow}</div>
      </div>`;
    })}
  </div>
</div>`;
}

function categoriesWidget(byCategory: { category: string; total: number }[], today: string, sym: string, list = true) {
  const sum = byCategory.reduce((s, r) => s + r.total, 0);
  const maxCat = Math.max(...byCategory.map((r) => r.total), 0);
  return html`<div class="card" style="margin:0 0 14px">
  <div class="card-head"><h3>Категории</h3><span class="hint">${MONTHS_NOM[Number(today.slice(5, 7)) - 1]}</span></div>
  <div class="donut-wrap"${list ? '' : raw(' style="margin:0"')}>
    ${donut(byCategory, sum, sym)}
    <div class="legend">
      ${byCategory.slice(0, 5).map(
        (r) => html`<div class="row"><span class="dot" style="background:${COLORS[catStyle(r.category).color]}"></span><span class="name">${r.category}</span><span class="pct">${Math.round((r.total / sum) * 100)}%</span></div>`,
      )}
    </div>
  </div>
  ${list
    ? html`<div>${byCategory.map(
        (r) => html`<div class="cat-item">
      ${ico(r.category)}
      <div style="flex:1; min-width:0;">
        <div class="top"><span>${r.category}</span><span>${fmt0(r.total)} ${sym}</span></div>
        <div class="cat-bar"><div class="track"><div class="fill" style="width: ${maxCat ? Math.round((r.total / maxCat) * 100) : 0}%;"></div></div></div>
      </div>
    </div>`,
      )}</div>`
    : ''}
</div>`;
}

function expenseRows(recent: ExpenseRow[], today: string, sym: string, deletable: boolean) {
  let lastDay = '';
  return recent.map((e) => {
    const label = e.expense_date !== lastDay ? html`<div class="day-label">${dayTitle(e.expense_date, today)}</div>` : '';
    lastDay = e.expense_date;
    return html`${label}<div class="expense-row">
      <div class="main">
        ${ico(e.category)}
        <div style="min-width:0;">
          <div class="info">${e.note ? e.note : e.category}</div>
          <div class="cat">${e.store ? `${e.category} · ${e.store}` : e.category}</div>
        </div>
      </div>
      <div class="amt">${fmt0(e.amount)} ${sym}</div>
      ${deletable
        ? html`<form method="POST" action="/delete/${e.id}" style="margin:0;" onsubmit="return confirm('Удалить запись?');">
        <button type="submit" class="btn-danger btn-icon" aria-label="Удалить">${raw(X_SVG)}</button>
      </form>`
        : ''}
    </div>`;
  });
}

// ---------- главная ----------

export function dashboardPage(d: {
  flashes: Flash[];
  sym: string;
  username: string;
  demo: boolean;
  categories: string[];
  today: string;
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  week: { date: string; total: number }[];
  byCategory: { category: string; total: number }[];
  recent: ExpenseRow[];
}) {
  const month = MONTHS_IN[Number(d.today.slice(5, 7)) - 1];
  const catOptions = (sel?: string) => d.categories.map((c) => html`<option value="${c}" ${c === sel ? 'selected' : ''}>${c}</option>`);

  const recentRows = expenseRows(d.recent, d.today, d.sym, true);

  return layout(
    {
      title: 'Мои траты',
      flashes: d.flashes,
      loggedIn: true,
      activeTab: 'dashboard',
      extraCss: DASHBOARD_CSS,
      scripts: PARSE_JS + DASH_JS + VOICE_JS + SCAN_JS,
    },
    html`${header(
      'Траты',
      d.demo ? html`<span class="pill">Демо</span>` : undefined,
      html`Привет, ${d.username} · ${dayTitle(d.today, d.today).toLowerCase()}, ${Number(d.today.slice(8, 10))} ${MONTHS_SHORT[Number(d.today.slice(5, 7)) - 1]}`,
    )}

<div class="card hero reveal">
  <div class="label">Потрачено в ${month}</div>
  <div class="big">${countUp(d.monthTotal)}<span class="cur">${d.sym}</span></div>
  <div class="chips">
    <div class="chip"><div class="k">Сегодня</div><div class="v">${countUp(d.todayTotal)} ${d.sym}</div></div>
    <div class="chip"><div class="k">Эта неделя</div><div class="v">${countUp(d.weekTotal)} ${d.sym}</div></div>
  </div>
</div>

<div class="actions reveal" style="--d:.06s">
  <button type="button" class="action voice" id="act-voice"><span class="ring">${raw(MIC_SVG)}</span>Голосом</button>
  <button type="button" class="action" id="act-scan"><span class="ring">${raw(SCAN_SVG)}</span>Сканировать</button>
  <button type="button" class="action" id="act-manual"><span class="ring">${raw(PLUS_SVG)}</span>Вручную</button>
</div>

<div class="card reveal" style="--d:.1s">
  <form method="POST" id="add-form" data-today="${d.today}" data-sym="${d.sym}" autocomplete="off">
    <div class="amount-wrap"><input class="amount-input" type="text" name="amount" inputmode="decimal" placeholder="0" required aria-label="Сумма"><span class="amount-cur">${d.sym}</span></div>
    <div class="form-rows">
      <label class="form-row"><span>Категория</span><select name="category">${catOptions()}</select></label>
      <label class="form-row"><span>Дата</span><input type="date" name="expense_date" value="${d.today}"></label>
      <div class="form-row"><span>Магазин</span><input type="text" name="store" placeholder="Необязательно" maxlength="80"><button type="button" class="loc" id="loc-btn" aria-label="Магазины рядом">${raw(PIN_SVG)}</button></div>
      <label class="form-row"><span>Заметка</span><input type="text" name="note" placeholder="Кофе с другом" maxlength="255"></label>
    </div>
    <div class="store-chips" id="store-chips"></div>
    <input type="hidden" name="barcode" value="">
    <input type="hidden" name="lat" value=""><input type="hidden" name="lon" value="">
    <input type="hidden" name="store_src" value="">
    <button type="submit">Добавить</button>
  </form>
</div>

<div class="reveal">${weekWidget(d.week, d.today, d.sym)}</div>

${d.byCategory.length ? html`<div class="reveal">${categoriesWidget(d.byCategory, d.today, d.sym)}</div>` : ''}

<div class="card reveal">
  <h3 style="margin-bottom:2px;">Последние записи</h3>
  ${d.recent.length
    ? recentRows
    : html`<p style="color: var(--text-2); font-size: 15px; margin:12px 0 4px;">Пока нет записей — скажи трату голосом или отсканируй покупку.</p>`}
</div>

<div class="sheet-back" id="voice">
  <div class="sheet">
    <div class="grip"></div>
    <div class="voice-status" id="voice-status">Слушаю…</div>
    <canvas class="eq" id="eq"></canvas>
    <div class="voice-text" id="voice-text"></div>
    <div class="voice-hint" id="voice-hint"></div>
    <div class="sheet-actions">
      <button type="button" class="btn-gray" id="voice-cancel">Отмена</button>
      <button type="button" class="stop-btn" id="voice-stop"><i></i><span>Готово</span></button>
    </div>
  </div>
</div>

<div class="sheet-back" id="scan">
  <div class="sheet scan-sheet">
    <div class="grip"></div>
    <div class="viewfinder" id="vf">
      <video id="scan-video" playsinline muted autoplay></video>
      <canvas id="scan-snap" class="snap" hidden></canvas>
      <button type="button" class="vf-btn" id="scan-torch" aria-label="Вспышка">${raw(TORCH_SVG)}</button>
      <div class="frame"></div><div class="line"></div>
      <div class="vf-msg" id="vf-msg"></div>
    </div>
    <button type="button" class="btn-plain" id="scan-manual-toggle">Ввести код вручную</button>
    <div class="manual-code" id="scan-manual" hidden>
      <input type="text" id="scan-code" inputmode="numeric" placeholder="4600000000000" aria-label="Штрих-код">
      <button type="button" id="scan-code-go">Найти</button>
    </div>
    <div id="scan-result" hidden>
      <div class="product" id="scan-product"></div>
      <div class="prices" id="scan-prices" hidden></div>
      <div class="amount-wrap scan-step"><input class="amount-input" type="text" id="scan-amount" inputmode="decimal" placeholder="0" aria-label="Сумма"><span class="amount-cur">${d.sym}</span></div>
      <div class="store-chips scan-step" id="scan-stores" style="--d:.05s"></div>
      <div class="form-rows scan-step" style="--d:.1s">
        <label class="form-row"><span>Название</span><input type="text" id="scan-name" placeholder="Что купил" maxlength="255"></label>
        <label class="form-row"><span>Магазин</span><input type="text" id="scan-store" placeholder="Вписать свой" maxlength="80"></label>
        <label class="form-row"><span>Категория</span><select id="scan-cat">${catOptions('Еда')}</select></label>
      </div>
      <div class="footnote scan-step" style="margin:-6px 6px 14px">Нет нужного магазина или товара? Впиши название — сайт запомнит его здесь, и в следующий раз он найдётся сам.</div>
      <div class="sheet-actions scan-step" style="--d:.15s">
        <button type="button" class="btn-gray" id="scan-again">Ещё раз</button>
        <button type="button" id="scan-add">Добавить трату</button>
      </div>
    </div>
  </div>
</div>`,
  );
}

// ---------- друзья ----------

function av(uid: number, name: string) {
  return html`<div class="av">${(name ? [...name][0] : '?').toUpperCase()}<img src="/avatar/${uid}" alt="" onerror="this.remove()"></div>`;
}

export function friendsPage(d: {
  flashes: Flash[];
  sym: string;
  period: string;
  board: { id: number; username: string; is_me: boolean; total: number }[];
  incoming: { id: number; user_id: number; username: string }[];
}) {
  const periods: [string, string][] = [
    ['day', 'День'],
    ['week', 'Неделя'],
    ['month', 'Месяц'],
  ];
  const idx = Math.max(0, periods.findIndex(([p]) => p === d.period));
  return layout(
    { title: 'Друзья', flashes: d.flashes, loggedIn: true, activeTab: 'friends', extraCss: FRIENDS_CSS },
    html`${header('Друзья', undefined, 'Кто сколько потратил')}

<div class="seg reveal" style="--n:3; --i:${idx}">
  <span class="seg-thumb"></span>
  ${periods.map(([p, label]) => html`<a href="/friends?period=${p}">${label}</a>`)}
</div>

<div class="card reveal" style="--d:.05s">
  ${d.board.length
    ? d.board.map(
        (row, i) => html`<a class="board-row ${i === 0 ? 'rank-1' : ''} ${row.is_me ? 'me' : ''}" href="${row.is_me ? '/profile' : `/friends/${row.id}`}">
      <div class="rank">${i + 1}</div>
      ${av(row.id, row.username)}
      <div class="name">${row.is_me ? 'Ты' : row.username}</div>
      <div class="amount">${fmt0(row.total)} ${d.sym}</div>
      ${CHEV}
    </a>`,
      )
    : html`<p style="color: var(--text-2); font-size: 15px; margin:0">Пока никого нет в списке.</p>`}
</div>

${d.incoming.length
  ? html`<div class="section-h">Заявки в друзья</div><div class="card reveal">
  ${d.incoming.map(
    (r) => html`<div class="friend-req-row">
    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
      ${av(r.user_id, r.username)}
      <div style="font-weight:500;">${r.username}</div>
    </div>
    <div class="req-actions">
      <form method="POST" action="/friends/accept/${r.id}" style="margin:0;"><button type="submit" class="btn-accept">Принять</button></form>
      <form method="POST" action="/friends/decline/${r.id}" style="margin:0;"><button type="submit" class="btn-gray">Отклонить</button></form>
    </div>
  </div>`,
  )}
</div>`
  : ''}

<div class="section-h">Добавить друга</div>
<div class="card reveal">
  <form method="POST" action="/friends/add" autocomplete="off" class="add-friend">
    <input type="search" name="friend_login" placeholder="Ник друга" required
           inputmode="text" enterkeyhint="send"
           autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
           data-lpignore="true" data-1p-ignore aria-label="Ник друга">
    <button type="submit">Позвать</button>
  </form>
</div>
<div class="footnote">Друг получит заявку и появится в рейтинге, когда примет её.</div>`,
  );
}

// ---------- профиль друга ----------

const BACK_SVG = '<svg viewBox="0 0 12 20"><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function friendProfilePage(d: {
  flashes: Flash[];
  sym: string;
  id: number;
  username: string;
  friendsSince: string;
  avatarV: string | null;
  today: string;
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  week: { date: string; total: number }[];
  byCategory: { category: string; total: number }[];
  recent: ExpenseRow[];
}) {
  const since = d.friendsSince.slice(0, 10);
  const sinceText = `${Number(since.slice(8, 10))} ${MONTHS_SHORT[Number(since.slice(5, 7)) - 1]} ${since.slice(0, 4)}`;
  return layout(
    { title: d.username, flashes: d.flashes, loggedIn: true, activeTab: 'friends', extraCss: DASHBOARD_CSS + PROFILE_CSS },
    html`<header class="nav"><a class="nav-side left nav-back" href="/friends">${raw(BACK_SVG)}Друзья</a><div class="nav-title">${d.username}</div></header>
<div class="profile-head reveal">
  <div class="avatar-wrap">
    ${d.avatarV !== null
      ? html`<img class="avatar-img" src="/avatar/${d.id}?v=${d.avatarV}" alt="">`
      : html`<div class="profile-avatar">${(d.username ? [...d.username][0] : '?').toUpperCase()}</div>`}
  </div>
  <h1 class="large-title" style="font-size:28px; line-height:34px; margin:0">${d.username}</h1>
  <div class="since">В друзьях с ${sinceText}</div>
</div>

<div class="card reveal" style="--d:.05s; padding:10px 6px">
  <div class="profile-stats">
    <div><div class="value">${countUp(d.todayTotal)} ${d.sym}</div><div class="label">Сегодня</div></div>
    <div><div class="value">${countUp(d.weekTotal)} ${d.sym}</div><div class="label">Неделя</div></div>
    <div><div class="value">${countUp(d.monthTotal)} ${d.sym}</div><div class="label">Месяц</div></div>
  </div>
</div>

<div class="reveal">${weekWidget(d.week, d.today, d.sym)}</div>

${d.byCategory.length ? html`<div class="reveal">${categoriesWidget(d.byCategory, d.today, d.sym, false)}</div>` : ''}

<div class="card reveal">
  <h3 style="margin-bottom:2px;">Последние траты</h3>
  ${d.recent.length
    ? expenseRows(d.recent, d.today, d.sym, false)
    : html`<p style="color: var(--text-2); font-size: 15px; margin:12px 0 4px;">Пока ничего не записано.</p>`}
</div>

<form method="POST" action="/friends/remove/${d.id}" class="list reveal" style="margin-top:22px"
      onsubmit="return confirm('Удалить из друзей?');">
  <button type="submit" class="row danger"><span class="grow">Удалить из друзей</span></button>
</form>`,
  );
}

// ---------- профиль ----------

export function profilePage(d: {
  flashes: Flash[];
  sym: string;
  shortcutUrl: string;
  username: string;
  userId: number;
  createdAt: string | null;
  totalAllTime: number;
  expenseCount: number;
  friendCount: number;
  avatarV: string | null;
  apiToken: string | null;
  telegram: { bot: string; linked: boolean; tgUsername: string | null } | null;
}) {
  const created = d.createdAt
    ? `${d.createdAt.slice(8, 10)}.${d.createdAt.slice(5, 7)}.${d.createdAt.slice(0, 4)}`
    : '—';
  return layout(
    { title: 'Профиль', flashes: d.flashes, loggedIn: true, activeTab: 'profile', extraCss: PROFILE_CSS },
    html`<header class="nav"><div class="nav-title">${d.username || 'Профиль'}</div></header>
<div class="profile-head reveal">
  <form id="avatar-form" method="POST" action="/profile/avatar" enctype="multipart/form-data">
    <div class="avatar-wrap">
      ${d.avatarV !== null
        ? html`<img class="avatar-img" src="/avatar/${d.userId}?v=${d.avatarV}" alt="Фото профиля">`
        : html`<div class="profile-avatar">${(d.username ? [...d.username][0] : '?').toUpperCase()}</div>`}
      <label class="avatar-edit" for="avatar-input" title="Сменить фото">
        <svg viewBox="0 0 24 24"><path d="M4 8a2 2 0 0 1 2-2h1.5l1.2-2h6.6l1.2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>
      </label>
      <input id="avatar-input" type="file" name="avatar" accept="image/*" style="display:none;" onchange="uploadAvatar(this)">
    </div>
  </form>
  <h1 class="large-title" style="font-size:28px; line-height:34px; margin:0">${d.username || 'Пользователь'}</h1>
  <div class="since">На борту с ${created}</div>
  ${d.avatarV !== null
    ? html`<form method="POST" action="/profile/avatar/delete"><button type="submit" class="avatar-remove">Удалить фото</button></form>`
    : ''}
</div>

<div class="card reveal" style="--d:.05s; padding:10px 6px">
  <div class="profile-stats">
    <div><div class="value">${countUp(d.totalAllTime)} ${d.sym}</div><div class="label">Потрачено</div></div>
    <div><div class="value">${countUp(d.expenseCount)}</div><div class="label">Записей</div></div>
    <div><div class="value">${countUp(d.friendCount)}</div><div class="label">Друзей</div></div>
  </div>
</div>

${d.telegram
  ? html`<div class="section-h">Telegram-бот</div>
<div class="card reveal">
  ${d.telegram.linked
    ? html`<p class="token-hint" style="margin-top:0">
    Подключён${d.telegram.tgUsername ? html` к <b style="color:var(--text)">@${d.telegram.tgUsername}</b>` : ''}.
    Пиши или надиктуй боту траты, например <b style="color:var(--text)">кофе 250</b>, и они сразу появятся здесь.
  </p>
  <a class="btn" href="https://t.me/${d.telegram.bot}">Открыть @${d.telegram.bot}</a>
  <form method="POST" action="/profile/telegram/unlink" style="margin:0;" onsubmit="return confirm('Отключить Telegram-бота?');">
    <button type="submit" class="btn-plain" style="color:var(--text-2)">Отключить</button>
  </form>`
    : html`<p class="token-hint" style="margin-top:0">
    Записывай траты сообщением или голосовым в Telegram: <b style="color:var(--text)">кофе 250</b>, <b style="color:var(--text)">вчера такси 540</b>.
    Бот сам угадает категорию и пришлёт сводку по команде /stats.
  </p>
  <form method="POST" action="/profile/telegram" style="margin:0 0 4px;"><button type="submit">Подключить Telegram</button></form>`}
</div>`
  : ''}

<div class="section-h">Быстрая трата с iPhone</div>
<div class="card reveal">
  <p class="token-hint" style="margin-top:0">
    Добавляй траты в два касания через приложение «Команды». Токен никому не показывай:
    с ним можно добавлять траты от твоего имени.
  </p>
  ${d.apiToken
    ? html`<div class="token-box" id="token-text">${d.apiToken}</div>
    <div class="row-btns">
      <button type="button" id="copy-btn" onclick="copyToken()">Скопировать</button>
      <a class="btn btn-green" href="${d.shortcutUrl}">Добавить команду</a>
    </div>
    <button type="button" class="btn-plain" onclick="Sheet.open('help')">Как это работает</button>
    <form method="POST" action="/profile/token" style="margin:0;"
          onsubmit="return confirm('Старый токен перестанет работать, и команду придётся обновить. Продолжить?');">
      <button type="submit" class="btn-plain" style="color:var(--text-2)">Создать новый токен</button>
    </form>`
    : html`<form method="POST" action="/profile/token" style="margin:0 0 4px;"><button type="submit">Создать токен</button></form>
    <button type="button" class="btn-plain" onclick="Sheet.open('help')">Как это работает</button>`}
</div>

<div class="list reveal">
  <a class="row" href="/settings"><span class="grow">Настройки</span>${CHEV}</a>
  <a class="row danger" href="/logout"><span class="grow">Выйти из аккаунта</span></a>
</div>

<div class="sheet-back" id="help">
  <div class="sheet">
    <div class="grip"></div>
    <h3>Как добавить команду</h3>
    <div class="sub">Это нужно сделать один раз, займёт минуту.</div>
    <div class="step"><div class="num">1</div><div>
      <div class="t">Создай токен</div>
      <div class="d">Нажми <b>«Создать токен»</b> в карточке «Быстрая трата». Если токен уже есть, переходи к шагу 2.</div>
    </div></div>
    <div class="step"><div class="num">2</div><div>
      <div class="t">Скопируй токен</div>
      <div class="d">Нажми <b>«Скопировать»</b>. Кнопка на секунду покажет «Скопировано».</div>
    </div></div>
    <div class="step"><div class="num">3</div><div>
      <div class="t">Открой команду</div>
      <div class="d">Нажми <b>«Добавить команду»</b>. Откроется приложение «Команды» с командой «Трата».</div>
    </div></div>
    <div class="step"><div class="num">4</div><div>
      <div class="t">Вставь токен</div>
      <div class="d">Телефон спросит токен. Нажми на поле, выбери <b>«Вставить»</b> и нажми <b>«Добавить команду»</b>.</div>
    </div></div>
    <div class="step"><div class="num">5</div><div>
      <div class="t">Готово, пользуйся</div>
      <div class="d">Запусти команду «Трата»: выбери категорию, напиши заметку и введи сумму. Трата сразу появится в приложении.</div>
    </div></div>
    <div class="tip"><b>Совет:</b> чтобы запускать команду с главного экрана, открой её в «Командах», нажми «Поделиться» и выбери <b>«На экран Домой»</b>.</div>
    <button type="button" onclick="Sheet.close('help')" style="margin-top:16px;">Понятно</button>
  </div>
</div>

<script>
  function copyToken() {
    var el = document.getElementById('token-text');
    if (!el) return;
    var text = el.textContent.trim();
    var btn = document.getElementById('copy-btn');
    function done() {
      btn.textContent = 'Скопировано ✓';
      setTimeout(function () { btn.textContent = 'Скопировать'; }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done);
    } else {
      var range = document.createRange();
      range.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('copy');
      done();
    }
  }

  // Фото сжимается до квадрата 256x256 прямо в браузере (раньше это делал Pillow на сервере)
  function uploadAvatar(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var size = Math.min(img.naturalWidth, img.naturalHeight);
      var sx = (img.naturalWidth - size) / 2, sy = (img.naturalHeight - size) / 2;
      var canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) {
        var fd = new FormData();
        fd.append('avatar', blob, 'avatar.jpg');
        // redirect: 'manual' — иначе fetch сам откроет /profile и «съест» сообщение «Фото обновлено»
        fetch('/profile/avatar', { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' })
          .then(function () { location.href = '/profile'; })
          .catch(function () { location.href = '/profile'; });
      }, 'image/jpeg', 0.85);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      alert('Не удалось обработать фото, попробуйте другое');
    };
    img.src = url;
  }
</script>`,
  );
}

// ---------- настройки (сгруппированные строки, как в iOS и Telegram) ----------

const SQ = {
  key: '<svg viewBox="0 0 24 24"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3"/><path d="m16 7 3 3"/><path d="m18 5 2 2"/></svg>',
  coins: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.4 18.1"/><path d="M9 6.5v5"/><path d="M7 7.5h3a1 1 0 0 1 0 2H8a1 1 0 0 0 0 2h3"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  out: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
};
const sq = (icon: keyof typeof SQ, bg: string) => raw(`<span class="sq" style="background:${bg}">${SQ[icon]}</span>`);

export function settingsPage(d: {
  flashes: Flash[];
  username: string;
  currencies: Record<string, Currency>;
  currentCurrency: string;
}) {
  const cur = d.currencies[d.currentCurrency] ?? Object.values(d.currencies)[0];
  return layout(
    { title: 'Настройки', flashes: d.flashes, loggedIn: true, activeTab: 'settings', extraCss: SETTINGS_CSS },
    html`${header('Настройки', undefined, html`Логин: ${d.username}`)}

<div class="list reveal" style="--inset:58px">
  <form method="POST" style="margin:0">
    <input type="hidden" name="action" value="change_currency">
    <label class="row" style="margin:0; font-size:17px; color:var(--text)">
      ${sq('coins', '#30d158')}<span class="grow">Валюта</span><span class="value">${cur.label} (${cur.symbol})</span>${CHEV}
      <select name="currency" class="overlay" onchange="this.form.submit()" aria-label="Валюта">
        ${Object.entries(d.currencies).map(
          ([code, info]) => html`<option value="${code}" ${code === d.currentCurrency ? 'selected' : ''}>${info.label} (${info.symbol})</option>`,
        )}
      </select>
    </label>
  </form>
  <details class="row-group">
    <summary class="row" style="cursor:pointer">${sq('key', '#8e81ff')}<span class="grow">Пароль</span>${CHEV}</summary>
    <form method="POST" autocomplete="off" class="expand">
      <input type="hidden" name="action" value="change_password">
      <input type="password" name="current_password" required autocomplete="current-password" placeholder="Текущий пароль" aria-label="Текущий пароль">
      <input type="password" name="new_password" required autocomplete="new-password" placeholder="Новый пароль" aria-label="Новый пароль">
      <button type="submit">Сохранить</button>
    </form>
  </details>
  <a class="row" href="/profile">${sq('bolt', '#ff9f0a')}<span class="grow">Быстрая трата с iPhone</span>${CHEV}</a>
</div>

<div class="list reveal" style="--inset:58px; --d:.05s">
  <a class="row" href="/logout">${sq('out', '#636366')}<span class="grow">Выйти</span></a>
  <form method="POST" action="/settings/delete_account" style="margin:0" onsubmit="return confirm('Точно удалить аккаунт? Это необратимо.');">
    <button type="submit" class="row danger">${sq('trash', '#ff453a')}<span class="grow">Удалить аккаунт</span></button>
  </form>
</div>
<div class="footnote">Удаление сотрёт все траты, друзей и фото без возможности восстановления.</div>`,
  );
}

import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { COMMON_JS, DASH_JS, LANDING_JS, PARSE_JS, SCAN_JS, VOICE_JS } from './client';
import { BASE_CSS, DASHBOARD_CSS, FRIENDS_CSS, LANDING_CSS, PROFILE_CSS, SETTINGS_CSS } from './styles';
import { MASCOT_CSS, MASCOT_JS, mascot, type Mood } from './mascot';
import { plural } from './trek';
import { tr, categoryLabel, clientScript, currencyLabel, currencySymbol, LANGS, LANG_LABEL, type Lang } from './i18n';

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

const WALLET_SVG = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1" fill="currentColor"/></svg>';
const CHEV = raw('<svg class="chev" viewBox="0 0 8 13"><path d="M1.5 1.5 6.5 6.5 1.5 11.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');

interface LayoutOpts {
  title: string;
  flashes: Flash[];
  loggedIn: boolean;
  lang?: Lang;
  activeTab?: Tab;
  center?: boolean;
  bare?: boolean; // без общей обёртки (страница-презентация)
  extraCss?: string;
  scripts?: string;
  share?: string; // адрес сайта (https://…): публичной странице добавляем превью для чатов и соцсетей
}

export function layout(o: LayoutOpts, content: H) {
  const S = tr(o.lang ?? 'ru');
  const tabLabels: Record<Tab, string> = S.nav;
  const tabs = (Object.keys(TAB_ICONS) as Tab[]).map(
    (t) => html`
    <a class="tab ${o.activeTab === t ? 'active' : ''}" href="/${t}">
      <span class="icon">${raw(TAB_ICONS[t])}</span><span>${tabLabels[t]}</span>
    </a>`,
  );
  return html`<!DOCTYPE html>
<html lang="${S.htmlLang}" class="no-js">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${S.brand}">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<title>${o.title}</title>
${o.share
  ? html`<meta name="description" content="${S.shareText}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${S.brand}">
<meta property="og:locale" content="${S.ogLocale}">
<meta property="og:title" content="${S.shareTitle}">
<meta property="og:description" content="${S.shareText}">
<meta property="og:url" content="${o.share}/">
<meta property="og:image" content="${o.share}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${S.mascotAlt}">
<meta name="twitter:card" content="summary_large_image">`
  : ''}
<style>
${raw(BASE_CSS)}${raw(MASCOT_CSS)}${raw(o.extraCss ?? '')}</style>
</head>
<body>
  <div class="toasts">${o.flashes.map(([cat, msg]) => html`<div class="flash ${cat}">${msg}</div>`)}</div>
  ${o.bare ? content : html`<div class="${o.center ? 'center-wrap' : 'wrap'}">${content}</div>`}
  ${o.loggedIn ? html`<nav class="tabbar">${tabs}
  </nav>` : ''}
  <script>${o.scripts ? raw(clientScript(o.lang ?? 'ru')) : ''}${raw(COMMON_JS)}${raw(MASCOT_JS)}${raw(o.scripts ?? '')}</script>
</body>
</html>`;
}

// Переключатель языка RU/EN: ссылки на /lang/<код>?next=<откуда>, активный подсвечен
function langToggle(lang: Lang, next: string) {
  const link = (code: Lang, label: string) =>
    html`<a class="lang-opt ${lang === code ? 'on' : ''}" href="/lang/${code}?next=${encodeURIComponent(next)}">${label}</a>`;
  return html`<span class="lang-switch">${link('ru', 'RU')}${link('en', 'EN')}</span>`;
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

export function landingPage(d: { demo: boolean; origin: string; lang: Lang }) {
  const S = tr(d.lang);
  const L = S.landing;
  const today = new Date().toISOString().slice(0, 10);
  const monthName = S.months.in[Number(today.slice(5, 7)) - 1];
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
    ? html`<form method="POST" action="/demo" style="margin:0"><button type="submit" class="btn">${L.ctaDemo}</button></form>
       <a class="btn btn-plain" href="/register">${L.ctaCreate}</a>`
    : html`<a class="btn" href="/register">${L.ctaStart}</a><a class="btn btn-plain" href="/login">${L.ctaLoginArrow}</a>`;
  const barcode = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 1, 3, 1, 2, 1];
  const sampleRows = L.sampleRows.map((r, i) => [...r, [89, 1200, 4500][i], ['Еда', 'Транспорт', 'Одежда'][i]] as const);

  return layout(
    { title: S.shareTitle, flashes: [], loggedIn: false, lang: d.lang, bare: true, extraCss: DASHBOARD_CSS + FRIENDS_CSS + LANDING_CSS, scripts: LANDING_JS, share: d.origin },
    html`<header class="l-nav">
  <a class="l-logo" href="/"><i>${raw(WALLET_SVG)}</i>${S.brand}</a>
  <span style="display:flex; gap:10px; align-items:center">${langToggle(d.lang, '/')}<a class="pill" href="/login">${L.login}</a></span>
</header>
<main class="l-wrap">
  <section class="l-hero">
    <div class="reveal" style="margin-bottom:14px">${raw(mascot('wave', 112, '', d.lang))}</div>
    <div class="eyebrow reveal">${L.eyebrow}</div>
    <h1 class="l-h1 reveal" style="--d:.08s">${L.h1a}<br><span class="g">${L.h1b}</span></h1>
    <p class="l-lead reveal" style="--d:.16s">${L.lead}</p>
    <div class="l-ctas reveal" style="--d:.24s">${cta}</div>
    <div class="device reveal" style="--d:.32s">
      <div class="card hero" style="margin-bottom:10px">
        <div class="label">${L.spentInMonth.replace('%s', monthName)}</div>
        <div class="big">${countUp(36400)}<span class="cur">₽</span></div>
        <div class="chips">
          <div class="chip"><div class="k">${L.today}</div><div class="v">439 ₽</div></div>
          <div class="chip"><div class="k">${L.thisWeek}</div><div class="v">11 380 ₽</div></div>
        </div>
      </div>
      ${sampleRows.map(
        ([n, c, a, cat]) => html`<div class="expense-row"><div class="main">${ico(String(cat))}<div style="min-width:0"><div class="info">${n}</div><div class="cat">${c}</div></div></div><div class="amt">${fmt0(Number(a))} ₽</div></div>`,
      )}
    </div>
  </section>

  <section class="l-sec"><p class="scrub">${scrub(L.scrub1, d.lang === 'en' ? 15 : 17)}</p></section>

  <section class="l-sec">
    <h2 class="l-h2 reveal">${L.voiceH2a} <span class="g">${L.voiceH2b}</span></h2>
    <p class="l-p reveal">${L.voiceP}</p>
    <div class="showcase two">
      <div class="tile reveal">
        <div class="mini-eq">${Array.from({ length: 23 }, (_, k) => html`<i style="--k:${k}; --a:${Math.round(30 + 60 * Math.sin((k / 22) * Math.PI))}"></i>`)}</div>
        <div style="text-align:right"><span class="bubble">${L.voiceBubble}</span></div>
        <h4>${L.byVoice}</h4><p>${L.byVoiceP}</p>
      </div>
      <div class="tile reveal" style="--d:.1s">
        <div class="expense-row" style="margin:6px 0 18px"><div class="main">${ico('Еда')}<div style="min-width:0"><div class="info">${L.voiceRowNote}</div><div class="cat">${categoryLabel('Еда', d.lang)}</div></div></div><div class="amt">350 ₽</div></div>
        <h4>${L.inListH}</h4><p>${L.inListP}</p>
      </div>
    </div>
  </section>

  <section class="l-sec">
    <h2 class="l-h2 reveal">${L.scanH2a}<br><span class="g">${L.scanH2b}</span></h2>
    <p class="l-p reveal">${L.scanP}</p>
    <div class="showcase two">
      <div class="tile reveal">
        <div class="mock-vf"><div class="bars">${barcode.map((w) => html`<i style="--w:${w * 2}px"></i>`)}</div><div class="frame"></div><div class="line"></div></div>
        <h4>${L.barcodeH}</h4><p>${L.barcodeP}</p>
      </div>
      <div class="tile reveal" style="--d:.1s">
        <div class="product" style="margin-top:6px"><div class="pic none">${raw('<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>')}</div><div><div class="pn">Coca-Cola 0,5 л</div><div class="pb">Coca-Cola · 500 мл</div></div></div>
        <div class="store-chips">
          <span class="schip on"><span class="logo" style="background:#e3262f">П</span>Пятёрочка <small>40 ${d.lang === 'en' ? 'm' : 'м'}</small></span>
          <span class="schip"><span class="logo" style="background:#e4003a">М</span>Магнит <small>120 ${d.lang === 'en' ? 'm' : 'м'}</small></span>
        </div>
        <div class="prices">${raw(L.pricesLine)}</div>
        <h4>${L.storeH}</h4><p>${L.storeP}</p>
      </div>
    </div>
  </section>

  <section class="l-sec">
    <h2 class="l-h2 reveal">${L.monthH2a}<br><span class="g">${L.monthH2b}</span></h2>
    <div class="showcase two">
      <div class="reveal">${weekWidget(sampleWeek, today, '₽', d.lang)}</div>
      <div class="reveal" style="--d:.1s">${categoriesWidget(sampleCats, today, '₽', d.lang, false)}</div>
    </div>
  </section>

  <section class="l-sec">
    <p class="scrub">${scrub(L.friendsScrub, 0)}</p>
    <div class="showcase" style="max-width:520px">
      <div class="card reveal" style="margin:0">
        ${[[L.friendA, 9445, false], [L.you, 7889, true], [L.friendB, 3595, false]].map(
          ([n, t, me], i) => html`<div class="board-row ${i === 0 ? 'rank-1' : ''} ${me ? 'me' : ''}"><div class="rank">${i + 1}</div><div class="av">${String(n)[0]}</div><div class="name">${n}</div><div class="amount">${fmt0(Number(t))} ₽</div></div>`,
        )}
      </div>
    </div>
  </section>

  <section class="l-cta">
    <div class="reveal" style="margin-bottom:10px">${raw(mascot('happy', 96, '', d.lang))}</div>
    <h2 class="l-h2 reveal">${L.ctaSecH}</h2>
    <p class="l-p reveal" style="margin:0 auto 28px">${L.ctaSecP}</p>
    <div class="l-ctas reveal">${cta}</div>
  </section>
  <footer class="l-foot">${S.brand} · ${today.slice(0, 4)}</footer>
</main>`,
  );
}

// ---------- вход и регистрация ----------

// Логотип Telegram (бумажный самолётик) для кнопки «Войти через Telegram»
const TG_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1.1-1 .2-1.5L20.5 2.8c.9-.3 1.6.2 1.4 1.5z"/></svg>';
const TG_CSS = `
  .btn-tg { display: flex; align-items: center; justify-content: center; gap: 9px; background: #2aabee; color: #fff; }
  .btn-tg:hover { background: #229ed9; }
  .auth-or { display: flex; align-items: center; gap: 12px; color: var(--text-3, var(--text-2)); font-size: 13px; margin: 18px 4px; }
  .auth-or::before, .auth-or::after { content: ''; flex: 1; height: 1px; background: var(--separator, rgba(128,128,128,.3)); }
  .tg-note { text-align: center; color: var(--text-2); font-size: 14px; margin: -12px 0 20px; }`;

export function authPage(
  kind: 'login' | 'register',
  flashes: Flash[],
  opts: { demo?: boolean; tgLogin?: boolean; tgPending?: boolean; origin?: string; lang?: Lang } = {},
) {
  const isLogin = kind === 'login';
  const demo = !!opts.demo;
  const lang = opts.lang ?? 'ru';
  const A = tr(lang).auth;
  return layout(
    { title: isLogin ? A.titleLogin : A.titleRegister, flashes, loggedIn: false, lang, center: true, extraCss: DASHBOARD_CSS + TG_CSS, share: opts.origin },
    html`<div style="position:absolute; top:max(14px, env(safe-area-inset-top)); right:16px">${langToggle(lang, isLogin ? '/login' : '/register')}</div>
<div style="height: max(8vh, calc(24px + env(safe-area-inset-top)))"></div>
<div class="reveal" style="text-align:center; margin:0 auto 14px">${raw(mascot(isLogin ? 'wave' : 'happy', 104, '', lang))}</div>
<h1 class="reveal" style="--d:.05s; text-align:center; font-size:34px; letter-spacing:.2px">${isLogin ? A.headLogin : A.headRegister}</h1>
<p class="reveal" style="--d:.1s; text-align:center; color:var(--text-2); margin:6px 0 26px">${isLogin ? A.subLogin : A.subRegister}</p>
${opts.tgPending
  ? html`<p class="tg-note reveal" style="--d:.12s">${isLogin ? A.pendingLogin : A.pendingRegister}</p>`
  : opts.tgLogin
    ? html`<a class="btn btn-tg reveal" style="--d:.12s" href="/auth/telegram">${raw(TG_ICON)}${isLogin ? A.tgLogin : A.tgContinue}</a>
<div class="auth-or reveal" style="--d:.14s">${A.orLogin}</div>`
    : ''}
<form method="POST" class="reveal" style="--d:.15s">
  <div class="form-rows">
    <label class="form-row" style="margin:0"><span>${A.login}</span><input type="text" name="username" required autocapitalize="off" autocorrect="off" autocomplete="username" style="text-align:left"></label>
    <label class="form-row" style="margin:0"><span>${A.password}</span><input type="password" name="password" required autocomplete="${isLogin ? 'current-password' : 'new-password'}" style="text-align:left"></label>
  </div>
  <button type="submit">${isLogin ? A.btnLogin : A.btnRegister}</button>
</form>
${demo
  ? html`<form method="POST" action="/demo" class="reveal" style="--d:.2s; margin-top:10px"><button type="submit" class="btn-tinted">${A.demoBtn}</button></form>`
  : ''}
${isLogin
  ? html`<div class="footer-link reveal" style="--d:.22s"><a href="/forgot">${A.forgot}</a></div>
<div class="footer-link reveal" style="--d:.25s">${A.noAccount} <a href="/register">${A.registerLink}</a></div>`
  : html`<div class="footer-link reveal" style="--d:.25s">${A.haveAccount} <a href="/login">${A.loginLink}</a></div>`}`,
  );
}

// «Забыли пароль?»: логин → бот присылает ссылку в привязанный Telegram (sent — ответ после отправки формы)
export function forgotPage(flashes: Flash[], sent = false, lang: Lang = 'ru') {
  const F = tr(lang).forgot;
  return layout(
    { title: F.title, flashes, loggedIn: false, lang, center: true, extraCss: DASHBOARD_CSS },
    html`<div style="height: max(8vh, calc(24px + env(safe-area-inset-top)))"></div>
<div class="reveal" style="text-align:center; margin:0 auto 14px">${raw(mascot(sent ? 'wink' : 'worried', 104, '', lang))}</div>
<h1 class="reveal" style="--d:.05s; text-align:center; font-size:30px">${sent ? F.headSent : F.headAsk}</h1>
${sent
  ? html`<p class="reveal" style="--d:.1s; text-align:center; color:var(--text-2); margin:6px 0 26px">${F.sent1}</p>
<p class="reveal" style="--d:.15s; text-align:center; color:var(--text-2); margin:0 0 26px">${F.sent2}</p>`
  : html`<p class="reveal" style="--d:.1s; text-align:center; color:var(--text-2); margin:6px 0 26px">${F.ask}</p>
<form method="POST" class="reveal" style="--d:.15s">
  <div class="form-rows">
    <label class="form-row" style="margin:0"><span>${F.login}</span><input type="text" name="username" required autocapitalize="off" autocorrect="off" autocomplete="username" style="text-align:left"></label>
  </div>
  <button type="submit">${F.send}</button>
</form>`}
<div class="footer-link reveal" style="--d:.25s"><a href="/login">${F.back}</a></div>`,
  );
}

// Страница из ссылки бота: новый пароль
export function resetPage(flashes: Flash[], username: string, lang: Lang = 'ru') {
  const R = tr(lang).reset;
  return layout(
    { title: R.title, flashes, loggedIn: false, lang, center: true, extraCss: DASHBOARD_CSS },
    html`<div style="height: max(8vh, calc(24px + env(safe-area-inset-top)))"></div>
<div class="reveal" style="text-align:center; margin:0 auto 14px">${raw(mascot('happy', 104, '', lang))}</div>
<h1 class="reveal" style="--d:.05s; text-align:center; font-size:30px">${R.head}</h1>
<p class="reveal" style="--d:.1s; text-align:center; color:var(--text-2); margin:6px 0 26px">${R.forAccount} <b>${username}</b></p>
<form method="POST" class="reveal" style="--d:.15s">
  <input type="text" name="username" value="${username}" autocomplete="username" hidden>
  <div class="form-rows">
    <label class="form-row" style="margin:0"><span>${R.password}</span><input type="password" name="password" required minlength="8" autocomplete="new-password" style="text-align:left"></label>
  </div>
  <button type="submit">${R.save}</button>
</form>
<div class="footer-link reveal" style="--d:.25s">${R.note}</div>`,
  );
}

// Вошли через Telegram, а аккаунта с ним ещё нет: создать новый или привязать к существующему
export function tgNewAccountPage(flashes: Flash[], name: string, lang: Lang = 'ru') {
  const T = tr(lang).tgNew;
  return layout(
    { title: T.title, flashes, loggedIn: false, lang, center: true, extraCss: DASHBOARD_CSS + TG_CSS },
    html`<div style="height: max(8vh, calc(24px + env(safe-area-inset-top)))"></div>
<div class="reveal" style="text-align:center; margin:0 auto 14px">${raw(mascot('wave', 104, '', lang))}</div>
<h1 class="reveal" style="--d:.05s; text-align:center; font-size:30px">${T.hi}, ${name}!</h1>
<p class="reveal" style="--d:.1s; text-align:center; color:var(--text-2); margin:6px 0 26px">${T.text}</p>
<form method="POST" action="/auth/telegram/new" class="reveal" style="--d:.15s; margin:0">
  <button type="submit" class="btn-tg">${raw(TG_ICON)}${T.create}</button>
</form>
<a class="btn btn-tinted reveal" href="/login" style="--d:.2s; margin-top:10px">${T.have}</a>
<div class="footer-link reveal" style="--d:.25s">${T.note}</div>`,
  );
}

// ---------- сайт внутри Telegram (Mini App) ----------

export function tgAppPage(next: string, lang: Lang = 'ru') {
  const S = tr(lang);
  const T = S.tgApp;
  return layout(
    {
      title: S.brand,
      flashes: [],
      loggedIn: false,
      lang,
      center: true,
      extraCss: `${DASHBOARD_CSS}
  .tg-spin { width: 26px; height: 26px; margin: 22px auto 0; border-radius: 50%; border: 2.5px solid var(--fill); border-top-color: var(--accent); animation: tg-spin .8s linear infinite; }
  @keyframes tg-spin { to { transform: rotate(360deg); } }`,
    },
    html`<div style="height: max(18vh, calc(24px + env(safe-area-inset-top)))"></div>
<div class="reveal" style="text-align:center; margin:0 auto 14px">${raw(mascot('happy', 104, '', lang))}</div>
<h1 class="reveal" style="--d:.05s; text-align:center; font-size:30px">${S.brand}</h1>
<p class="reveal" id="tg-status" style="--d:.1s; text-align:center; color:var(--text-2); margin:6px 0 0">${T.signingIn}</p>
<div class="tg-spin" id="tg-spin"></div>
<a class="btn reveal" id="tg-login" href="/login" style="--d:.15s; margin-top:26px" hidden>${T.loginBtn}</a>
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
  if (!tg || !tg.initData) return fail(${raw(JSON.stringify(T.fromBot))});
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor('#000000'); tg.setBackgroundColor('#000000'); } catch (e) {}
  fetch('/tg/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }), credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (j.ok) return location.replace(next);
      fail(j.error === 'not_linked'
        ? ${raw(JSON.stringify(T.notLinked))}
        : ${raw(JSON.stringify(T.failed))});
    })
    .catch(function () { fail(${raw(JSON.stringify(T.noServer))}); });
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
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function dayTitle(iso: string, today: string, lang: Lang = 'ru') {
  const S = tr(lang);
  const d = new Date(iso + 'T00:00:00Z');
  const diff = Math.round((Date.parse(today + 'T00:00:00Z') - d.getTime()) / 86400000);
  if (diff === 0) return S.today;
  if (diff === 1) return S.yesterday;
  return lang === 'en' ? `${S.months.short[d.getUTCMonth()]} ${d.getUTCDate()}` : `${d.getUTCDate()} ${S.months.short[d.getUTCMonth()]}`;
}

function shortNum(n: number, lang: Lang = 'ru') {
  const en = lang === 'en';
  if (n >= 10000) return `${Math.round(n / 1000)}${en ? 'k' : 'к'}`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '').replace('.', en ? '.' : ',')}${en ? 'k' : 'к'}`;
  return fmt0(n);
}

function donut(byCategory: { category: string; total: number }[], sum: number, sym: string, lang: Lang = 'ru') {
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
    <div class="center"><div class="v">${shortNum(sum, lang)}</div><div class="k">${sym} ${lang === 'en' ? 'this month' : 'за месяц'}</div></div>
  </div>`;
}

const MIC_SVG = '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/></svg>';
const SCAN_SVG = '<svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8"/><path d="M10.5 8v8"/><path d="M14 8v8"/><path d="M17 8v8"/></svg>';
const PLUS_SVG = '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
const TORCH_SVG = '<svg viewBox="0 0 24 24"><path d="M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12z"/><path d="M6 6h12"/><path d="M12 12v2"/></svg>';
const PIN_SVG = '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const X_SVG = '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

// ---------- виджеты (используются и на главной, и на странице-презентации) ----------

function weekWidget(week: { date: string; total: number }[], today: string, sym: string, lang: Lang = 'ru') {
  const S = tr(lang);
  const maxDay = Math.max(...week.map((r) => r.total), 0);
  return html`<div class="card" style="margin:0 0 14px">
  <div class="card-head"><h3>${lang === 'en' ? 'Last 7 days' : 'Последние 7 дней'}</h3><span class="hint">${fmt0(week.reduce((s, r) => s + r.total, 0))} ${sym}</span></div>
  <div class="week">
    ${week.map((r, k) => {
      const h = maxDay ? Math.max(6, Math.round((r.total / maxDay) * 100)) : 6;
      const dow = S.weekdays[new Date(r.date + 'T00:00:00Z').getUTCDay()];
      return html`<div class="col ${r.date === today ? 'today' : ''}" style="--k:${k}">
        <div class="bar-wrap" style="--h: ${h}%">
          ${r.total ? html`<span class="val">${shortNum(r.total, lang)}</span>` : ''}
          <div class="bar" style="height: ${h}%"></div>
        </div>
        <div class="day">${dow}</div>
      </div>`;
    })}
  </div>
</div>`;
}

function categoriesWidget(byCategory: { category: string; total: number }[], today: string, sym: string, lang: Lang = 'ru', list = true) {
  const S = tr(lang);
  const sum = byCategory.reduce((s, r) => s + r.total, 0);
  const maxCat = Math.max(...byCategory.map((r) => r.total), 0);
  return html`<div class="card" style="margin:0 0 14px">
  <div class="card-head"><h3>${lang === 'en' ? 'Categories' : 'Категории'}</h3><span class="hint">${S.months.nom[Number(today.slice(5, 7)) - 1]}</span></div>
  <div class="donut-wrap"${list ? '' : raw(' style="margin:0"')}>
    ${donut(byCategory, sum, sym, lang)}
    <div class="legend">
      ${byCategory.slice(0, 5).map(
        (r) => html`<div class="row"><span class="dot" style="background:${COLORS[catStyle(r.category).color]}"></span><span class="name">${categoryLabel(r.category, lang)}</span><span class="pct">${Math.round((r.total / sum) * 100)}%</span></div>`,
      )}
    </div>
  </div>
  ${list
    ? html`<div>${byCategory.map(
        (r) => html`<div class="cat-item">
      ${ico(r.category)}
      <div style="flex:1; min-width:0;">
        <div class="top"><span>${categoryLabel(r.category, lang)}</span><span>${fmt0(r.total)} ${sym}</span></div>
        <div class="cat-bar"><div class="track"><div class="fill" style="width: ${maxCat ? Math.round((r.total / maxCat) * 100) : 0}%;"></div></div></div>
      </div>
    </div>`,
      )}</div>`
    : ''}
</div>`;
}

function expenseRows(recent: ExpenseRow[], today: string, sym: string, deletable: boolean, lang: Lang = 'ru') {
  const delQ = lang === 'en' ? 'Delete this entry?' : 'Удалить запись?';
  const delAria = lang === 'en' ? 'Delete' : 'Удалить';
  let lastDay = '';
  return recent.map((e) => {
    const label = e.expense_date !== lastDay ? html`<div class="day-label">${dayTitle(e.expense_date, today, lang)}</div>` : '';
    lastDay = e.expense_date;
    const catName = categoryLabel(e.category, lang);
    return html`${label}<div class="expense-row">
      <div class="main">
        ${ico(e.category)}
        <div style="min-width:0;">
          <div class="info">${e.note ? e.note : catName}</div>
          <div class="cat">${e.store ? `${catName} · ${e.store}` : catName}</div>
        </div>
      </div>
      <div class="amt">${fmt0(e.amount)} ${sym}</div>
      ${deletable
        ? html`<form method="POST" action="/delete/${e.id}" style="margin:0;" onsubmit="return confirm('${delQ}');">
        <button type="submit" class="btn-danger btn-icon" aria-label="${delAria}">${raw(X_SVG)}</button>
      </form>`
        : ''}
    </div>`;
  });
}

// ---------- Трэк на главной ----------

const escText = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Что Трэк говорит сегодня: сравнивает траты за день с обычными для этого месяца */
function kopiCard(d: { sym: string; today: string; todayTotal: number; monthTotal: number; recent: ExpenseRow[]; byCategory: { category: string; total: number }[]; lang?: Lang }) {
  const lang = d.lang ?? 'ru';
  const en = lang === 'en';
  const sym = escText(d.sym);
  const day = Number(d.today.slice(8, 10));
  const usual = day > 1 ? (d.monthTotal - d.todayTotal) / (day - 1) : 0;
  const today = `<b>${fmt0(d.todayTotal)} ${sym}</b>`;
  let mood: Mood;
  let text: string;
  if (!d.recent.length) {
    mood = 'wave';
    text = en
      ? "Hi! I'm <b>Track</b> 👋 I'll help you watch your money. Record your first expense — say it by voice or scan a purchase."
      : 'Привет! Я <b>Трэк</b> 👋 Помогу следить за деньгами. Запиши первую трату — скажи её голосом или отсканируй покупку.';
  } else if (!d.todayTotal) {
    mood = 'happy';
    text = en ? 'No expenses today. Keep it up! 🌱' : 'Сегодня ни одной траты. Так держать! 🌱';
  } else if (usual > 0 && d.todayTotal > usual * 1.5) {
    mood = 'worried';
    text = en
      ? `Whoa, already ${today} today. A usual day is around ${fmt0(usual)} ${sym}.`
      : `Ого, сегодня уже ${today}. Обычно за день выходит около ${fmt0(usual)} ${sym}.`;
  } else if (usual > 0 && d.todayTotal < usual * 0.8) {
    mood = 'happy';
    text = en ? `${today} today — less than usual. Saving up! 🌱` : `Сегодня ${today} — меньше, чем обычно. Копим! 🌱`;
  } else {
    mood = 'wink';
    text = en ? `${today} today. All under control 😉` : `Сегодня ${today}. Всё под контролем 😉`;
  }
  const top = d.byCategory[0];
  const tips = en
    ? [
        text,
        'Tap "Voice" and say "coffee 250" — I\'ll log it all.',
        'Point the camera at a barcode — I\'ll find the product and a store nearby.',
        ...(top ? [`This month "${escText(categoryLabel(top.category, lang))}" takes the most — ${fmt0(top.total)} ${sym}.`] : []),
        'Message me expenses in Telegram too — connect the bot in your profile.',
        'Hehe, that tickles! 😄',
      ]
    : [
        text,
        'Нажми «Голосом» и скажи «кофе 250» — я всё запишу.',
        'Наведи камеру на штрих-код — найду товар и магазин рядом.',
        ...(top ? [`В этом месяце больше всего уходит на «${escText(top.category)}» — ${fmt0(top.total)} ${sym}.`] : []),
        'Пиши мне траты и в Telegram — подключи бота в профиле.',
        'Хе-хе, щекотно! 😄',
      ];
  return html`<div class="kopi-card reveal" style="--d:.03s" data-tips="${JSON.stringify(tips)}" data-i="0">
  ${raw(mascot(mood, 64, '', lang))}
  <div class="kopi-bubble"><span class="who">${en ? 'Track' : 'Трэк'}</span><span class="kopi-text">${raw(text)}</span></div>
</div>`;
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
  lang: Lang;
}) {
  const S = tr(d.lang);
  const A = S.app;
  const month = S.months.in[Number(d.today.slice(5, 7)) - 1];
  const catOptions = (sel?: string) => d.categories.map((c) => html`<option value="${c}" ${c === sel ? 'selected' : ''}>${categoryLabel(c, d.lang)}</option>`);

  const recentRows = expenseRows(d.recent, d.today, d.sym, true, d.lang);
  const dateStr = d.lang === 'en'
    ? `${S.months.short[Number(d.today.slice(5, 7)) - 1]} ${Number(d.today.slice(8, 10))}`
    : `${Number(d.today.slice(8, 10))} ${S.months.short[Number(d.today.slice(5, 7)) - 1]}`;

  return layout(
    {
      title: S.nav.dashboard,
      flashes: d.flashes,
      loggedIn: true,
      lang: d.lang,
      activeTab: 'dashboard',
      extraCss: DASHBOARD_CSS,
      scripts: PARSE_JS + DASH_JS + VOICE_JS + SCAN_JS,
    },
    html`${header(
      S.nav.dashboard,
      d.demo ? html`<span class="pill">${A.demo}</span>` : undefined,
      html`${A.greeting.replace('%s', d.username)} · ${dayTitle(d.today, d.today, d.lang).toLowerCase()}, ${dateStr}`,
    )}

<div class="card hero reveal">
  <div class="label">${A.spentIn.replace('%s', month)}</div>
  <div class="big">${countUp(d.monthTotal)}<span class="cur">${d.sym}</span></div>
  <div class="chips">
    <div class="chip"><div class="k">${A.today}</div><div class="v">${countUp(d.todayTotal)} ${d.sym}</div></div>
    <div class="chip"><div class="k">${A.thisWeek}</div><div class="v">${countUp(d.weekTotal)} ${d.sym}</div></div>
  </div>
</div>

${kopiCard(d)}

<div class="actions reveal" style="--d:.06s">
  <button type="button" class="action voice" id="act-voice"><span class="ring">${raw(MIC_SVG)}</span>${A.voiceBtn}</button>
  <button type="button" class="action" id="act-scan"><span class="ring">${raw(SCAN_SVG)}</span>${A.scanBtn}</button>
  <button type="button" class="action" id="act-manual"><span class="ring">${raw(PLUS_SVG)}</span>${A.manualBtn}</button>
</div>

<div class="card reveal" style="--d:.1s">
  <form method="POST" id="add-form" data-today="${d.today}" data-sym="${d.sym}" autocomplete="off">
    <div class="amount-wrap"><input class="amount-input" type="text" name="amount" inputmode="decimal" placeholder="0" required aria-label="${d.lang === 'en' ? 'Amount' : 'Сумма'}"><span class="amount-cur">${d.sym}</span></div>
    <div class="form-rows">
      <label class="form-row"><span>${A.category}</span><select name="category">${catOptions()}</select></label>
      <label class="form-row"><span>${A.date}</span><input type="date" name="expense_date" value="${d.today}"></label>
      <div class="form-row"><span>${A.store}</span><input type="text" name="store" placeholder="${A.optional}" maxlength="80"><button type="button" class="loc" id="loc-btn" aria-label="${A.store}">${raw(PIN_SVG)}</button></div>
      <label class="form-row"><span>${A.note}</span><input type="text" name="note" placeholder="${A.noteEg}" maxlength="255"></label>
    </div>
    <div class="store-chips" id="store-chips"></div>
    <input type="hidden" name="barcode" value="">
    <input type="hidden" name="lat" value=""><input type="hidden" name="lon" value="">
    <input type="hidden" name="store_src" value="">
    <button type="submit">${A.addBtn}</button>
  </form>
</div>

<div class="reveal">${weekWidget(d.week, d.today, d.sym, d.lang)}</div>

${d.byCategory.length ? html`<div class="reveal">${categoriesWidget(d.byCategory, d.today, d.sym, d.lang)}</div>` : ''}

<div class="card reveal">
  <h3 style="margin-bottom:2px;">${A.recentH}</h3>
  ${d.recent.length
    ? recentRows
    : html`<div class="kopi-empty">${raw(mascot('sleep', 72, '', d.lang))}<div>${A.emptyDash}</div></div>`}
</div>

<div class="sheet-back" id="voice">
  <div class="sheet">
    <div class="grip"></div>
    <div class="voice-status" id="voice-status">${A.listening}</div>
    <canvas class="eq" id="eq"></canvas>
    <div class="voice-text" id="voice-text"></div>
    <div class="voice-hint" id="voice-hint"></div>
    <div class="sheet-actions">
      <button type="button" class="btn-gray" id="voice-cancel">${A.cancel}</button>
      <button type="button" class="stop-btn" id="voice-stop"><i></i><span>${A.done}</span></button>
    </div>
  </div>
</div>

<div class="sheet-back" id="scan">
  <div class="sheet scan-sheet">
    <div class="grip"></div>
    <div class="viewfinder" id="vf">
      <video id="scan-video" playsinline muted autoplay></video>
      <canvas id="scan-snap" class="snap" hidden></canvas>
      <button type="button" class="vf-btn" id="scan-torch" aria-label="${A.torch}">${raw(TORCH_SVG)}</button>
      <div class="frame"></div><div class="line"></div>
      <div class="vf-msg" id="vf-msg"></div>
    </div>
    <button type="button" class="btn-plain" id="scan-manual-toggle">${A.enterCode}</button>
    <div class="manual-code" id="scan-manual" hidden>
      <input type="text" id="scan-code" inputmode="numeric" placeholder="4600000000000" aria-label="${d.lang === 'en' ? 'Barcode' : 'Штрих-код'}">
      <button type="button" id="scan-code-go">${A.find}</button>
    </div>
    <div id="scan-result" hidden>
      <div class="product" id="scan-product"></div>
      <div class="photo-ask" id="scan-photo-box" hidden>
        <button type="button" class="btn-tinted" id="scan-photo">${A.byPhoto}</button>
        <input type="file" id="scan-photo-file" accept="image/*" capture="environment" hidden>
        <div class="photo-msg" id="scan-photo-msg" hidden></div>
      </div>
      <div class="prices" id="scan-prices" hidden></div>
      <div class="amount-wrap scan-step"><input class="amount-input" type="text" id="scan-amount" inputmode="decimal" placeholder="0" aria-label="${d.lang === 'en' ? 'Amount' : 'Сумма'}"><span class="amount-cur">${d.sym}</span></div>
      <div class="store-chips scan-step" id="scan-stores" style="--d:.05s"></div>
      <div class="form-rows scan-step" style="--d:.1s">
        <label class="form-row"><span>${A.name}</span><input type="text" id="scan-name" placeholder="${A.whatBought}" maxlength="255"></label>
        <label class="form-row"><span>${A.store}</span><input type="text" id="scan-store" placeholder="${A.writeOwn}" maxlength="80"></label>
        <label class="form-row"><span>${A.category}</span><select id="scan-cat">${catOptions('Еда')}</select></label>
      </div>
      <div class="footnote scan-step" style="margin:-6px 6px 14px">${A.storeNotFound}</div>
      <div class="sheet-actions scan-step" style="--d:.15s">
        <button type="button" class="btn-gray" id="scan-again">${A.again}</button>
        <button type="button" id="scan-add">${A.addExpense}</button>
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
  lang: Lang;
}) {
  const S = tr(d.lang);
  const A = S.app;
  const periods: [string, string][] = [
    ['day', A.pDay],
    ['week', A.pWeek],
    ['month', A.pMonth],
  ];
  const idx = Math.max(0, periods.findIndex(([p]) => p === d.period));
  return layout(
    { title: S.nav.friends, flashes: d.flashes, loggedIn: true, lang: d.lang, activeTab: 'friends', extraCss: FRIENDS_CSS },
    html`${header(S.nav.friends, undefined, A.friendsSub)}

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
      <div class="name">${row.is_me ? A.you : row.username}</div>
      <div class="amount">${fmt0(row.total)} ${d.sym}</div>
      ${CHEV}
    </a>`,
      )
    : html`<p style="color: var(--text-2); font-size: 15px; margin:0">${A.noFriends}</p>`}
</div>

${d.incoming.length
  ? html`<div class="section-h">${A.requestsH}</div><div class="card reveal">
  ${d.incoming.map(
    (r) => html`<div class="friend-req-row">
    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
      ${av(r.user_id, r.username)}
      <div style="font-weight:500;">${r.username}</div>
    </div>
    <div class="req-actions">
      <form method="POST" action="/friends/accept/${r.id}" style="margin:0;"><button type="submit" class="btn-accept">${A.accept}</button></form>
      <form method="POST" action="/friends/decline/${r.id}" style="margin:0;"><button type="submit" class="btn-gray">${A.decline}</button></form>
    </div>
  </div>`,
  )}
</div>`
  : ''}

<div class="section-h">${A.addFriendH}</div>
<div class="card reveal">
  <form method="POST" action="/friends/add" autocomplete="off" class="add-friend">
    <input type="search" name="friend_login" placeholder="${A.friendNick}" required
           inputmode="text" enterkeyhint="send"
           autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
           data-lpignore="true" data-1p-ignore aria-label="${A.friendNick}">
    <button type="submit">${A.invite}</button>
  </form>
</div>
<div class="footnote">${A.friendsFoot}</div>`,
  );
}

// ---------- профиль друга ----------

const BACK_SVG = '<svg viewBox="0 0 12 20"><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function friendProfilePage(d: {
  flashes: Flash[];
  sym: string;
  id: number;
  username: string;
  bio: string | null;
  friendsSince: string;
  avatarV: string | null;
  today: string;
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  week: { date: string; total: number }[];
  byCategory: { category: string; total: number }[];
  recent: ExpenseRow[];
  lang: Lang;
}) {
  const S = tr(d.lang);
  const A = S.app;
  const since = d.friendsSince.slice(0, 10);
  const sinceText = d.lang === 'en'
    ? `${S.months.short[Number(since.slice(5, 7)) - 1]} ${Number(since.slice(8, 10))}, ${since.slice(0, 4)}`
    : `${Number(since.slice(8, 10))} ${S.months.short[Number(since.slice(5, 7)) - 1]} ${since.slice(0, 4)}`;
  return layout(
    { title: d.username, flashes: d.flashes, loggedIn: true, lang: d.lang, activeTab: 'friends', extraCss: DASHBOARD_CSS + PROFILE_CSS },
    html`<header class="nav"><a class="nav-side left nav-back" href="/friends">${raw(BACK_SVG)}${A.friendsBack}</a><div class="nav-title">${d.username}</div></header>
<div class="profile-head reveal">
  <div class="avatar-wrap">
    ${d.avatarV !== null
      ? html`<img class="avatar-img" src="/avatar/${d.id}?v=${d.avatarV}" alt="">`
      : html`<div class="profile-avatar">${(d.username ? [...d.username][0] : '?').toUpperCase()}</div>`}
  </div>
  <h1 class="large-title" style="font-size:28px; line-height:34px; margin:0">${d.username}</h1>
  <div class="since">${A.friendsSince.replace('%s', sinceText)}</div>
  ${d.bio ? html`<p class="profile-bio">${d.bio}</p>` : ''}
</div>

<div class="card reveal" style="--d:.05s; padding:10px 6px">
  <div class="profile-stats">
    <div><div class="value">${countUp(d.todayTotal)} ${d.sym}</div><div class="label">${A.stToday}</div></div>
    <div><div class="value">${countUp(d.weekTotal)} ${d.sym}</div><div class="label">${A.stWeek}</div></div>
    <div><div class="value">${countUp(d.monthTotal)} ${d.sym}</div><div class="label">${A.stMonth}</div></div>
  </div>
</div>

<div class="reveal">${weekWidget(d.week, d.today, d.sym, d.lang)}</div>

${d.byCategory.length ? html`<div class="reveal">${categoriesWidget(d.byCategory, d.today, d.sym, d.lang, false)}</div>` : ''}

<div class="card reveal">
  <h3 style="margin-bottom:2px;">${A.recentExp}</h3>
  ${d.recent.length
    ? expenseRows(d.recent, d.today, d.sym, false, d.lang)
    : html`<p style="color: var(--text-2); font-size: 15px; margin:12px 0 4px;">${A.nothingYet}</p>`}
</div>

<form method="POST" action="/friends/remove/${d.id}" class="list reveal" style="margin-top:22px"
      onsubmit="return confirm('${A.removeFriendQ}');">
  <button type="submit" class="row danger"><span class="grow">${A.removeFriend}</span></button>
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
  bio: string | null;
  totalAllTime: number;
  expenseCount: number;
  friendCount: number;
  avatarV: string | null;
  apiToken: string | null;
  telegram: { bot: string; linked: boolean; tgUsername: string | null } | null;
  lang: Lang;
}) {
  const S = tr(d.lang);
  const A = S.app;
  const created = d.createdAt
    ? d.lang === 'en'
      ? `${S.months.short[Number(d.createdAt.slice(5, 7)) - 1]} ${Number(d.createdAt.slice(8, 10))}, ${d.createdAt.slice(0, 4)}`
      : `${d.createdAt.slice(8, 10)}.${d.createdAt.slice(5, 7)}.${d.createdAt.slice(0, 4)}`
    : '—';
  return layout(
    { title: S.nav.profile, flashes: d.flashes, loggedIn: true, lang: d.lang, activeTab: 'profile', extraCss: PROFILE_CSS },
    html`<header class="nav"><div class="nav-title">${d.username || A.profileFallback}</div></header>
<div class="profile-head reveal">
  <form id="avatar-form" method="POST" action="/profile/avatar" enctype="multipart/form-data">
    <div class="avatar-wrap">
      ${d.avatarV !== null
        ? html`<img class="avatar-img" src="/avatar/${d.userId}?v=${d.avatarV}" alt="${A.profilePhoto}">`
        : html`<div class="profile-avatar">${(d.username ? [...d.username][0] : '?').toUpperCase()}</div>`}
      <label class="avatar-edit" for="avatar-input" title="${A.changePhoto}">
        <svg viewBox="0 0 24 24"><path d="M4 8a2 2 0 0 1 2-2h1.5l1.2-2h6.6l1.2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>
      </label>
      <input id="avatar-input" type="file" name="avatar" accept="image/*" style="display:none;" onchange="uploadAvatar(this)">
    </div>
  </form>
  <h1 class="large-title" style="font-size:28px; line-height:34px; margin:0">${d.username || A.userFallback}</h1>
  <div class="since">${A.onboardSince.replace('%s', created)}</div>
  ${d.bio ? html`<p class="profile-bio">${d.bio}</p>` : ''}
  ${d.avatarV !== null
    ? html`<form method="POST" action="/profile/avatar/delete"><button type="submit" class="avatar-remove">${A.removePhoto}</button></form>`
    : ''}
</div>

<div class="card reveal" style="--d:.05s; padding:10px 6px">
  <div class="profile-stats">
    <div><div class="value">${countUp(d.totalAllTime)} ${d.sym}</div><div class="label">${A.spent}</div></div>
    <div><div class="value">${countUp(d.expenseCount)}</div><div class="label">${A.records}</div></div>
    <div><div class="value">${countUp(d.friendCount)}</div><div class="label">${A.friendsLabel}</div></div>
  </div>
</div>

<div class="section-h">${A.aboutH}</div>
<div class="card reveal">
  <form method="POST" action="/profile/bio" style="margin:0">
    <textarea name="bio" rows="3" maxlength="200" placeholder="${A.aboutPlaceholder}"
      style="width:100%; resize:none; box-sizing:border-box; background:var(--fill); color:var(--text); border:none; border-radius:12px; padding:12px 14px; font:inherit; font-size:15px; line-height:1.4">${d.bio ?? ''}</textarea>
    <button type="submit" style="margin-top:10px">${A.save}</button>
  </form>
</div>

${d.telegram
  ? html`<div class="section-h">${A.tgBotH}</div>
<div class="card reveal">
  ${d.telegram.linked
    ? html`<p class="token-hint" style="margin-top:0">
    ${d.telegram.tgUsername ? `${A.tgLinkedTo.replace('%s', d.telegram.tgUsername)} ` : ''}${A.tgLinkedText}
  </p>
  <a class="btn" href="https://t.me/${d.telegram.bot}">${A.openBot.replace('%s', d.telegram.bot)}</a>
  <form method="POST" action="/profile/telegram/unlink" style="margin:0;" onsubmit="return confirm('${A.disconnectQ}');">
    <button type="submit" class="btn-plain" style="color:var(--text-2)">${A.disconnect}</button>
  </form>`
    : html`<p class="token-hint" style="margin-top:0">${A.tgUnlinkedText}</p>
  <form method="POST" action="/profile/telegram" style="margin:0 0 4px;"><button type="submit">${A.connectTg}</button></form>`}
</div>`
  : ''}

<div class="section-h">${A.quickH}</div>
<div class="card reveal">
  <p class="token-hint" style="margin-top:0">${A.tokenHint}</p>
  ${d.apiToken
    ? html`<div class="token-box" id="token-text">${d.apiToken}</div>
    <div class="row-btns">
      <button type="button" id="copy-btn" onclick="copyToken()">${A.copy}</button>
      <a class="btn btn-green" href="${d.shortcutUrl}">${A.addCmd}</a>
    </div>
    <button type="button" class="btn-plain" onclick="Sheet.open('help')">${A.howWorks}</button>
    <form method="POST" action="/profile/token" style="margin:0;"
          onsubmit="return confirm('${A.newTokenQ}');">
      <button type="submit" class="btn-plain" style="color:var(--text-2)">${A.newTokenBtn}</button>
    </form>`
    : html`<form method="POST" action="/profile/token" style="margin:0 0 4px;"><button type="submit">${A.createToken}</button></form>
    <button type="button" class="btn-plain" onclick="Sheet.open('help')">${A.howWorks}</button>`}
</div>

<div class="list reveal">
  <a class="row" href="/settings"><span class="grow">${A.settingsRow}</span>${CHEV}</a>
  <a class="row danger" href="/logout"><span class="grow">${A.logoutRow}</span></a>
</div>

<div class="sheet-back" id="help">
  <div class="sheet">
    <div class="grip"></div>
    <h3>${A.helpH}</h3>
    <div class="sub">${A.helpSub}</div>
    ${A.steps.map(
      (step, i) => html`<div class="step"><div class="num">${i + 1}</div><div>
      <div class="t">${step[0]}</div>
      <div class="d">${step[1]}</div>
    </div></div>`,
    )}
    <div class="tip">${A.tip}</div>
    <button type="button" onclick="Sheet.close('help')" style="margin-top:16px;">${A.gotIt}</button>
  </div>
</div>

<script>
  var T_COPY = ${raw(JSON.stringify(A.copy))}, T_COPIED = ${raw(JSON.stringify(A.copied))}, T_AVATAR_ERR = ${raw(JSON.stringify(A.avatarErr))};
  function copyToken() {
    var el = document.getElementById('token-text');
    if (!el) return;
    var text = el.textContent.trim();
    var btn = document.getElementById('copy-btn');
    function done() {
      btn.textContent = T_COPIED;
      setTimeout(function () { btn.textContent = T_COPY; }, 1800);
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
      alert(T_AVATAR_ERR);
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
  tg: '<svg viewBox="0 0 24 24"><path d="M21 4 3 11l6 2.5M21 4l-3.5 16-8.5-6.5M21 4 9 13.5V19l3-3"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
  unlink: '<svg viewBox="0 0 24 24"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h4"/><path d="m2 2 20 20"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>',
};
const sq = (icon: keyof typeof SQ, bg: string) => raw(`<span class="sq" style="background:${bg}">${SQ[icon]}</span>`);

// Telegram в настройках: привязать аккаунт (вход на сайт через Telegram) отдельно от бота —
// бот пишет только тем, кто сам открыл его и нажал «Старт».
function telegramSettings(t: { linked: boolean; tgUsername: string | null; bot: string | null; login: boolean }, lang: Lang) {
  const A = tr(lang).app;
  if (!t.login && !t.bot) return '';
  if (!t.linked) {
    return html`<div class="section-h">${A.tgSection}</div>
<div class="list reveal" style="--inset:58px; --d:.03s">
  ${t.login
    ? html`<a class="row" href="/auth/telegram?link=1&back=settings">${sq('tg', '#2aabee')}<span class="grow">${A.linkTg}</span>${CHEV}</a>`
    : html`<form method="POST" action="/profile/telegram" style="margin:0"><button type="submit" class="row">${sq('tg', '#2aabee')}<span class="grow">${A.linkTg}</span>${CHEV}</button></form>`}
</div>
<div class="footnote">${t.login ? A.linkFootLogin : A.linkFootBot}</div>`;
  }
  return html`<div class="section-h">${A.tgSection}</div>
<div class="list reveal" style="--inset:58px; --d:.03s">
  <div class="row">${sq('tg', '#2aabee')}<span class="grow">${A.tgSection}</span><span class="value">${t.tgUsername ? `@${t.tgUsername}` : A.linked}</span></div>
  ${t.bot
    ? html`<a class="row" href="https://t.me/${t.bot}">${sq('bell', '#ff9f0a')}<span class="grow">${A.allowBot}</span>${CHEV}</a>`
    : ''}
  <form method="POST" action="/profile/telegram/unlink" style="margin:0" onsubmit="return confirm('${A.unlinkQ}');">
    <input type="hidden" name="back" value="settings">
    <button type="submit" class="row danger">${sq('unlink', '#ff453a')}<span class="grow">${A.unlinkTg}</span></button>
  </form>
</div>
<div class="footnote">${t.bot
    ? html`Чтобы бот присылал итоги дня и принимал траты сообщениями, открой @${t.bot} и нажми «Старт» — так ты разрешишь ему писать.`
    : 'Входи на сайт кнопкой «Войти через Telegram».'}</div>`;
}

export function settingsPage(d: {
  flashes: Flash[];
  username: string;
  hasPassword: boolean;
  // login — включён вход через Telegram на сайте; bot — ник бота, если бот подключён
  telegram: { linked: boolean; tgUsername: string | null; bot: string | null; login: boolean };
  currencies: Record<string, Currency>;
  currentCurrency: string;
  lang: Lang;
}) {
  const S = tr(d.lang);
  const A = S.app;
  const curLabel = (code: string, info: Currency) => `${currencyLabel(code, d.lang, info.label)} (${currencySymbol(code, d.lang, info.symbol)})`;
  const cur = d.currencies[d.currentCurrency] ?? Object.values(d.currencies)[0];
  return layout(
    { title: S.nav.settings, flashes: d.flashes, loggedIn: true, lang: d.lang, activeTab: 'settings', extraCss: SETTINGS_CSS },
    html`${header(S.nav.settings, undefined, html`${A.setLoginLabel.replace('%s', d.username)}`)}

<div class="list reveal" style="--inset:58px">
  <form method="POST" style="margin:0">
    <input type="hidden" name="action" value="change_currency">
    <label class="row" style="margin:0; font-size:17px; color:var(--text)">
      ${sq('coins', '#30d158')}<span class="grow">${A.currency}</span><span class="value">${curLabel(d.currentCurrency, cur)}</span>${CHEV}
      <select name="currency" class="overlay" onchange="this.form.submit()" aria-label="${A.currency}">
        ${Object.entries(d.currencies).map(
          ([code, info]) => html`<option value="${code}" ${code === d.currentCurrency ? 'selected' : ''}>${curLabel(code, info)}</option>`,
        )}
      </select>
    </label>
  </form>
  <form method="POST" style="margin:0">
    <input type="hidden" name="action" value="change_lang">
    <label class="row" style="margin:0; font-size:17px; color:var(--text)">
      ${sq('globe', '#0a84ff')}<span class="grow">${A.language}</span><span class="value">${LANG_LABEL[d.lang]}</span>${CHEV}
      <select name="lang" class="overlay" onchange="this.form.submit()" aria-label="${A.language}">
        ${LANGS.map((code) => html`<option value="${code}" ${code === d.lang ? 'selected' : ''}>${LANG_LABEL[code]}</option>`)}
      </select>
    </label>
  </form>
  <details class="row-group">
    <summary class="row" style="cursor:pointer">${sq('key', '#8e81ff')}<span class="grow">${A.password}</span>${CHEV}</summary>
    <form method="POST" autocomplete="off" class="expand">
      <input type="hidden" name="action" value="change_password">
      ${d.hasPassword
        ? html`<input type="password" name="current_password" required autocomplete="current-password" placeholder="${A.currentPw}" aria-label="${A.currentPw}">`
        : html`<p style="margin:0 0 4px; color:var(--text-2); font-size:14px">${raw(A.pwHintNoTg.replace('%s', `<b>${d.username}</b>`))}</p>`}
      <input type="password" name="new_password" required autocomplete="new-password" placeholder="${d.hasPassword ? A.newPwPlaceholder : A.pwPlaceholder}" aria-label="${A.newPwPlaceholder}">
      <button type="submit">${A.save}</button>
    </form>
  </details>
  <a class="row" href="/profile">${sq('bolt', '#ff9f0a')}<span class="grow">${A.quickRow}</span>${CHEV}</a>
</div>
${telegramSettings(d.telegram, d.lang)}

<div class="list reveal" style="--inset:58px; --d:.05s">
  <a class="row" href="/logout">${sq('out', '#636366')}<span class="grow">${A.logout}</span></a>
  <form method="POST" style="margin:0" onsubmit="return confirm('${A.logoutAllQ}');">
    <input type="hidden" name="action" value="logout_all">
    <button type="submit" class="row">${sq('out', '#8e81ff')}<span class="grow">${A.logoutAll}</span></button>
  </form>
  <form method="POST" action="/settings/delete_account" style="margin:0" onsubmit="return confirm('${A.deleteAccQ}');">
    <button type="submit" class="row danger">${sq('trash', '#ff453a')}<span class="grow">${A.deleteAcc}</span></button>
  </form>
</div>
<div class="footnote">${A.deleteFoot}</div>`,
  );
}

// ---------- «Мой месяц»: картинка 1080×1920 для сторис ----------
// Карточка собирается в SVG здесь, а в PNG/JPEG её превращает браузер (canvas): так Worker'у не нужна графическая библиотека.
// Шрифты только системные — SVG, нарисованный как картинка, веб-шрифты не подгружает.

export interface MonthCard {
  month: number; // 0–11
  username: string;
  sym: string;
  total: number;
  count: number;
  cats: { category: string; total: number }[]; // до трёх, по убыванию
  top: { note: string; n: number } | null; // самая частая запись
  prev: number; // сумма за те же дни прошлого месяца
  bot: string | null;
}

const CARD_COLORS = ['#8e81ff', '#5ad1c6', '#ffb35c'];

export function monthCardSvg(c: MonthCard, lang: Lang = 'ru'): string {
  const S = tr(lang);
  const A = S.app;
  const en = lang === 'en';
  const e = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const font = `-apple-system, 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`;
  const prevName = S.months.gen[(c.month + 11) % 12];
  const pct = c.prev > 0 ? Math.round((Math.abs(c.total - c.prev) / c.prev) * 100) : null;
  const cmp =
    pct === null
      ? A.cardAllControl
      : pct === 0
        ? A.cardSameAs.replace('%s', prevName)
        : A.cardDiff.replace('%d', String(pct)).replace('%s', c.total < c.prev ? A.cardLess : A.cardMore).replace('%s', prevName);
  const mood: Mood = pct === null || pct === 0 ? 'happy' : c.total < c.prev ? 'cool' : 'worried';
  const trek = mascot(mood, 300).match(/<svg[\s\S]*<\/svg>/)![0];
  const cats = c.cats
    .map((k, i) => {
      const y = 1190 + i * 118;
      const w = Math.max(16, Math.round((k.total / c.total) * 912));
      return `<text x="84" y="${y}" font-size="44" font-weight="700" fill="#fff">${e(categoryLabel(k.category, lang))}</text>
        <text x="996" y="${y}" font-size="44" font-weight="800" fill="#fff" text-anchor="end">${fmt0(k.total)} ${e(c.sym)}</text>
        <rect x="84" y="${y + 24}" width="912" height="18" rx="9" fill="rgba(255,255,255,.1)"/>
        <rect x="84" y="${y + 24}" width="${w}" height="18" rx="9" fill="${CARD_COLORS[i]}"/>`;
    })
    .join('');
  const countStr = en ? `${fmt0(c.count)} ${c.count === 1 ? 'expense' : 'expenses'}` : `${fmt0(c.count)} ${plural(c.count, 'трату', 'траты', 'трат')}`;
  const myMonth = A.cardMy.replace('%s', en ? S.months.nom[c.month] : S.months.nom[c.month].toLowerCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" font-family="${font}">
  <defs>
    <radialGradient id="mc1" cx="50%" cy="22%" r="60%"><stop offset="0" stop-color="#3a2f9a"/><stop offset="1" stop-color="#3a2f9a" stop-opacity="0"/></radialGradient>
    <radialGradient id="mc2" cx="100%" cy="100%" r="55%"><stop offset="0" stop-color="#145a6e"/><stop offset="1" stop-color="#145a6e" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1080" height="1920" fill="#08070f"/><rect width="1080" height="1920" fill="url(#mc1)"/><rect width="1080" height="1920" fill="url(#mc2)"/>
  <text x="540" y="120" font-size="38" font-weight="800" fill="rgba(235,235,245,.7)" text-anchor="middle">${e(S.brand)}</text>
  <g transform="translate(390 170)">${trek}</g>
  <text x="540" y="640" font-size="104" font-weight="900" fill="#fff" text-anchor="middle" letter-spacing="-2">${e(myMonth)}</text>
  <text x="540" y="705" font-size="40" font-weight="600" fill="rgba(235,235,245,.6)" text-anchor="middle">${e(c.username)}</text>
  <text x="540" y="890" font-size="150" font-weight="900" fill="#fff" text-anchor="middle" letter-spacing="-4">${fmt0(c.total)} ${e(c.sym)}</text>
  <text x="540" y="960" font-size="44" font-weight="600" fill="rgba(235,235,245,.7)" text-anchor="middle">${A.cardForN.replace('%s', countStr)}</text>
  <rect x="84" y="1010" width="912" height="84" rx="42" fill="rgba(255,255,255,.08)"/>
  <text x="540" y="1065" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">${e(cmp)}</text>
  ${cats}
  ${c.top ? `<text x="540" y="1600" font-size="44" font-weight="700" fill="#fff" text-anchor="middle">${e(A.cardMostOften.replace('%s', c.top.note).replace('%d', String(c.top.n)))}</text>` : ''}
  <text x="540" y="1790" font-size="36" font-weight="700" fill="rgba(235,235,245,.75)" text-anchor="middle">${c.bot ? e(A.cardInTg.replace('%s', c.bot)) : e(A.cardInApp)}</text>
  <text x="540" y="1845" font-size="32" font-weight="700" fill="rgba(235,235,245,.5)" text-anchor="middle">traaaack.app</text>
</svg>`;
}

export function monthPage(d: { flashes: Flash[]; card: MonthCard | null; canSend: boolean; lang: Lang }) {
  const S = tr(d.lang);
  const A = S.app;
  const css = `
  .mc { max-width: 380px; margin: 0 auto; display: grid; gap: 14px; }
  .mc-frame { border-radius: 22px; overflow: hidden; aspect-ratio: 9 / 16; max-width: 100%; background: #08070f; }
  .mc-frame svg, .mc-frame img { display: block; width: 100%; height: 100%; }
  .mc-hint { text-align: center; color: var(--text-2); font-size: 14px; margin: 0; }`;
  if (!d.card) {
    return layout(
      { title: A.monthTitle, flashes: d.flashes, loggedIn: true, lang: d.lang, extraCss: DASHBOARD_CSS + css },
      html`${header(A.monthTitle)}<div class="card reveal" style="text-align:center">${raw(mascot('sleep', 110, '', d.lang))}<p style="margin:12px 0 0">${A.monthEmpty}</p><a class="btn" href="/dashboard" style="margin-top:14px">${A.addExpenseBtn}</a></div>`,
    );
  }
  return layout(
    { title: A.monthTitle, flashes: d.flashes, loggedIn: true, lang: d.lang, extraCss: DASHBOARD_CSS + css },
    html`${header(A.monthTitle, undefined, html`${A.monthSub}`)}
<div class="mc reveal">
  <div class="mc-frame" id="mc-frame">${raw(monthCardSvg(d.card, d.lang))}</div>
  <button type="button" id="mc-share" hidden>${A.share}</button>
  ${d.canSend ? html`<button type="button" id="mc-send" class="btn-tinted" disabled>${A.sendTg}</button>` : ''}
  <p class="mc-hint" id="mc-hint">${A.prepImg}</p>
</div>
<script>
(function () {
  var frame = document.getElementById('mc-frame'), hint = document.getElementById('mc-hint');
  var shareBtn = document.getElementById('mc-share'), sendBtn = document.getElementById('mc-send');
  var svg = frame.querySelector('svg'), blob = null;
  var im = new Image();
  im.onload = function () {
    var c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    try {
      c.getContext('2d').drawImage(im, 0, 0, 1080, 1920);
      c.toBlob(function (b) {
        if (!b) return fail();
        blob = b;
        var img = document.createElement('img'); img.src = URL.createObjectURL(b); img.alt = ${raw(JSON.stringify(A.monthTitle))};
        frame.replaceChild(img, svg);
        var file = new File([b], 'spendtracker-month.jpg', { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          shareBtn.hidden = false;
          shareBtn.onclick = function () { navigator.share({ files: [file] }).catch(function () {}); };
        }
        if (sendBtn) sendBtn.disabled = false;
        hint.textContent = ${raw(JSON.stringify(A.holdSave))};
      }, 'image/jpeg', 0.9);
    } catch (e) { fail(); }
  };
  im.onerror = fail;
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  function fail() { hint.textContent = ${raw(JSON.stringify(A.imgFail))}; }
  if (sendBtn) sendBtn.onclick = function () {
    if (!blob) return;
    sendBtn.disabled = true; hint.textContent = ${raw(JSON.stringify(A.sending))};
    fetch('/month/send', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) { hint.textContent = j.ok ? ${raw(JSON.stringify(A.sentChat))} : ${raw(JSON.stringify(A.sendFail))}; })
      .catch(function () { hint.textContent = ${raw(JSON.stringify(A.noConn))}; })
      .then(function () { sendBtn.disabled = false; });
  };
})();
</script>`,
  );
}

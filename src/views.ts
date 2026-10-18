import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { COMMON_JS, PARSE_JS, VOICE_JS } from './client';
import { BASE_CSS, DASHBOARD_CSS, FRIENDS_CSS, PROFILE_CSS } from './styles';

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

// Число, которое плавно «докручивается» от нуля при открытии страницы
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

// Градиент для иконки активной вкладки (на него ссылается CSS через url(#tab-grad))
const SVG_DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="tab-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#a99cff"/><stop offset="1" stop-color="#45d4c4"/></linearGradient></defs></svg>';

interface LayoutOpts {
  title: string;
  flashes: Flash[];
  loggedIn: boolean;
  activeTab?: Tab;
  center?: boolean;
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
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#07080d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>${o.title}</title>
<style>
${raw(BASE_CSS)}${raw(o.extraCss ?? '')}</style>
</head>
<body>
  ${raw(SVG_DEFS)}
  <div class="${o.center ? 'center-wrap' : 'wrap'}">
    ${o.flashes.map(([cat, msg]) => html`<div class="flash ${cat}">${msg}</div>`)}
    ${content}
  </div>
  ${o.loggedIn ? html`<nav class="tabbar">${tabs}
  </nav>` : ''}
  <script>${raw(COMMON_JS)}${raw(o.scripts ?? '')}</script>
</body>
</html>`;
}

export function authPage(kind: 'login' | 'register', flashes: Flash[]) {
  const isLogin = kind === 'login';
  return layout(
    { title: isLogin ? 'Вход' : 'Регистрация', flashes, loggedIn: false, center: true },
    html`<div class="brand">СпендТрекер</div>
<div class="card">
  <h2>${isLogin ? 'Вход' : 'Регистрация'}</h2>
  <p style="color: var(--muted); font-size: 14px; margin: 0 0 16px;">${isLogin ? 'Рады видеть снова' : 'Пара секунд — и можно считать траты'}</p>
  <form method="POST">
    <label>Логин</label>
    <input type="text" name="username" required autofocus autocapitalize="off" autocorrect="off">
    <label>Пароль</label>
    <input type="password" name="password" required>
    <button type="submit" style="margin-top:4px;">${isLogin ? 'Войти' : 'Создать аккаунт'}</button>
  </form>
</div>
${isLogin
  ? html`<div class="footer-link">Нет аккаунта? <a href="/register">Зарегистрироваться</a></div>`
  : html`<div class="footer-link">Уже есть аккаунт? <a href="/login">Войти</a></div>`}`,
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
};
type IconName = keyof typeof ICONS;

// Цвет плитки и цвет сегмента на диаграмме
const COLORS: Record<string, string> = {
  blue: '#5f8cf7', green: '#2fc487', orange: '#f68a41', pink: '#ef6a9c',
  purple: '#9a72f7', teal: '#30c2b4', yellow: '#efb73d', red: '#ec5a70',
};

const ICO_RULES: [string[], string, IconName][] = [
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
}

const MONTHS_IN = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
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
    const seg = html`<circle class="seg" cx="64" cy="64" r="${R}" stroke="${COLORS[catStyle(r.category).color]}"
      stroke-dasharray="${dash.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
    offset += len;
    return seg;
  });
  return html`<div class="donut">
    <svg viewBox="0 0 128 128"><circle cx="64" cy="64" r="${R}" stroke="rgba(255,255,255,.05)"/>${segs}</svg>
    <div class="center"><div class="v">${shortNum(sum)}</div><div class="k">${sym} за месяц</div></div>
  </div>`;
}

const MIC_SVG = '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/></svg>';
const X_SVG = '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

export function dashboardPage(d: {
  flashes: Flash[];
  sym: string;
  username: string;
  categories: string[];
  today: string;
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  week: { date: string; total: number }[];
  byCategory: { category: string; total: number }[];
  recent: ExpenseRow[];
}) {
  const catSum = d.byCategory.reduce((s, r) => s + r.total, 0);
  const maxCat = Math.max(...d.byCategory.map((r) => r.total), 0);
  const maxDay = Math.max(...d.week.map((r) => r.total), 0);
  const month = MONTHS_IN[Number(d.today.slice(5, 7)) - 1];

  let lastDay = '';
  const recentRows = d.recent.map((e) => {
    const label = e.expense_date !== lastDay ? html`<div class="day-label">${dayTitle(e.expense_date, d.today)}</div>` : '';
    lastDay = e.expense_date;
    return html`${label}<div class="expense-row">
      <div style="display:flex; align-items:center; min-width:0;">
        ${ico(e.category)}
        <div style="min-width:0;">
          <div class="info">${e.note ? e.note : e.category}</div>
          <div class="cat">${e.category}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="amt">${fmt0(e.amount)} ${d.sym}</div>
        <form method="POST" action="/delete/${e.id}" style="margin:0;" onsubmit="return confirm('Удалить запись?');">
          <button type="submit" class="btn-danger btn-icon" aria-label="Удалить">${raw(X_SVG)}</button>
        </form>
      </div>
    </div>`;
  });

  return layout(
    {
      title: 'Мои траты',
      flashes: d.flashes,
      loggedIn: true,
      activeTab: 'dashboard',
      extraCss: DASHBOARD_CSS,
      scripts: PARSE_JS + VOICE_JS,
    },
    html`<div class="page-title">Привет, ${d.username} <span class="sub">${dayTitle(d.today, d.today)}, ${Number(d.today.slice(8, 10))} ${MONTHS_SHORT[Number(d.today.slice(5, 7)) - 1]}</span></div>

<div class="card hero">
  <div class="label">Потрачено в ${month}</div>
  <div class="big">${countUp(d.monthTotal)}<span class="cur">${d.sym}</span></div>
  <div class="chips">
    <div class="chip"><div class="k">Сегодня</div><div class="v">${countUp(d.todayTotal)} ${d.sym}</div></div>
    <div class="chip"><div class="k">Эта неделя</div><div class="v">${countUp(d.weekTotal)} ${d.sym}</div></div>
  </div>
</div>

<div class="card">
  <div class="add-head">
    <h3>Добавить трату</h3>
    <button type="button" class="mic-btn" id="mic-btn">${raw(MIC_SVG)}Голосом</button>
  </div>
  <form method="POST" id="add-form" data-today="${d.today}">
    <label>Сумма</label>
    <input type="text" name="amount" inputmode="decimal" placeholder="Например 350" required>
    <div class="row-2">
      <div>
        <label>Категория</label>
        <select name="category">
          ${d.categories.map((c) => html`<option value="${c}">${c}</option>`)}
        </select>
      </div>
      <div>
        <label>Дата</label>
        <input type="date" name="expense_date" value="${d.today}">
      </div>
    </div>
    <label>Заметка (необязательно)</label>
    <input type="text" name="note" placeholder="Кофе с другом">
    <button type="submit">Добавить</button>
  </form>
</div>

<div class="card">
  <div class="card-head"><h3>Последние 7 дней</h3><span class="hint">${fmt0(d.week.reduce((s, r) => s + r.total, 0))} ${d.sym}</span></div>
  <div class="week">
    ${d.week.map((r) => {
      const h = maxDay ? Math.max(6, Math.round((r.total / maxDay) * 100)) : 6;
      const dow = WEEKDAYS[new Date(r.date + 'T00:00:00Z').getUTCDay()];
      return html`<div class="col ${r.date === d.today ? 'today' : ''}">
        <div class="bar-wrap" style="--h: ${h}%">
          ${r.total ? html`<span class="val">${shortNum(r.total)}</span>` : ''}
          <div class="bar" style="height: ${h}%"></div>
        </div>
        <div class="day">${dow}</div>
      </div>`;
    })}
  </div>
</div>

${d.byCategory.length
  ? html`<div class="card">
  <div class="card-head"><h3>Категории</h3><span class="hint">${MONTHS_NOM[Number(d.today.slice(5, 7)) - 1]}</span></div>
  <div class="donut-wrap">
    ${donut(d.byCategory, catSum, d.sym)}
    <div class="legend">
      ${d.byCategory.slice(0, 5).map(
        (r) => html`<div class="row"><span class="dot" style="background:${COLORS[catStyle(r.category).color]}"></span><span class="name">${r.category}</span><span class="pct">${Math.round((r.total / catSum) * 100)}%</span></div>`,
      )}
    </div>
  </div>
  <div class="cat-list">
  ${d.byCategory.map(
    (r) => html`<div class="cat-item">
    ${ico(r.category)}
    <div style="flex:1; min-width:0;">
      <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:15px; font-weight:600;">
        <span>${r.category}</span>
        <span>${fmt0(r.total)} ${d.sym}</span>
      </div>
      <div class="cat-bar" style="margin:0;">
        <div class="track"><div class="fill" style="width: ${maxCat ? Math.round((r.total / maxCat) * 100) : 0}%;"></div></div>
      </div>
    </div>
  </div>`,
  )}
  </div>
</div>`
  : ''}

<div class="card">
  <h3 style="margin-bottom:2px;">Последние записи</h3>
  ${d.recent.length
    ? recentRows
    : html`<p style="color: var(--muted); font-size: 14px; margin:12px 0 4px;">Пока нет записей — добавь первую трату выше или скажи её голосом.</p>`}
</div>

<div class="voice-back" id="voice">
  <div class="voice-sheet">
    <div class="grip"></div>
    <div class="voice-status" id="voice-status">Слушаю…</div>
    <canvas class="eq" id="eq"></canvas>
    <div class="voice-text" id="voice-text"></div>
    <div class="voice-hint" id="voice-hint"></div>
    <div class="voice-actions">
      <button type="button" class="btn-secondary" id="voice-cancel">Отмена</button>
      <button type="button" class="stop-btn" id="voice-stop"><i></i>Готово</button>
    </div>
  </div>
</div>`,
  );
}

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
  return layout(
    { title: 'Друзья', flashes: d.flashes, loggedIn: true, activeTab: 'friends' },
    html`<style>
${raw(FRIENDS_CSS)}</style>

<div class="page-title">Рейтинг друзей</div>

<div class="period-switch">
  ${periods.map(([p, label]) => html`<a href="/friends?period=${p}" class="${d.period === p ? 'active' : ''}">${label}</a>`)}
</div>

<div class="card">
  ${d.board.length
    ? d.board.map(
        (row, i) => html`<div class="board-row ${i === 0 ? 'rank-1' : ''} ${row.is_me ? 'me' : ''}">
      <div class="rank">${i + 1}</div>
      ${av(row.id, row.username)}
      <div class="name">${row.is_me ? 'Ты' : row.username}</div>
      <div class="amount">${fmt0(row.total)} ${d.sym}</div>
    </div>`,
      )
    : html`<p style="color: var(--muted); font-size: 14px;">Пока никого нет в списке.</p>`}
</div>

${d.incoming.length
  ? html`<div class="card">
  <h3 style="margin-bottom:6px;">Заявки в друзья</h3>
  ${d.incoming.map(
    (r) => html`<div class="friend-req-row">
    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
      ${av(r.user_id, r.username)}
      <div style="font-weight:600;">${r.username}</div>
    </div>
    <div class="req-actions">
      <form method="POST" action="/friends/accept/${r.id}" style="margin:0;">
        <button type="submit" class="btn-accept">Принять</button>
      </form>
      <form method="POST" action="/friends/decline/${r.id}" style="margin:0;">
        <button type="submit" class="btn-danger">Отклонить</button>
      </form>
    </div>
  </div>`,
  )}
</div>`
  : ''}

<div class="card">
  <h3 style="margin-bottom:14px;">Добавить друга</h3>
  <form method="POST" action="/friends/add" autocomplete="off">
    <label>Кого добавить</label>
    <input type="search" name="friend_login" placeholder="Имя друга" required
           inputmode="text" enterkeyhint="send"
           autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
           data-lpignore="true" data-1p-ignore>
    <button type="submit">Отправить заявку</button>
  </form>
</div>`,
  );
}

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
}) {
  const created = d.createdAt
    ? `${d.createdAt.slice(8, 10)}.${d.createdAt.slice(5, 7)}.${d.createdAt.slice(0, 4)}`
    : '—';
  return layout(
    { title: 'Профиль', flashes: d.flashes, loggedIn: true, activeTab: 'profile' },
    html`<style>
${raw(PROFILE_CSS)}</style>

<div class="card" style="text-align:center; margin-top:20px;">
  <form id="avatar-form" method="POST" action="/profile/avatar" enctype="multipart/form-data">
    <div class="avatar-wrap">
      ${d.avatarV !== null
        ? html`<img class="avatar-img" src="/avatar/${d.userId}?v=${d.avatarV}" alt="Фото профиля">`
        : html`<div class="profile-avatar">${(d.username ? [...d.username][0] : '?').toUpperCase()}</div>`}
      <label class="avatar-edit" for="avatar-input" title="Сменить фото">
        <svg viewBox="0 0 24 24"><path d="M4 8a2 2 0 0 1 2-2h1.5l1.2-2h6.6l1.2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>
      </label>
      <input id="avatar-input" type="file" name="avatar" accept="image/*" style="display:none;"
             onchange="uploadAvatar(this)">
    </div>
  </form>

  ${d.avatarV !== null
    ? html`<form method="POST" action="/profile/avatar/delete">
    <button type="submit" class="avatar-remove">Удалить фото</button>
  </form>`
    : ''}

  <h2>${d.username || 'Пользователь'}</h2>
  <div style="color: var(--muted); font-size: 13px;">
    На борту с ${created}
  </div>

  <div class="profile-stats">
    <div class="stat"><div class="value">${fmt0(d.totalAllTime)} ${d.sym}</div><div class="label">Всего потрачено</div></div>
    <div class="stat"><div class="value">${d.expenseCount}</div><div class="label">Записей</div></div>
    <div class="stat"><div class="value">${d.friendCount}</div><div class="label">Друзей</div></div>
  </div>
</div>

<div class="card">
  <h3 style="margin-bottom:6px;">⚡ Быстрая трата с iPhone</h3>
  <p class="token-hint">
    Добавляй траты в два касания через приложение «Команды». Токен никому не показывай:
    с ним можно добавлять траты от твоего имени.
  </p>

  ${d.apiToken
    ? html`<div class="token-box" id="token-text">${d.apiToken}</div>
    <div class="row-btns">
      <button type="button" id="copy-btn" onclick="copyToken()">1. Скопировать токен</button>
      <a class="btn btn-green" href="${d.shortcutUrl}" style="display:block;">2. Добавить команду</a>
    </div>
    <button type="button" class="btn-secondary" onclick="openHelp()" style="margin-bottom:10px;">Открыть инструкцию</button>
    <form method="POST" action="/profile/token" style="margin:0;"
          onsubmit="return confirm('Старый токен перестанет работать, и команду придётся обновить. Продолжить?');">
      <button type="submit" class="avatar-remove" style="display:block; margin:0 auto;">Создать новый токен</button>
    </form>`
    : html`<form method="POST" action="/profile/token" style="margin:0 0 10px;">
      <button type="submit">Создать токен</button>
    </form>
    <button type="button" class="btn-secondary" onclick="openHelp()">Открыть инструкцию</button>`}
</div>

<div class="card">
  <a href="/logout" class="btn btn-secondary" style="display:block; text-align:center;">Выйти из аккаунта</a>
</div>

<div class="sheet-back" id="help" onclick="if (event.target === this) closeHelp()">
  <div class="sheet">
    <div class="sheet-grip"></div>
    <h3>Как добавить команду</h3>
    <div class="sub">Это нужно сделать один раз, займёт минуту.</div>

    <div class="step"><div class="num">1</div><div>
      <div class="t">Создай токен</div>
      <div class="d">Закрой это окно и нажми кнопку <b>«Создать токен»</b> в карточке «Быстрая трата». Если токен уже есть, переходи к шагу 2.</div>
    </div></div>

    <div class="step"><div class="num">2</div><div>
      <div class="t">Скопируй токен</div>
      <div class="d">Нажми <b>«1. Скопировать токен»</b>. Кнопка на секунду покажет «Скопировано».</div>
    </div></div>

    <div class="step"><div class="num">3</div><div>
      <div class="t">Открой команду</div>
      <div class="d">Нажми <b>«2. Добавить команду»</b>. Откроется приложение «Команды» с командой «Трата».</div>
    </div></div>

    <div class="step"><div class="num">4</div><div>
      <div class="t">Вставь токен</div>
      <div class="d">Телефон спросит токен. Нажми на поле, выбери <b>«Вставить»</b> и нажми <b>«Добавить команду»</b>.</div>
    </div></div>

    <div class="step"><div class="num">5</div><div>
      <div class="t">Готово, пользуйся</div>
      <div class="d">Запусти команду «Трата»: введи сумму, выбери категорию и напиши заметку. Трата сразу появится в приложении.</div>
    </div></div>

    <div class="tip">
      <b>Совет:</b> чтобы запускать команду с главного экрана, открой её в «Командах», нажми «Поделиться» и выбери <b>«На экран Домой»</b>.
    </div>

    <button type="button" onclick="closeHelp()" style="margin-top:16px;">Понятно</button>
  </div>
</div>

<script>
  function openHelp() {
    document.getElementById('help').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeHelp() {
    document.getElementById('help').classList.remove('open');
    document.body.style.overflow = '';
  }

  function copyToken() {
    var el = document.getElementById('token-text');
    if (!el) return;
    var text = el.textContent.trim();
    var btn = document.getElementById('copy-btn');
    function done() {
      btn.textContent = 'Скопировано ✓';
      setTimeout(function () { btn.textContent = '1. Скопировать токен'; }, 1800);
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

export function settingsPage(d: {
  flashes: Flash[];
  username: string;
  currencies: Record<string, Currency>;
  currentCurrency: string;
}) {
  return layout(
    { title: 'Настройки', flashes: d.flashes, loggedIn: true, activeTab: 'settings' },
    html`<div class="page-title">Настройки</div>

<div class="card">
  <h3>Сменить пароль</h3>
  <form method="POST" autocomplete="off">
    <input type="hidden" name="action" value="change_password">
    <label>Текущий пароль</label>
    <input type="password" name="current_password" required autocomplete="current-password">
    <label>Новый пароль</label>
    <input type="password" name="new_password" required autocomplete="new-password">
    <button type="submit">Сохранить</button>
  </form>
</div>

<div class="card">
  <h3>Валюта</h3>
  <form method="POST">
    <input type="hidden" name="action" value="change_currency">
    <label>Валюта для отображения сумм</label>
    <select name="currency" onchange="this.form.submit()">
      ${Object.entries(d.currencies).map(
        ([code, info]) =>
          html`<option value="${code}" ${code === d.currentCurrency ? 'selected' : ''}>${info.label} (${info.symbol})</option>`,
      )}
    </select>
  </form>
</div>

<div class="card">
  <h3>Аккаунт</h3>
  <p style="color: var(--muted); font-size: 13px;">Логин: ${d.username}</p>
  <form method="POST" action="/settings/delete_account" onsubmit="return confirm('Точно удалить аккаунт? Это необратимо.');">
    <button type="submit" class="btn-danger" style="width:100%; text-align:center;">Удалить аккаунт</button>
  </form>
</div>`,
  );
}

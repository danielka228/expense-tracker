import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { BASE_CSS, FRIENDS_CSS, PROFILE_CSS } from './styles';

type H = HtmlEscapedString | Promise<HtmlEscapedString>;
export type Flash = [category: string, message: string];

export interface Currency {
  label: string;
  symbol: string;
}

// Аналог '%.0f'|format(x) из Jinja (Python округляет .5 к чётному: 350.5 -> 350)
export const fmt0 = (n: number) => {
  const x = Number(n) || 0;
  const r = Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : Math.round(x);
  return (r || 0).toFixed(0);
};

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

interface LayoutOpts {
  title: string;
  flashes: Flash[];
  loggedIn: boolean;
  activeTab?: Tab;
  center?: boolean;
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
<meta name="theme-color" content="#000000">
<title>${o.title}</title>
<style>
${raw(BASE_CSS)}</style>
</head>
<body>
  <div class="${o.center ? 'center-wrap' : 'wrap'}">
    ${o.flashes.map(([cat, msg]) => html`<div class="flash ${cat}">${msg}</div>`)}
    ${content}
  </div>
  ${o.loggedIn ? html`<div class="tabbar">${tabs}
  </div>` : ''}
</body>
</html>`;
}

export function authPage(kind: 'login' | 'register', flashes: Flash[]) {
  const isLogin = kind === 'login';
  return layout(
    { title: isLogin ? 'Вход' : 'Регистрация', flashes, loggedIn: false, center: true },
    html`<div class="brand">💸 СпендТрекер</div>
<div class="card">
  <h2>${isLogin ? 'Вход' : 'Регистрация'}</h2>
  <form method="POST">
    <label>Логин</label>
    <input type="text" name="username" required autofocus>
    <label>Пароль</label>
    <input type="password" name="password" required>
    <button type="submit">${isLogin ? 'Войти' : 'Создать аккаунт'}</button>
  </form>
</div>
${isLogin
  ? html`<div class="footer-link">Нет аккаунта? <a href="/register">Зарегистрироваться</a></div>`
  : html`<div class="footer-link">Уже есть аккаунт? <a href="/login">Войти</a></div>`}`,
  );
}

const ICO_RULES: [string[], string, string][] = [
  [['еда', 'продукт', 'кафе', 'ресторан'], 'orange', '🍔'],
  [['транспорт', 'такси', 'авто', 'бензин'], 'blue', '🚕'],
  [['дом', 'жиль', 'аренд', 'коммунал'], 'teal', '🏠'],
  [['развлеч', 'кино', 'игр'], 'purple', '🎮'],
  [['здоров', 'аптек', 'врач'], 'red', '💊'],
  [['одежд', 'шопинг', 'покуп'], 'pink', '🛍️'],
  [['подар'], 'pink', '🎁'],
  [['подпис', 'связ', 'интернет'], 'teal', '📲'],
  [['путеш', 'отпуск', 'поездк'], 'yellow', '✈️'],
  [['обуч', 'курс', 'книг'], 'green', '📚'],
];
const ICO_COLORS = ['blue', 'green', 'orange', 'pink', 'purple', 'teal', 'yellow', 'red'];

function ico(cat: string) {
  const c = cat.toLowerCase();
  for (const [words, color, emoji] of ICO_RULES) {
    if (words.some((w) => c.includes(w))) return html`<span class="ico ${color}">${emoji}</span>`;
  }
  return html`<span class="ico ${ICO_COLORS[[...cat].length % 8]}">💳</span>`;
}

export interface ExpenseRow {
  id: number;
  amount: number;
  category: string;
  note: string | null;
  expense_date: string;
}

export function dashboardPage(d: {
  flashes: Flash[];
  sym: string;
  categories: string[];
  today: string;
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  byCategory: { category: string; total: number }[];
  recent: ExpenseRow[];
}) {
  const maxVal = Math.max(...d.byCategory.map((r) => r.total), 0);
  const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
  return layout(
    { title: 'Мои траты', flashes: d.flashes, loggedIn: true, activeTab: 'dashboard' },
    html`<div class="brand" style="margin-bottom:18px; font-size:24px;">💸 СпендТрекер</div>

<div class="stats-grid">
  <div class="stat"><div class="value">${fmt0(d.todayTotal)}</div><div class="label">Сегодня</div></div>
  <div class="stat"><div class="value">${fmt0(d.weekTotal)}</div><div class="label">Неделя</div></div>
  <div class="stat"><div class="value">${fmt0(d.monthTotal)}</div><div class="label">Месяц</div></div>
</div>

<div class="card">
  <h3 style="margin-bottom:14px;">Добавить трату</h3>
  <form method="POST">
    <label>Сумма</label>
    <input type="text" name="amount" inputmode="decimal" placeholder="Например 350" required autofocus>
    <label>Категория</label>
    <select name="category">
      ${d.categories.map((c) => html`<option value="${c}">${c}</option>`)}
    </select>
    <label>Дата</label>
    <input type="date" name="expense_date" value="${d.today}">
    <label>Заметка (необязательно)</label>
    <input type="text" name="note" placeholder="Кофе с другом">
    <button type="submit">Добавить</button>
  </form>
</div>

${d.byCategory.length
  ? html`<div class="card">
  <h3 style="margin-bottom:14px;">По категориям (месяц)</h3>
  ${d.byCategory.map(
    (r) => html`<div style="display:flex; align-items:center; margin-bottom:14px;">
    ${ico(r.category)}
    <div style="flex:1; min-width:0;">
      <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:15px; font-weight:600;">
        <span>${r.category}</span>
        <span>${fmt0(r.total)} ${d.sym}</span>
      </div>
      <div class="cat-bar" style="margin:0;">
        <div class="track"><div class="fill" style="width: ${maxVal ? Math.round((r.total / maxVal) * 100) : 0}%;"></div></div>
      </div>
    </div>
  </div>`,
  )}
</div>`
  : ''}

<div class="card">
  <h3 style="margin-bottom:6px;">Последние записи</h3>
  ${d.recent.length
    ? d.recent.map(
        (e) => html`<div class="expense-row">
      <div style="display:flex; align-items:center; min-width:0;">
        ${ico(e.category)}
        <div class="info">
          ${e.note ? e.note : e.category}
          <div class="cat">${ddmm(e.expense_date)} · ${e.category}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="amt">${fmt0(e.amount)} ${d.sym}</div>
        <form method="POST" action="/delete/${e.id}" style="margin:0;">
          <button type="submit" class="btn-danger">✕</button>
        </form>
      </div>
    </div>`,
      )
    : html`<p style="color: var(--muted); font-size: 14px; margin:12px 0 4px;">Пока нет записей — добавь первую трату выше.</p>`}
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

<div class="brand" style="margin-bottom:18px; font-size:24px;">🏆 Рейтинг друзей</div>

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
    html`<div class="brand" style="margin-bottom:16px; font-size:22px;">⚙️ Настройки</div>

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

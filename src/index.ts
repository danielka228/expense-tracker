import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, getSignedCookie, setCookie, setSignedCookie } from 'hono/cookie';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { recognizeProduct, takeAiQuota } from './vision';
import { cleanupLimits, hit } from './limits';
import { lookupProduct, nearbyStores, priceHistory, rememberPlace, rememberProduct } from './lookup';
import { checkPassword, hashPassword, needsRehash } from './passwords';
import { categoryId, currencySymbol, tr, langOf, type Lang } from './i18n';
import { convert } from './money';
import { loadWrapped, monthBounds, pickMonth } from './wrapped';
import { SUB_PERIODS, chargeDue, insertSub, perMonth, rollForward, subColor, subsText, type Sub, type SubPeriod } from './subs';
import { authorizeUrl, finishLogin, newLoginState, type TgIdentity, type TgLoginConfig, type TgLoginState } from './tglogin';
import {
  botApi,
  botFileApi,
  botUsername,
  handleUpdate,
  sendAdminReport,
  sendEveningDigests,
  sendSubReminders,
  sendWrappedInvites,
  sendPhoto,
  sendWeeklyDigests,
  tg,
  verifyInitData,
  webhookSecret,
  type BotDeps,
  type TgUpdate,
} from './telegram';
import {
  authPage,
  forgotPage,
  landingPage,
  resetPage,
  dashboardPage,
  friendsPage,
  tgAppPage,
  tgNewAccountPage,
  friendProfilePage,
  monthPage,
  profilePage,
  settingsPage,
  subsPage,
  wrappedPage,
  adminPage,
  type AdminData,
  type Currency,
  type ExpenseRow,
  type Flash,
  type SubView,
} from './views';

type Env = {
  DB: D1Database;
  SECRET_KEY: string;
  SHORTCUT_URL?: string;
  DEMO?: string; // "1" — демо-версия с кнопкой «Войти в демо»
  TELEGRAM_BOT_TOKEN?: string; // токен от @BotFather; workflow кладёт его из секрета GitHub
  TELEGRAM_ADMIN_ID?: string; // Telegram ID владельца — ему одному доступна /admin (секрет из GitHub)
  SITE_URL?: string; // красивый адрес сайта (https://traaaack.app): бот показывает его в ссылках; ставит деплой
  TELEGRAM_API?: string; // только для локальной проверки: адрес заглушки вместо api.telegram.org
  TELEGRAM_LOGIN_CLIENT_ID?: string; // «Войти через Telegram»: Client ID и Client Secret из @BotFather (секреты GitHub)
  TELEGRAM_LOGIN_CLIENT_SECRET?: string;
  TELEGRAM_OAUTH?: string; // только для локальной проверки: адрес заглушки вместо oauth.telegram.org
  ASSETS: Fetcher; // статика из public/
  AI?: Ai; // Workers AI: распознавание голосовых в Telegram-боте
};

interface User {
  id: number;
  username: string;
  password_hash: string;
  currency: string;
  created_at: string | null;
  session_ver: number;
  bio: string | null;
  lang: string;
}

type App = { Bindings: Env; Variables: { user: User } };
type C = Context<App>;

const CATEGORIES = ['Еда', 'Транспорт', 'Жильё', 'Развлечения', 'Здоровье', 'Одежда', 'Табак', 'Прочее'];

const CURRENCIES: Record<string, Currency> = {
  RUB: { label: 'Российский рубль', symbol: '₽' },
  KZT: { label: 'Казахстанский тенге', symbol: '₸' },
  USD: { label: 'Доллар США', symbol: '$' },
  AED: { label: 'Дирхам ОАЭ', symbol: 'AED' },
  EUR: { label: 'Евро', symbol: '€' },
  KGS: { label: 'Киргизский сом', symbol: 'сом' },
  UZS: { label: 'Узбекский сум', symbol: 'сум' },
};

const DEFAULT_SHORTCUT_URL = 'https://www.icloud.com/shortcuts/6c88ade890e541c9b81532cfbc4cdb59';
const SESSION_COOKIE = 'session';
const FLASH_COOKIE = 'flash';
const TG_STATE_COOKIE = 'tg_login'; // state/nonce/PKCE на время входа через Telegram
const TG_PENDING_COOKIE = 'tg_pending'; // проверенный Telegram, который ещё не привязан ни к одному аккаунту
const SESSION_MAX_AGE = 90 * 24 * 3600;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const app = new Hono<App>();

// www.traaaack.app → traaaack.app (только чтение страниц: запросы с данными, например вебхук, не трогаем)
app.use('*', async (c, next) => {
  const u = new URL(c.req.url);
  if (u.hostname.startsWith('www.') && (c.req.method === 'GET' || c.req.method === 'HEAD')) {
    u.hostname = u.hostname.slice(4);
    return c.redirect(u.toString(), 301);
  }
  await next();
});

// Защита от подделки запросов с чужих сайтов (вдобавок к SameSite у кук): формы и fetch с другого
// сайта браузер помечает его Origin — такие запросы не пускаем. Без Origin приходят вебхук Telegram
// и «Быстрые команды» iPhone — им это не мешает.
const CROSS_SITE_OK = ['/tg/webhook', '/api/add'];
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('Origin');
    const url = new URL(c.req.url);
    if (origin && origin !== url.origin && !CROSS_SITE_OK.includes(url.pathname)) return c.text('Forbidden', 403);
  }
  await next();
});

// Защитные заголовки для всех ответов Worker'а. Встраивание во фрейм разрешено только Telegram Web:
// там открывается сайт как Mini App.
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self)',
  'Content-Security-Policy': "frame-ancestors 'self' https://web.telegram.org https://webk.telegram.org https://webz.telegram.org",
};
app.use('*', async (c, next) => {
  await next();
  try {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!c.res.headers.has(k)) c.res.headers.set(k, v);
  } catch {
    // ответ с неизменяемыми заголовками — отдаём как есть
  }
});

// ---------- сессия и flash-сообщения ----------

// Кука входа — «<id>.<версия сессий>», подписанная SECRET_KEY. Версию увеличивают смена пароля и
// «Выйти на всех устройствах», после чего все старые куки этого человека перестают приниматься.
// Старые куки без версии считаются версией 0.
async function getSessionUserId(c: C): Promise<number | null> {
  const raw = await getSignedCookie(c, c.env.SECRET_KEY, SESSION_COOKIE);
  const [idPart, verPart = '0'] = (raw || '').split('.');
  const id = Number(idPart);
  const ver = Number(verPart);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(ver)) return null;
  const row = await c.env.DB.prepare('SELECT session_ver FROM users WHERE id = ?').bind(id).first<{ session_ver: number }>();
  return row && row.session_ver === ver ? id : null;
}

async function login(c: C, userId: number) {
  const row = await c.env.DB.prepare('SELECT session_ver, lang FROM users WHERE id = ?').bind(userId).first<{ session_ver: number; lang: string }>();
  await setSignedCookie(c, SESSION_COOKIE, `${userId}.${row?.session_ver ?? 0}`, c.env.SECRET_KEY, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_MAX_AGE,
  });
  // Язык страниц до входа читается из cookie — ставим её под язык аккаунта, чтобы было единообразно
  setCookie(c, 'lang', langOf(row?.lang), { path: '/', maxAge: 400 * 24 * 3600, sameSite: 'Lax' });
}

// Отзывает все входы человека; текущее устройство остаётся в аккаунте
async function revokeSessions(c: C, userId: number) {
  await c.env.DB.prepare('UPDATE users SET session_ver = session_ver + 1 WHERE id = ?').bind(userId).run();
  await login(c, userId);
}

const clientIp = (c: C) => c.req.header('CF-Connecting-IP') ?? 'unknown';
const MIN_PASSWORD = 8;

function logout(c: C) {
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
}

function flash(c: C, message: string, category: 'success' | 'error') {
  const existing = readFlashes(c);
  existing.push([category, message]);
  setCookie(c, FLASH_COOKIE, encodeURIComponent(JSON.stringify(existing)), {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  });
}

function readFlashes(c: C): Flash[] {
  const raw = getCookie(c, FLASH_COOKIE);
  if (!raw) return [];
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(v) ? v.filter((x) => Array.isArray(x) && x.length === 2).map((x) => [String(x[0]), String(x[1])]) : [];
  } catch {
    return [];
  }
}

function popFlashes(c: C): Flash[] {
  const f = readFlashes(c);
  if (f.length) deleteCookie(c, FLASH_COOKIE, { path: '/', secure: true });
  return f;
}

function symbol(user: User) {
  const code = user.currency in CURRENCIES ? user.currency : 'RUB';
  return currencySymbol(code, langOf(user.lang), CURRENCIES[code].symbol);
}

// ---------- даты (UTC, как было на Render) ----------

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function periodStart(period: string): string {
  const today = todayUtc();
  if (period === 'day') return isoDate(today);
  if (period === 'week') {
    const weekday = (today.getUTCDay() + 6) % 7; // понедельник = 0
    return isoDate(new Date(today.getTime() - weekday * 86400000));
  }
  return isoDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
}

// ---------- хелперы БД ----------

async function spentSince(db: D1Database, userId: number, since: string): Promise<number> {
  const r = await db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND expense_date >= ?')
    .bind(userId, since)
    .first<{ total: number }>();
  return r?.total ?? 0;
}

async function getFriendIds(db: D1Database, userId: number): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT CASE WHEN from_user_id = ?1 THEN to_user_id ELSE from_user_id END AS fid
       FROM friendships WHERE status = 'accepted' AND (from_user_id = ?1 OR to_user_id = ?1)`,
    )
    .bind(userId)
    .all<{ fid: number }>();
  return [...new Set(results.map((r) => r.fid))];
}

/** Достаёт число из строки: убирает пробелы (в т.ч. неразрывные), знаки валюты и т.п. */
function parseAmount(raw: unknown): number {
  let s = String(raw).replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dots = (s.match(/\./g) ?? []).length;
  if (dots > 1) {
    const i = s.lastIndexOf('.');
    s = s.slice(0, i).replace(/\./g, '') + '.' + s.slice(i + 1);
  }
  if (s === '' || s === '.') throw new Error('bad amount');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error('bad amount');
  return n;
}

function formStr(form: Record<string, unknown>, name: string): string {
  const v = form[name];
  return typeof v === 'string' ? v : '';
}

// ---------- проверка входа ----------

const loginRequired = async (c: C, next: () => Promise<void>) => {
  const uid = await getSessionUserId(c);
  if (!uid) return c.redirect('/login');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first<User>();
  if (!user) {
    logout(c);
    flash(c, flashT(c).sessionExpired, 'error');
    return c.redirect('/login');
  }
  c.set('user', user);
  await next();
};

for (const p of ['/dashboard', '/subs', '/subs/*', '/wrapped', '/month', '/month/*', '/delete/*', '/friends', '/friends/*', '/profile', '/profile/*', '/avatar/*', '/settings', '/settings/*', '/admin', '/api/product/*', '/api/stores']) {
  app.use(p, loginRequired);
}

// ---------- маршруты ----------

// Язык страниц до входа берём из cookie (переключатель RU/EN ставит её); по умолчанию русский.
const pageLang = (c: C): Lang => langOf(getCookie(c, 'lang'));
// Язык для залогиненных: предпочитаем язык аккаунта, иначе cookie.
const uiLang = (c: C): Lang => langOf((c.get('user') as User | undefined)?.lang ?? getCookie(c, 'lang'));
const flashT = (c: C) => tr(uiLang(c)).fl;

app.get('/lang/:code', (c) => {
  const code = langOf(c.req.param('code'));
  setCookie(c, 'lang', code, { path: '/', maxAge: 400 * 24 * 3600, sameSite: 'Lax' });
  const next = c.req.query('next') || '/';
  const safe = /^\/[a-z0-9_/?=&.-]*$/i.test(next) && !next.startsWith('//') ? next : '/';
  return c.redirect(safe);
});

app.get('/', async (c) => {
  if (await getSessionUserId(c)) return c.redirect('/dashboard');
  return c.html(landingPage({ demo: c.env.DEMO === '1', origin: new URL(c.req.url).origin, lang: pageLang(c) }));
});

const authOpts = async (c: C) => ({ origin: new URL(c.req.url).origin, demo: c.env.DEMO === '1', tgLogin: !!tgLoginConfig(c), tgPending: !!(await readTgPending(c)), lang: pageLang(c) });
app.get('/register', async (c) => c.html(authPage('register', popFlashes(c), await authOpts(c))));
app.post('/register', async (c) => {
  const form = await c.req.parseBody();
  const username = formStr(form, 'username').trim();
  const password = formStr(form, 'password');
  const fail = async (msg: string) => c.html(authPage('register', [...popFlashes(c), ['error', msg]], await authOpts(c)));

  const fe = tr(pageLang(c)).fe;
  if (!username || !password) return fail(fe.fillAll);
  if (password.length < MIN_PASSWORD) return fail(fe.pwShort.replace('%d', String(MIN_PASSWORD)));
  if (!(await hit(c.env.DB, `register:${clientIp(c)}`, 5, 3600))) return fail(fe.tooManyReg);
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first()) {
    return fail(fe.userExists);
  }

  const row = await c.env.DB.prepare('INSERT INTO users (username, password_hash, lang) VALUES (?, ?, ?) RETURNING id')
    .bind(username, hashPassword(password), pageLang(c))
    .first<{ id: number }>();
  await login(c, row!.id);
  await linkPendingTelegram(c, row!.id);
  flash(c, tr(pageLang(c)).fe.regSuccess, 'success');
  return c.redirect('/dashboard');
});

app.get('/login', async (c) => c.html(authPage('login', popFlashes(c), await authOpts(c))));
app.post('/login', async (c) => {
  const form = await c.req.parseBody();
  const username = formStr(form, 'username').trim();
  const password = formStr(form, 'password');
  // Перебор паролей: не больше 20 попыток за 10 минут с одного адреса и 10 — к одному логину
  const db = c.env.DB;
  if (!(await hit(db, `login-ip:${clientIp(c)}`, 20, 600)) || !(await hit(db, `login-user:${username.toLowerCase()}`, 10, 600))) {
    return c.html(authPage('login', [...popFlashes(c), ['error', tr(pageLang(c)).fe.tooManyLogin]], await authOpts(c)));
  }

  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<User>();
  if (user && checkPassword(user.password_hash, password)) {
    if (needsRehash(user.password_hash)) {
      await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hashPassword(password), user.id).run();
    }
    await login(c, user.id);
    await linkPendingTelegram(c, user.id);
    return c.redirect('/dashboard');
  }
  return c.html(authPage('login', [...popFlashes(c), ['error', tr(pageLang(c)).fe.badCreds]], await authOpts(c)));
});

app.get('/logout', (c) => {
  logout(c);
  return c.redirect('/login');
});

// ---------- «Забыли пароль?»: ссылка приходит в привязанный Telegram ----------
// Почты у аккаунтов нет, поэтому Telegram — единственный способ убедиться, что аккаунт твой.

const RESET_TTL = 30 * 60;
const sha256 = async (s: string) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).toString('hex');

async function resetUser(db: D1Database, token: string) {
  return db
    .prepare('SELECT u.id, u.username FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.token_hash = ? AND r.exp > ?')
    .bind(await sha256(token), Math.floor(Date.now() / 1000))
    .first<{ id: number; username: string }>();
}

app.get('/forgot', (c) => c.html(forgotPage(popFlashes(c), false, pageLang(c))));
app.post('/forgot', async (c) => {
  const db = c.env.DB;
  const username = formStr(await c.req.parseBody(), 'username').trim();
  if (!(await hit(db, `forgot-ip:${clientIp(c)}`, 5, 3600)) || !(await hit(db, `forgot-user:${username.toLowerCase()}`, 3, 3600))) {
    return c.html(forgotPage([['error', tr(pageLang(c)).fe.forgotTooMany]], false, pageLang(c)));
  }
  const row = await db
    .prepare('SELECT u.id, u.username, u.lang, l.chat_id FROM users u JOIN telegram_links l ON l.user_id = u.id WHERE u.username = ?')
    .bind(username)
    .first<{ id: number; username: string; lang: string; chat_id: number }>();
  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (row && token) {
    const secret = randomBytes(32).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    await db.batch([
      db.prepare('DELETE FROM password_resets WHERE user_id = ? OR exp < ?').bind(row.id, now),
      db.prepare('INSERT INTO password_resets (token_hash, user_id, exp) VALUES (?, ?, ?)').bind(await sha256(secret), row.id, now + RESET_TTL),
    ]);
    const name = row.username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await tg(botApi(token, c.env.TELEGRAM_API), 'sendMessage', {
      chat_id: row.chat_id,
      parse_mode: 'HTML',
      text: tr(langOf(row.lang)).srv.resetMsg(name),
      reply_markup: { inline_keyboard: [[{ text: tr(langOf(row.lang)).srv.resetBtn, url: `${canonicalOrigin(c) ?? new URL(c.req.url).origin}/reset/${secret}` }]] },
    }).catch((e) => console.error('reset message failed', e));
  }
  // Ответ одинаковый для любого логина: по нему нельзя узнать, есть ли такой аккаунт
  return c.html(forgotPage([], true, pageLang(c)));
});

app.get('/reset/:token', async (c) => {
  const user = await resetUser(c.env.DB, c.req.param('token'));
  if (!user) {
    flash(c, tr(pageLang(c)).fe.resetExpired, 'error');
    return c.redirect('/forgot');
  }
  return c.html(resetPage(popFlashes(c), user.username, pageLang(c)));
});
app.post('/reset/:token', async (c) => {
  const db = c.env.DB;
  const user = await resetUser(db, c.req.param('token'));
  if (!user) {
    flash(c, tr(pageLang(c)).fe.resetExpired, 'error');
    return c.redirect('/forgot');
  }
  const password = formStr(await c.req.parseBody(), 'password');
  if (password.length < MIN_PASSWORD) return c.html(resetPage([['error', tr(pageLang(c)).fe.pwShort.replace('%d', String(MIN_PASSWORD))]], user.username, pageLang(c)));
  // Новый пароль, ссылка сгорает, все старые входы отзываются
  await db.batch([
    db.prepare('UPDATE users SET password_hash = ?, session_ver = session_ver + 1 WHERE id = ?').bind(hashPassword(password), user.id),
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id),
  ]);
  await login(c, user.id);
  flash(c, tr(pageLang(c)).fe.resetDone, 'success');
  return c.redirect('/dashboard');
});

// Сводка трат пользователя: итоги за день/неделю/месяц, 7 дней, категории месяца и последние записи.
// Одна и та же для своей главной и для профиля друга.
async function spendingOverview(db: D1Database, userId: number, recentLimit: number) {
  const today = periodStart('day');
  const weekStart = periodStart('week');
  const monthStart = periodStart('month');
  const days = Array.from({ length: 7 }, (_, i) => isoDate(new Date(Date.parse(today) - (6 - i) * 86400000)));

  const [totals, byCat, recent, perDay] = await db.batch([
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN expense_date = ?2 THEN amount END), 0) AS today,
           COALESCE(SUM(CASE WHEN expense_date >= ?3 THEN amount END), 0) AS week,
           COALESCE(SUM(CASE WHEN expense_date >= ?4 THEN amount END), 0) AS month
         FROM expenses WHERE user_id = ?1`,
      )
      .bind(userId, today, weekStart, monthStart),
    db
      .prepare(
        `SELECT category, SUM(amount) AS total FROM expenses
         WHERE user_id = ? AND expense_date >= ? GROUP BY category ORDER BY total DESC`,
      )
      .bind(userId, monthStart),
    db
      .prepare(
        `SELECT id, amount, category, note, expense_date, store FROM expenses
         WHERE user_id = ? ORDER BY expense_date DESC, created_at DESC, id DESC LIMIT ?`,
      )
      .bind(userId, recentLimit),
    db
      .prepare(
        `SELECT expense_date AS date, SUM(amount) AS total FROM expenses
         WHERE user_id = ? AND expense_date >= ? AND expense_date <= ? GROUP BY expense_date`,
      )
      .bind(userId, days[0], today),
  ]);
  const t = totals.results[0] as { today: number; week: number; month: number };
  const dayTotals = new Map((perDay.results as { date: string; total: number }[]).map((r) => [r.date, r.total]));
  return {
    today,
    todayTotal: t.today,
    weekTotal: t.week,
    monthTotal: t.month,
    week: days.map((date) => ({ date, total: dayTotals.get(date) ?? 0 })),
    byCategory: byCat.results as { category: string; total: number }[],
    recent: recent.results as unknown as ExpenseRow[],
  };
}

app.get('/dashboard', async (c) => {
  const user = c.get('user');
  await chargeDue(c.env.DB, periodStart('day'), user.id);
  const today = periodStart('day');
  // Первая неделя месяца — баннер «Итоги прошлого месяца», если было что подводить
  const prevMonth = Number(today.slice(8, 10)) <= 7 ? monthBounds(today.slice(0, 7)) : null;
  const [o, subs, prevCount] = await Promise.all([
    spendingOverview(c.env.DB, user.id, 15),
    loadSubs(c.env.DB, user),
    prevMonth
      ? c.env.DB.prepare('SELECT COUNT(*) AS n FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ?').bind(user.id, prevMonth.prevStart, prevMonth.prevEnd).first<{ n: number }>()
      : null,
  ]);

  return c.html(
    dashboardPage({
      flashes: popFlashes(c),
      lang: langOf(c.get('user').lang),
      sym: symbol(user),
      username: user.username,
      demo: c.env.DEMO === '1',
      categories: CATEGORIES,
      ...o,
      subs: {
        count: subs.length,
        monthly: subs.reduce((a, x) => a + x.monthly, 0),
        next: subs[0] ? { name: subs[0].name, days: subs[0].days, date: subs[0].next_date } : null,
      },
      wrapped: prevMonth && (prevCount?.n ?? 0) >= 3 ? prevMonth.prevStart.slice(0, 7) : null,
    }),
  );
});

app.post('/dashboard', async (c) => {
  const user = c.get('user');
  const form = await c.req.parseBody();
  const rawAmount = formStr(form, 'amount').replace(/,/g, '.').trim();
  const amount = rawAmount === '' ? NaN : Number(rawAmount);
  if (!Number.isFinite(amount)) {
    flash(c, flashT(c).badAmount, 'error');
    return c.redirect('/dashboard');
  }

  const category = formStr(form, 'category') || 'Прочее';
  const store = formStr(form, 'store').trim().slice(0, 80) || null;
  const barcode = /^\d{8,14}$/.test(formStr(form, 'barcode')) ? formStr(form, 'barcode') : null;
  const note = formStr(form, 'note').trim();
  const dateStr = formStr(form, 'expense_date');
  const expenseDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : periodStart('day');

  await c.env.DB.prepare('INSERT INTO expenses (user_id, amount, category, note, expense_date, store, barcode) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(user.id, amount, category, note, expenseDate, store, barcode)
    .run();

  // База растёт сама: название товара для штрих-кода и магазин, вписанный вручную, запоминаются для всех
  const lat = Number(formStr(form, 'lat'));
  const lon = Number(formStr(form, 'lon'));
  const hasPos = formStr(form, 'lat') !== '' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  await Promise.all([
    barcode && note ? rememberProduct(c.env.DB, barcode, note, category) : null,
    store && hasPos && formStr(form, 'store_src') === 'typed' ? rememberPlace(c.env.DB, store, category, lat, lon, user.id) : null,
  ]);
  flash(c, flashT(c).expenseAdded, 'success');
  return c.redirect('/dashboard');
});

// ---------- подписки ----------

/** Подписки человека по дате ближайшего списания, с ценой в месяц в его валюте */
async function loadSubs(db: D1Database, user: User): Promise<SubView[]> {
  const { results } = await db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_date, id').bind(user.id).all<Sub>();
  const lang = langOf(user.lang);
  const today = Date.parse(periodStart('day') + 'T00:00:00Z');
  return results.map((s) => {
    const code = s.currency in CURRENCIES ? s.currency : 'RUB';
    return {
      ...s,
      monthly: convert(perMonth(s), s.currency, user.currency),
      sym: currencySymbol(code, lang, CURRENCIES[code].symbol),
      color: subColor(s.name),
      days: Math.round((Date.parse(s.next_date + 'T00:00:00Z') - today) / 86400000),
    };
  });
}

/** Поля подписки из формы; null — если что-то не так */
function subFromForm(form: Record<string, unknown>, user: User) {
  const name = formStr(form, 'name').trim().slice(0, 60);
  let amount: number;
  try {
    amount = Math.round(parseAmount(formStr(form, 'amount')) * 100) / 100;
  } catch {
    return null;
  }
  const date = formStr(form, 'next_date');
  // Дата должна существовать: «2026-02-30» JavaScript молча превратил бы в 2 марта
  const realDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && isoDate(new Date(Date.parse(date + 'T00:00:00Z') || 0)) === date;
  if (!name || !(amount > 0) || amount > 1e9 || !realDate) return null;
  const period = (SUB_PERIODS as string[]).includes(formStr(form, 'period')) ? (formStr(form, 'period') as SubPeriod) : 'month';
  const currency = formStr(form, 'currency') in CURRENCIES ? formStr(form, 'currency') : user.currency;
  const category = CATEGORIES.includes(formStr(form, 'category')) ? formStr(form, 'category') : 'Развлечения';
  const anchor = Number(date.slice(8, 10));
  // Прошедшую дату сдвигаем вперёд без записи трат: прошлые списания человек, скорее всего, уже записал сам
  const next = rollForward(date, period, anchor, periodStart('day'));
  return { name, amount, currency, period, next, anchor, category, auto: form.auto ? 1 : 0 };
}

app.get('/subs', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  await chargeDue(db, periodStart('day'), user.id);
  const [subs, month] = await Promise.all([loadSubs(db, user), spentSince(db, user.id, periodStart('month'))]);
  return c.html(
    subsPage({
      flashes: popFlashes(c),
      lang: langOf(user.lang),
      sym: symbol(user),
      userCurrency: user.currency,
      subs,
      monthTotal: month,
      today: periodStart('day'),
      currencies: CURRENCIES,
      categories: CATEGORIES,
    }),
  );
});

app.post('/subs', async (c) => {
  const user = c.get('user');
  const T = subsText(langOf(user.lang));
  const s = subFromForm(await c.req.parseBody(), user);
  if (!s) {
    flash(c, T.fl.bad, 'error');
    return c.redirect('/subs');
  }
  if ((await insertSub(c.env.DB, user.id, s)) === null) {
    flash(c, T.fl.bad, 'error');
    return c.redirect('/subs');
  }
  // Списание на сегодня записываем сразу, чтобы трата появилась без ожидания утра
  const charged = await chargeDue(c.env.DB, periodStart('day'), user.id);
  flash(c, charged.length ? `${T.fl.added}. ${T.fl.charged(charged.length)}` : T.fl.added, 'success');
  return c.redirect('/subs');
});

app.post('/subs/:id{[0-9]+}', async (c) => {
  const user = c.get('user');
  const T = subsText(langOf(user.lang));
  const s = subFromForm(await c.req.parseBody(), user);
  if (!s) {
    flash(c, T.fl.bad, 'error');
    return c.redirect('/subs');
  }
  await c.env.DB.prepare(
    // Дату не трогали — число списания остаётся прежним (подписка на 31-е, сейчас стоящая на 30 ноября, не съезжает на 30-е)
    `UPDATE subscriptions SET name = ?1, amount = ?2, currency = ?3, period = ?4, anchor_day = CASE WHEN next_date = ?5 THEN anchor_day ELSE ?6 END,
       next_date = ?5, category = ?7, auto = ?8 WHERE id = ?9 AND user_id = ?10`,
  )
    .bind(s.name, s.amount, s.currency, s.period, s.next, s.anchor, s.category, s.auto, Number(c.req.param('id')), user.id)
    .run();
  const charged = await chargeDue(c.env.DB, periodStart('day'), user.id);
  flash(c, charged.length ? `${T.fl.updated}. ${T.fl.charged(charged.length)}` : T.fl.updated, 'success');
  return c.redirect('/subs');
});

app.post('/subs/:id{[0-9]+}/delete', async (c) => {
  const user = c.get('user');
  await c.env.DB.prepare('DELETE FROM subscriptions WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), user.id).run();
  flash(c, subsText(langOf(user.lang)).fl.deleted, 'success');
  return c.redirect('/subs');
});

// ---------- «Итоги месяца» в духе Spotify Wrapped ----------

app.get('/wrapped', async (c) => {
  const user = c.get('user');
  const today = periodStart('day');
  const month = pickMonth(c.req.query('m'), today);
  const [w, link] = await Promise.all([
    loadWrapped(c.env.DB, user, month, today),
    c.env.DB.prepare('SELECT 1 FROM telegram_links WHERE user_id = ?').bind(user.id).first(),
  ]);
  return c.html(
    wrappedPage({
      flashes: popFlashes(c),
      lang: langOf(user.lang),
      sym: symbol(user),
      currency: user.currency in CURRENCIES ? user.currency : 'RUB',
      username: user.username,
      w,
      canSend: !!c.env.TELEGRAM_BOT_TOKEN && !!link,
    }),
  );
});

// ---------- «Мой месяц»: картинка для сторис ----------

app.get('/month', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const since = periodStart('month');
  const today = isoDate(todayUtc());
  const [sum, cats, top, prev, link] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND expense_date >= ?').bind(user.id, since),
    db
      .prepare('SELECT category, SUM(amount) AS total FROM expenses WHERE user_id = ? AND expense_date >= ? GROUP BY category ORDER BY total DESC LIMIT 3')
      .bind(user.id, since),
    db
      .prepare(
        `SELECT note, COUNT(*) AS n FROM expenses WHERE user_id = ? AND expense_date >= ? AND note IS NOT NULL AND note <> ''
         GROUP BY note ORDER BY n DESC, MAX(id) DESC LIMIT 1`,
      )
      .bind(user.id, since),
    // ponytail: «те же дни» через date(…, '-1 month'); в конце длинного месяца SQLite съезжает на день-два вперёд
    db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND expense_date >= date(?, '-1 month') AND expense_date <= date(?, '-1 month')")
      .bind(user.id, since, today),
    db.prepare('SELECT chat_id FROM telegram_links WHERE user_id = ?').bind(user.id),
  ]);
  const s = sum.results[0] as { n: number; total: number };
  const t = top.results[0] as { note: string; n: number } | undefined;
  const token = c.env.TELEGRAM_BOT_TOKEN;
  return c.html(
    monthPage({
      flashes: popFlashes(c),
      lang: langOf(c.get('user').lang),
      canSend: !!token && link.results.length > 0,
      card: s.n
        ? {
            month: Number(since.slice(5, 7)) - 1,
            username: user.username,
            sym: symbol(user),
            total: s.total,
            count: s.n,
            cats: cats.results as { category: string; total: number }[],
            top: t && t.n > 1 ? t : null,
            prev: (prev.results[0] as { total: number }).total,
            bot: token ? await botUsername(botApi(token, c.env.TELEGRAM_API)) : null,
          }
        : null,
    }),
  );
});

// Готовая картинка из браузера → в чат с ботом: оттуда её проще всего переслать или выложить в сторис
app.post('/month/send', async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN;
  const link = await c.env.DB.prepare('SELECT chat_id FROM telegram_links WHERE user_id = ?').bind(c.get('user').id).first<{ chat_id: number }>();
  if (!token || !link) return c.json({ ok: false, error: 'no_bot' }, 400);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isJpeg || bytes.length > MAX_PHOTO_BYTES) return c.json({ ok: false, error: 'bad_image' }, 400);
  const api = botApi(token, c.env.TELEGRAM_API);
  const bot = await botUsername(api);
  const lang = uiLang(c);
  // ?m=YYYY-MM — картинка из «Итогов месяца» за прошлый месяц
  const m = c.req.query('m');
  const monthNom = tr(lang).months.nom[Number((m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : periodStart('month')).slice(5, 7)) - 1];
  const month = lang === 'en' ? monthNom : monthNom.toLowerCase();
  const r = await sendPhoto(
    api,
    link.chat_id,
    new Blob([bytes], { type: 'image/jpeg' }),
    tr(lang).srv.monthCaption(month, bot),
  );
  return c.json({ ok: r.ok });
});

// ---------- сканер: товар по штрих-коду и магазины рядом ----------

app.get('/api/product/:code{[0-9]{8,14}}', async (c) => {
  if (!(await hit(c.env.DB, `product:${c.get('user').id}`, 200, 3600))) return c.json({ error: 'limit' }, 429);
  const code = c.req.param('code');
  const [product, prices] = await Promise.all([
    lookupProduct(c.env.DB, code, c.env.AI),
    priceHistory(c.env.DB, code, c.get('user').id),
  ]);
  return c.json({ product, prices, ai: !!c.env.AI });
});

// Фото упаковки → название и категория (ИИ подсказывает, человек проверяет и сохраняет).
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

app.post('/api/product/:code{[0-9]{8,14}}/photo', async (c) => {
  if (!c.env.AI) return c.json({ ok: false, error: 'ai_off' }, 503);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isJpeg || bytes.length > MAX_PHOTO_BYTES) return c.json({ ok: false, error: 'bad_image' }, 400);
  if (!(await takeAiQuota(c.env.DB, c.get('user').id))) return c.json({ ok: false, error: 'limit' }, 429);
  const guess = await recognizeProduct(c.env.AI, bytes, false, uiLang(c));
  return c.json(guess ? { ok: true, name: guess.name, category: guess.category } : { ok: false, error: 'unknown' });
});

app.get('/api/stores', async (c) => {
  if (!(await hit(c.env.DB, `stores:${c.get('user').id}`, 60, 3600))) return c.json({ stores: [], error: 'limit' }, 429);
  const lat = Number(c.req.query('lat'));
  const lon = Number(c.req.query('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return c.json({ stores: [], error: 'bad coords' }, 400);
  }
  return c.json(await nearbyStores(c.env.DB, lat, lon));
});

// ---------- демо-версия ----------

// Траты демо-аккаунта и двух друзей; даты считаются от сегодняшнего дня, поэтому данные всегда «свежие»
const COKE = '5449000000996';
const DEMO_USERS: Record<Lang, string[]> = { ru: ['Демо', 'Аня', 'Макс'], en: ['Demo', 'Anya', 'Max'] };
// Названия демо-трат и магазинов для английской версии
const DEMO_EN: Record<string, string> = {
  'Coca-Cola 0,5 л': 'Coca-Cola 0.5 L', Капучино: 'Cappuccino', 'Такси до работы': 'Taxi to work', Продукты: 'Groceries', Кроссовки: 'Sneakers',
  'Продукты на ужин': 'Dinner groceries', 'Кино с друзьями': 'Movies with friends', Сигареты: 'Cigarettes', Аптека: 'Pharmacy', Ужин: 'Dinner',
  Бензин: 'Gas', 'Подписка на музыку': 'Music subscription', 'Продукты на неделю': 'Weekly groceries', Витамины: 'Vitamins', Футболка: 'T-shirt',
  Аренда: 'Rent', Платье: 'Dress', Суши: 'Sushi', Концерт: 'Concert', Каршеринг: 'Car sharing', Пицца: 'Pizza',
  Пятёрочка: 'Pyatyorochka', Перекрёсток: 'Perekrestok', ВкусВилл: 'VkusVill', Магнит: 'Magnit', Лукойл: 'Lukoil', Лента: 'Lenta',
};
const DEMO_EXPENSES: [user: number, daysAgo: number, amount: number, category: string, note: string, store: string | null, barcode: string | null][] = [
  [0, 0, 89, 'Еда', 'Coca-Cola 0,5 л', 'Пятёрочка', COKE],
  [0, 0, 350, 'Еда', 'Капучино', 'Cofix', null],
  [0, 1, 1200, 'Транспорт', 'Такси до работы', null, null],
  [0, 1, 642, 'Еда', 'Продукты', 'Перекрёсток', null],
  [0, 2, 4500, 'Одежда', 'Кроссовки', null, null],
  [0, 3, 890, 'Еда', 'Продукты на ужин', 'ВкусВилл', null],
  [0, 3, 99, 'Еда', 'Coca-Cola 0,5 л', 'Магнит', COKE],
  [0, 4, 2300, 'Развлечения', 'Кино с друзьями', null, null],
  [0, 2, 250, 'Табак', 'Сигареты', null, null],
  [0, 5, 640, 'Здоровье', 'Аптека', null, null],
  [0, 6, 1500, 'Еда', 'Ужин', null, null],
  [0, 8, 2500, 'Транспорт', 'Бензин', 'Лукойл', null],
  [0, 10, 499, 'Развлечения', 'Подписка на музыку', null, null],
  [0, 12, 87, 'Еда', 'Coca-Cola 0,5 л', 'Пятёрочка', COKE],
  [0, 14, 2100, 'Еда', 'Продукты на неделю', 'Лента', null],
  [0, 17, 1290, 'Здоровье', 'Витамины', null, null],
  [0, 21, 3200, 'Одежда', 'Футболка', null, null],
  [0, 25, 18000, 'Жильё', 'Аренда', null, null],
  [1, 0, 85, 'Еда', 'Coca-Cola 0,5 л', 'Пятёрочка', COKE],
  [1, 1, 3400, 'Одежда', 'Платье', null, null],
  [1, 2, 760, 'Еда', 'Суши', null, null],
  [1, 4, 5200, 'Развлечения', 'Концерт', null, null],
  [2, 0, 95, 'Еда', 'Coca-Cola 0,5 л', 'Магнит', COKE],
  [2, 1, 2400, 'Транспорт', 'Каршеринг', null, null],
  [2, 3, 1100, 'Еда', 'Пицца', null, null],
];

app.post('/demo', async (c) => {
  if (c.env.DEMO !== '1') return c.notFound();
  const db = c.env.DB;
  const ids: number[] = [];
  const lang = pageLang(c);
  const en = lang === 'en';
  for (const name of DEMO_USERS[lang]) {
    let row = await db.prepare('SELECT id FROM users WHERE username = ?').bind(name).first<{ id: number }>();
    if (!row) {
      // Пароль случайный: в демо входят только кнопкой
      row = await db
        .prepare("INSERT INTO users (username, password_hash, created_at, lang) VALUES (?, ?, datetime('now', '-40 days'), ?) RETURNING id")
        .bind(name, hashPassword(randomBytes(18).toString('base64url')), lang)
        .first<{ id: number }>();
    }
    ids.push(row!.id);
  }
  const [me, anya, max] = ids;
  await db.batch([
    db.prepare('DELETE FROM expenses WHERE user_id IN (?, ?, ?)').bind(me, anya, max),
    db.prepare('DELETE FROM subscriptions WHERE user_id IN (?, ?, ?)').bind(me, anya, max),
    // Подписки демо-пользователя: [название, сумма, валюта, период, через сколько дней, категория]
    ...(
      [
        [en ? 'Netflix' : 'Кинопоиск', en ? 899 : 399, 'RUB', 'month', 1, 'Развлечения'],
        ['Spotify', 299, 'RUB', 'month', 4, 'Развлечения'],
        ['ChatGPT Plus', 20, 'USD', 'month', 9, 'Прочее'],
        [en ? 'Gym' : 'Спортзал', 2900, 'RUB', 'month', 16, 'Здоровье'],
        ['iCloud+', 1490, 'RUB', 'year', 120, 'Прочее'],
      ] as const
    ).map(([name, amount, cur, period, days, cat]) =>
      db
        .prepare(
          `INSERT INTO subscriptions (user_id, name, amount, currency, period, next_date, anchor_day, category)
           VALUES (?, ?, ?, ?, ?, date('now', ?), CAST(strftime('%d', date('now', ?)) AS INTEGER), ?)`,
        )
        .bind(me, name, amount, cur, period, `+${days} days`, `+${days} days`, cat),
    ),
    db.prepare('DELETE FROM friendships WHERE from_user_id IN (?1, ?2, ?3) OR to_user_id IN (?1, ?2, ?3)').bind(me, anya, max),
    db.prepare("INSERT INTO friendships (from_user_id, to_user_id, status) VALUES (?, ?, 'accepted')").bind(anya, me),
    db.prepare("INSERT INTO friendships (from_user_id, to_user_id, status) VALUES (?, ?, 'accepted')").bind(me, max),
    // Сдвиг на i минут сохраняет порядок записей внутри одного дня
    ...DEMO_EXPENSES.map(([u, ago, amount, category, note, store, barcode], i) =>
      db
        .prepare(
          `INSERT INTO expenses (user_id, amount, category, note, expense_date, store, barcode, created_at)
           VALUES (?, ?, ?, ?, date('now', ?), ?, ?, datetime('now', ?, ?))`,
        )
        .bind(ids[u], amount, category, en ? (DEMO_EN[note] ?? note) : note, `-${ago} days`, store && en ? (DEMO_EN[store] ?? store) : store, barcode, `-${ago} days`, `-${i} minutes`),
    ),
  ]);
  await login(c, me);
  return c.redirect('/dashboard');
});

app.post('/delete/:id{[0-9]+}', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  if (res.meta.changes) flash(c, flashT(c).expenseDeleted, 'success');
  return c.redirect('/dashboard');
});

/** Рейтинг: я и друзья, кто сколько потратил с даты since. Общий для страницы «Друзья» и бота. */
async function leaderboard(db: D1Database, userId: number, since: string) {
  const ids = [...(await getFriendIds(db, userId)), userId];
  const { results } = await db
    .prepare(
      `SELECT u.id, u.username, u.currency, COALESCE(SUM(e.amount), 0) AS total
       FROM users u LEFT JOIN expenses e ON e.user_id = u.id AND e.expense_date >= ?
       WHERE u.id IN (SELECT value FROM json_each(?))
       GROUP BY u.id`,
    )
    .bind(since, JSON.stringify(ids))
    .all<{ id: number; username: string; currency: string; total: number }>();
  // У друзей могут быть разные валюты — приводим всех к валюте того, кто смотрит, по общему курсу
  const mine = results.find((r) => r.id === userId)?.currency ?? 'RUB';
  return results
    .map((r) => ({ id: r.id, username: r.username, total: convert(r.total, r.currency, mine), is_me: r.id === userId }))
    .sort((a, b) => b.total - a.total);
}

app.get('/friends', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  let period = c.req.query('period') ?? 'month';
  if (!['day', 'week', 'month'].includes(period)) period = 'month';
  const since = periodStart(period);

  const [board, incomingRes] = await Promise.all([
    leaderboard(db, user.id, since),
    db
      .prepare(
        `SELECT f.id, u.id AS user_id, u.username FROM friendships f
         JOIN users u ON u.id = f.from_user_id
         WHERE f.to_user_id = ? AND f.status = 'pending' ORDER BY f.id`,
      )
      .bind(user.id)
      .all(),
  ]);

  return c.html(
    friendsPage({
      flashes: popFlashes(c),
      lang: langOf(c.get('user').lang),
      sym: symbol(user),
      period,
      board,
      incoming: incomingRes.results as { id: number; user_id: number; username: string }[],
    }),
  );
});

const FRIENDSHIP_SQL = `SELECT id, created_at FROM friendships
  WHERE status = 'accepted' AND ((from_user_id = ?1 AND to_user_id = ?2) OR (from_user_id = ?2 AND to_user_id = ?1))
  ORDER BY id LIMIT 1`;

app.get('/friends/:id{[0-9]+}', async (c) => {
  // Профиль друга: открывается только тем, с кем дружба подтверждена
  const user = c.get('user');
  const db = c.env.DB;
  const fid = Number(c.req.param('id'));
  if (fid === user.id) return c.redirect('/profile');
  const fs = await db.prepare(FRIENDSHIP_SQL).bind(user.id, fid).first<{ id: number; created_at: string }>();
  const friend = fs ? await db.prepare('SELECT * FROM users WHERE id = ?').bind(fid).first<User>() : null;
  if (!fs || !friend) {
    flash(c, flashT(c).friendsOnly, 'error');
    return c.redirect('/friends');
  }
  const [o, av] = await Promise.all([
    spendingOverview(db, fid, 10),
    db.prepare('SELECT updated_at FROM avatars WHERE user_id = ?').bind(fid).first<{ updated_at: string }>(),
  ]);
  // Показываем траты друга в валюте того, кто смотрит, по общему курсу
  const k = convert(1, friend.currency, user.currency);
  const conv = {
    today: o.today,
    todayTotal: o.todayTotal * k,
    weekTotal: o.weekTotal * k,
    monthTotal: o.monthTotal * k,
    week: o.week.map((d) => ({ ...d, total: d.total * k })),
    byCategory: o.byCategory.map((r) => ({ ...r, total: r.total * k })),
    recent: o.recent.map((r) => ({ ...r, amount: r.amount * k })),
  };
  return c.html(
    friendProfilePage({
      flashes: popFlashes(c),
      lang: langOf(c.get('user').lang),
      sym: symbol(user),
      id: fid,
      username: friend.username,
      bio: friend.bio,
      friendsSince: fs.created_at,
      avatarV: av ? String(Date.parse(av.updated_at.replace(' ', 'T') + 'Z') / 1000 || 0) : null,
      ...conv,
    }),
  );
});

app.post('/friends/remove/:id{[0-9]+}', async (c) => {
  const res = await c.env.DB.prepare(
    `DELETE FROM friendships WHERE status = 'accepted'
     AND ((from_user_id = ?1 AND to_user_id = ?2) OR (from_user_id = ?2 AND to_user_id = ?1))`,
  )
    .bind(c.get('user').id, Number(c.req.param('id')))
    .run();
  if (res.meta.changes) flash(c, flashT(c).friendRemoved, 'success');
  return c.redirect('/friends');
});

app.post('/friends/add', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const form = await c.req.parseBody();
  const targetUsername = formStr(form, 'friend_login').trim().replace(/^@/, '');

  if (targetUsername === user.username) {
    flash(c, flashT(c).selfAdd, 'error');
    return c.redirect('/friends');
  }
  const target = await db.prepare('SELECT id, username FROM users WHERE username = ?').bind(targetUsername).first<{ id: number; username: string }>();
  if (!target) {
    flash(c, flashT(c).userNotFound, 'error');
    return c.redirect('/friends');
  }
  const existing = await db
    .prepare(
      `SELECT 1 FROM friendships
       WHERE (from_user_id = ?1 AND to_user_id = ?2) OR (from_user_id = ?2 AND to_user_id = ?1)`,
    )
    .bind(user.id, target.id)
    .first();
  if (existing) {
    flash(c, flashT(c).reqExists, 'error');
    return c.redirect('/friends');
  }

  await db.prepare("INSERT INTO friendships (from_user_id, to_user_id, status) VALUES (?, ?, 'pending')").bind(user.id, target.id).run();
  flash(c, flashT(c).reqSentTo.replace('%s', target.username), 'success');
  return c.redirect('/friends');
});

app.post('/friends/accept/:id{[0-9]+}', async (c) => {
  const res = await c.env.DB.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ? AND to_user_id = ? AND status = 'pending'")
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  if (res.meta.changes) flash(c, flashT(c).reqAccepted, 'success');
  return c.redirect('/friends');
});

app.post('/friends/decline/:id{[0-9]+}', async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM friendships WHERE id = ? AND to_user_id = ? AND status = 'pending'")
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  if (res.meta.changes) flash(c, flashT(c).reqDeclined, 'success');
  return c.redirect('/friends');
});

app.get('/profile', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const tgToken = c.env.TELEGRAM_BOT_TOKEN;
  const [total, count, av, tok, friendIds, tgLink, tgBot] = await Promise.all([
    spentSince(db, user.id, '2000-01-01'),
    db.prepare('SELECT COUNT(*) AS n FROM expenses WHERE user_id = ?').bind(user.id).first<{ n: number }>(),
    db.prepare('SELECT updated_at FROM avatars WHERE user_id = ?').bind(user.id).first<{ updated_at: string }>(),
    db.prepare('SELECT token FROM api_tokens WHERE user_id = ?').bind(user.id).first<{ token: string }>(),
    getFriendIds(db, user.id),
    db.prepare('SELECT tg_username FROM telegram_links WHERE user_id = ?').bind(user.id).first<{ tg_username: string | null }>(),
    tgToken ? botUsername(botApi(tgToken, c.env.TELEGRAM_API)) : null,
  ]);

  return c.html(
    profilePage({
      flashes: popFlashes(c),
      lang: langOf(c.get('user').lang),
      sym: symbol(user),
      shortcutUrl: c.env.SHORTCUT_URL || DEFAULT_SHORTCUT_URL,
      username: user.username,
      userId: user.id,
      createdAt: user.created_at,
      bio: user.bio,
      totalAllTime: total,
      expenseCount: count?.n ?? 0,
      friendCount: friendIds.length,
      avatarV: av ? String(Date.parse(av.updated_at.replace(' ', 'T') + 'Z') / 1000 || 0) : null,
      apiToken: tok?.token ?? null,
      telegram: tgBot ? { bot: tgBot, linked: !!tgLink, tgUsername: tgLink?.tg_username ?? null } : null,
    }),
  );
});

app.post('/profile/telegram', async (c) => {
  // Одноразовая ссылка t.me/<бот>?start=<код>: по коду бот узнаёт, чей это чат
  const token = c.env.TELEGRAM_BOT_TOKEN;
  const bot = token ? await botUsername(botApi(token, c.env.TELEGRAM_API)) : null;
  if (!bot) {
    flash(c, flashT(c).botUnavailable, 'error');
    return c.redirect('/profile');
  }
  const code = randomBytes(18).toString('base64url');
  const db = c.env.DB;
  await db.batch([
    db.prepare("DELETE FROM telegram_codes WHERE user_id = ? OR created_at < datetime('now', '-1 day')").bind(c.get('user').id),
    db.prepare('INSERT INTO telegram_codes (code, user_id) VALUES (?, ?)').bind(code, c.get('user').id),
  ]);
  return c.redirect(`https://t.me/${bot}?start=${code}`);
});

const MAX_BIO = 200;
app.post('/profile/bio', async (c) => {
  const bio = formStr(await c.req.parseBody(), 'bio').replace(/\s+/g, ' ').trim().slice(0, MAX_BIO);
  await c.env.DB.prepare('UPDATE users SET bio = ? WHERE id = ?').bind(bio || null, c.get('user').id).run();
  flash(c, bio ? flashT(c).bioSaved : flashT(c).bioRemoved, 'success');
  return c.redirect('/profile');
});

app.post('/profile/telegram/unlink', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM telegram_links WHERE user_id = ?').bind(c.get('user').id).run();
  if (res.meta.changes) flash(c, flashT(c).tgDisconnected, 'success');
  return c.redirect((await c.req.parseBody())['back'] === 'settings' ? '/settings' : '/profile');
});

// ---------- «Войти через Telegram» (OpenID Connect, src/tglogin.ts) ----------

// Красивый адрес сайта из SITE_URL (https://traaaack.app), если домен подключён
function canonicalOrigin(c: C): string | null {
  const site = c.env.SITE_URL?.trim().replace(/\/+$/, '');
  return site && site.startsWith('https://') ? site : null;
}

function tgLoginConfig(c: C): TgLoginConfig | null {
  const clientId = c.env.TELEGRAM_LOGIN_CLIENT_ID?.trim();
  const clientSecret = c.env.TELEGRAM_LOGIN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: `${new URL(c.req.url).origin}/auth/telegram/callback`, issuer: c.env.TELEGRAM_OAUTH };
}

const shortCookie = (maxAge: number) => ({ path: '/', httpOnly: true, secure: true, sameSite: 'Lax' as const, maxAge });

async function readSignedJson<T>(c: C, name: string): Promise<T | null> {
  const raw = await getSignedCookie(c, c.env.SECRET_KEY, name);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const readTgPending = (c: C) => readSignedJson<TgIdentity>(c, TG_PENDING_COOKIE);

async function linkTelegram(db: D1Database, userId: number, tg: TgIdentity) {
  await db
    .prepare(
      `INSERT INTO telegram_links (user_id, chat_id, tg_username) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET chat_id = excluded.chat_id, tg_username = excluded.tg_username, linked_at = datetime('now')`,
    )
    .bind(userId, tg.id, tg.username)
    .run();
}

// Вошёл по паролю после «У меня уже есть аккаунт» — привязываем проверенный Telegram к этому аккаунту
async function linkPendingTelegram(c: C, userId: number) {
  const tg = await readTgPending(c);
  if (!tg) return;
  deleteCookie(c, TG_PENDING_COOKIE, { path: '/', secure: true });
  const taken = await c.env.DB.prepare('SELECT user_id FROM telegram_links WHERE chat_id = ?').bind(tg.id).first<{ user_id: number }>();
  if (taken && taken.user_id !== userId) return flash(c, flashT(c).tgOtherAccount, 'error');
  await linkTelegram(c.env.DB, userId, tg);
  flash(c, flashT(c).tgConnected, 'success');
}

// Фото из Telegram становится аватаркой нового аккаунта (только JPEG, как и при обычной загрузке)
async function saveTelegramPhoto(db: D1Database, userId: number, url: string | null) {
  if (!url || !url.startsWith('https://')) return;
  try {
    const res = await fetch(url);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!res.ok || !isJpeg || bytes.length > MAX_AVATAR_BYTES) return;
    await db.prepare('INSERT OR REPLACE INTO avatars (user_id, data) VALUES (?, ?)').bind(userId, bytes).run();
  } catch (e) {
    console.error('telegram photo failed', e);
  }
}

app.get('/auth/telegram', async (c) => {
  const cfg = tgLoginConfig(c);
  // ?link=1 — привязка Telegram к уже открытому аккаунту (из Настроек или Профиля), а не вход
  const linking = c.req.query('link') === '1' && !!(await getSessionUserId(c));
  const back = c.req.query('back') === 'settings' ? '/settings' : '/profile';
  // В @BotFather зарегистрирован адрес возврата только на основном домене, а «защитные» куки привязаны к адресу сайта:
  // поэтому вход через Telegram всегда начинаем на основном домене, даже если кнопку нажали на старом адресе
  const site = canonicalOrigin(c);
  const here = new URL(c.req.url);
  if (site && here.origin !== site) {
    if (linking) {
      flash(c, tr(pageLang(c)).srv.tgOpenOnSite.replace('%s', site.replace('https://', '')), 'error');
      return c.redirect(back);
    }
    return c.redirect(`${site}${here.pathname}${here.search}`);
  }
  if (!cfg) {
    flash(c, flashT(c).tgLoginOff, 'error');
    return c.redirect(linking ? back : '/login');
  }
  const s = newLoginState();
  await setSignedCookie(c, TG_STATE_COOKIE, JSON.stringify({ ...s, link: linking, back }), c.env.SECRET_KEY, shortCookie(600));
  return c.redirect(await authorizeUrl(cfg, s));
});

app.get('/auth/telegram/callback', async (c) => {
  const cfg = tgLoginConfig(c);
  const saved = await readSignedJson<TgLoginState & { link: boolean; back?: string }>(c, TG_STATE_COOKIE);
  deleteCookie(c, TG_STATE_COOKIE, { path: '/', secure: true });
  const linkBack = saved?.back === '/settings' ? '/settings' : '/profile';
  const back = saved?.link ? linkBack : '/login';
  const code = c.req.query('code');
  if (!cfg || !saved || !code || c.req.query('state') !== saved.state) {
    flash(c, c.req.query('error') ? tr(pageLang(c)).srv.tgCancelled : tr(pageLang(c)).srv.tgFailed, 'error');
    return c.redirect(back);
  }
  let tg: TgIdentity;
  try {
    tg = await finishLogin(cfg, code, saved);
  } catch (e) {
    console.error('telegram login failed', e);
    flash(c, flashT(c).tgNotConfirmed, 'error');
    return c.redirect(back);
  }

  const db = c.env.DB;
  const link = await db.prepare('SELECT user_id FROM telegram_links WHERE chat_id = ?').bind(tg.id).first<{ user_id: number }>();
  const uid = await getSessionUserId(c);
  if (saved.link && uid) {
    if (link && link.user_id !== uid) flash(c, flashT(c).tgOtherAccount, 'error');
    else {
      await linkTelegram(db, uid, tg);
      flash(c, flashT(c).tgLinked, 'success');
    }
    return c.redirect(linkBack);
  }
  if (link) {
    await login(c, link.user_id);
    if (tg.username) await db.prepare('UPDATE telegram_links SET tg_username = ? WHERE user_id = ?').bind(tg.username, link.user_id).run();
    return c.redirect('/dashboard');
  }
  // Telegram ещё ни к чему не привязан — спрашиваем: новый аккаунт или войти в существующий
  await setSignedCookie(c, TG_PENDING_COOKIE, JSON.stringify(tg), c.env.SECRET_KEY, shortCookie(900));
  return c.redirect('/auth/telegram/new');
});

app.get('/auth/telegram/new', async (c) => {
  const tg = await readTgPending(c);
  if (!tg) return c.redirect('/login');
  return c.html(tgNewAccountPage(popFlashes(c), tg.name ?? (tg.username ? `@${tg.username}` : (pageLang(c) === 'en' ? 'friend' : 'друг')), pageLang(c)));
});

app.post('/auth/telegram/new', async (c) => {
  const tg = await readTgPending(c);
  if (!tg) return c.redirect('/login');
  deleteCookie(c, TG_PENDING_COOKIE, { path: '/', secure: true });
  const db = c.env.DB;
  const link = await db.prepare('SELECT user_id FROM telegram_links WHERE chat_id = ?').bind(tg.id).first<{ user_id: number }>();
  if (link) {
    await login(c, link.user_id);
    return c.redirect('/dashboard');
  }
  // Логин — ник из Telegram, а если он занят или его нет — tg<ID>. Пароля нет: его можно задать в настройках.
  const base = tg.username ?? `tg${tg.id}`;
  let username = base;
  for (let i = 2; await db.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first(); i++) {
    username = i < 10 ? `${base}${i}` : `tg${tg.id}_${i}`;
  }
  const row = await db.prepare("INSERT INTO users (username, password_hash, lang) VALUES (?, '', ?) RETURNING id").bind(username, pageLang(c)).first<{ id: number }>();
  await linkTelegram(db, row!.id, tg);
  await saveTelegramPhoto(db, row!.id, tg.picture);
  await login(c, row!.id);
  flash(c, tr(pageLang(c)).srv.accountCreated.replace('%s', username), 'success');
  return c.redirect('/dashboard');
});

// Сайт внутри Telegram (Mini App): кнопки бота открывают /tg/app, страница отдаёт initData,
// мы проверяем подпись Telegram и входим в привязанный аккаунт без пароля.
app.get('/tg/app', (c) => {
  const next = c.req.query('next') ?? '';
  // Путь внутри сайта, можно с простыми параметрами (/wrapped?m=2026-10)
  return c.html(tgAppPage(/^\/[a-z0-9_/-]*(\?[a-z0-9_=&-]*)?$/i.test(next) && !next.startsWith('//') ? next : '/dashboard', pageLang(c)));
});

app.post('/tg/auth', async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (!token) return c.json({ ok: false, error: 'no_bot' }, 404);
  const body = await c.req.json<{ initData?: string }>().catch(() => ({}) as { initData?: string });
  const tgId = body.initData ? await verifyInitData(body.initData, token) : null;
  if (!tgId) return c.json({ ok: false, error: 'bad_signature' }, 401);
  const link = await c.env.DB.prepare('SELECT user_id FROM telegram_links WHERE chat_id = ?').bind(tgId).first<{ user_id: number }>();
  if (!link) return c.json({ ok: false, error: 'not_linked' });
  await login(c, link.user_id);
  return c.json({ ok: true });
});

// Распознавание голосовых: Whisper на Workers AI. Подсказка с цифрами — чтобы суммы приходили цифрами, а не словами.
async function transcribe(ai: Ai, audio: ArrayBuffer, lang: Lang) {
  const r = await ai.run('@cf/openai/whisper-large-v3-turbo', {
    audio: Buffer.from(audio).toString('base64'),
    language: lang,
    vad_filter: true,
    // Подсказка подталкивает Whisper к тому, как мы диктуем траты: короткие фразы с суммой
    initial_prompt: lang === 'en' ? 'Coffee 250 dollars. Taxi 540 yesterday. Groceries 1200.' : 'Кофе 250 рублей. Вчера такси 540. Продукты 1200.',
  });
  return r.text ?? '';
}

function botDeps(env: Env, token: string, siteUrl: string): BotDeps {
  const db = env.DB;
  return {
    db,
    api: botApi(token, env.TELEGRAM_API),
    file: botFileApi(token, env.TELEGRAM_API),
    transcribe: env.AI ? (audio, lang) => transcribe(env.AI as Ai, audio, lang) : null,
    readPhoto: env.AI ? (jpeg, lang) => recognizeProduct(env.AI as Ai, jpeg, true, lang) : null,
    siteUrl,
    categories: CATEGORIES,
    currencies: CURRENCIES,
    today: periodStart('day'),
    since: { day: periodStart('day'), week: periodStart('week'), month: periodStart('month') },
    overview: (uid) => spendingOverview(db, uid, 0),
    leaderboard: (uid, since) => leaderboard(db, uid, since),
    adminId: /^\d+$/.test(env.TELEGRAM_ADMIN_ID ?? '') ? Number(env.TELEGRAM_ADMIN_ID) : null,
    asset: async (path) => {
      const r = await env.ASSETS.fetch(new Request(`https://assets.local${path}`));
      return r.ok ? r.blob() : null;
    },
  };
}

app.post('/tg/webhook', async (c) => {
  // Сюда Telegram присылает сообщения боту. Чужие запросы отсекаем по секрету из setWebhook.
  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (!token) return c.notFound();
  if (c.req.header('X-Telegram-Bot-Api-Secret-Token') !== (await webhookSecret(token))) return c.text('forbidden', 403);
  let update: TgUpdate;
  try {
    update = await c.req.json<TgUpdate>();
  } catch {
    return c.text('ok');
  }
  try {
    // Вебхук приходит на workers.dev, а в ссылках бот показывает свой домен, если он подключён
    await handleUpdate(botDeps(c.env, token, canonicalOrigin(c) ?? new URL(c.req.url).origin), update);
  } catch (e) {
    // Отвечаем 200 в любом случае, иначе Telegram будет повторять это сообщение снова и снова
    console.error('telegram update failed', e);
  }
  return c.text('ok');
});

app.get('/avatar/:id{[0-9]+}', async (c) => {
  // Фото видят сам человек и те, с кем есть дружба или заявка в друзья — перебором номеров чужие фото не достать
  const id = Number(c.req.param('id'));
  const me = c.get('user').id;
  const related =
    id === me ||
    (await c.env.DB.prepare('SELECT 1 FROM friendships WHERE (from_user_id = ?1 AND to_user_id = ?2) OR (from_user_id = ?2 AND to_user_id = ?1) LIMIT 1')
      .bind(me, id)
      .first());
  if (!related) return c.notFound();
  const a = await c.env.DB.prepare('SELECT data FROM avatars WHERE user_id = ?')
    .bind(id)
    .first<{ data: number[] | ArrayBuffer }>();
  if (!a) return c.notFound();
  return c.body(new Uint8Array(a.data as ArrayBuffer), 200, {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'private, max-age=86400',
  });
});

app.post('/profile/avatar', async (c) => {
  const form = await c.req.parseBody();
  const f = form['avatar'];
  if (!(f instanceof File) || f.size === 0) {
    flash(c, flashT(c).choosePhoto, 'error');
    return c.redirect('/profile');
  }
  const bytes = new Uint8Array(await f.arrayBuffer());
  // Браузер уже сжал фото до 256x256 JPEG; здесь только проверяем, что это действительно JPEG
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isJpeg || bytes.length > MAX_AVATAR_BYTES) {
    flash(c, flashT(c).photoFail, 'error');
    return c.redirect('/profile');
  }
  await c.env.DB.prepare(
    `INSERT INTO avatars (user_id, data, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  )
    .bind(c.get('user').id, bytes)
    .run();
  flash(c, flashT(c).photoUpdated, 'success');
  return c.redirect('/profile');
});

app.post('/profile/avatar/delete', async (c) => {
  await c.env.DB.prepare('DELETE FROM avatars WHERE user_id = ?').bind(c.get('user').id).run();
  flash(c, flashT(c).photoDeleted, 'success');
  return c.redirect('/profile');
});

app.post('/profile/token', async (c) => {
  // Создаёт новый токен для быстрых команд (старый перестаёт работать)
  const token = randomBytes(24).toString('base64url');
  await c.env.DB.prepare(
    `INSERT INTO api_tokens (user_id, token, created_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, created_at = excluded.created_at`,
  )
    .bind(c.get('user').id, token)
    .run();
  flash(c, flashT(c).tokenCreated, 'success');
  return c.redirect('/profile');
});

app.post('/api/add', async (c) => {
  // Добавление траты из «Быстрых команд». Авторизация по личному токену.
  const contentType = c.req.header('Content-Type') ?? '';
  let data: Record<string, unknown> = {};
  let form: Record<string, unknown> = {};
  try {
    if (contentType.includes('application/json')) {
      const j = await c.req.json();
      if (j && typeof j === 'object' && !Array.isArray(j)) data = j;
    } else if (contentType.includes('form')) {
      form = await c.req.parseBody();
    } else {
      // «Команды» иногда шлют JSON без правильного Content-Type
      const j = JSON.parse(await c.req.text());
      if (j && typeof j === 'object' && !Array.isArray(j)) data = j;
    }
  } catch {
    /* пустое или кривое тело — дальше упадёт на проверке токена */
  }
  const field = (name: string): unknown => {
    const fv = form[name];
    if (typeof fv === 'string' && fv) return fv;
    return data[name] || '';
  };

  // Токен — 32 символа base64url. При вставке в «Команды» к нему легко прилипают кавычки,
  // пробелы, переносы строк и невидимые символы, поэтому берём только допустимые символы.
  const rawToken = String(c.req.header('X-Token') || field('token') || '');
  const token = rawToken.replace(/[^A-Za-z0-9_-]/g, '');
  const rec = token
    ? await c.env.DB.prepare('SELECT user_id FROM api_tokens WHERE token = ?').bind(token).first<{ user_id: number }>()
    : null;
  // Язык ответа: аккаунта, если токен верный, иначе по заголовку Accept-Language
  const urow = rec ? await c.env.DB.prepare('SELECT lang FROM users WHERE id = ?').bind(rec.user_id).first<{ lang: string }>() : null;
  const E = tr(urow ? langOf(urow.lang) : /^en/i.test(c.req.header('Accept-Language') ?? '') ? 'en' : 'ru').srv;
  if (!rec) {
    const hint = !token ? E.apiTokenMissing : token.length !== 32 ? E.apiTokenLen(token.length) : E.apiTokenUnknown(new URL(c.req.url).host);
    return c.json({ ok: false, error: E.apiBadToken, hint }, 401);
  }

  const rawAmount = field('amount');
  let amount: number;
  try {
    amount = parseAmount(rawAmount);
  } catch {
    // Диагностика: показываем, что реально пришло
    return c.json(
      {
        ok: false,
        error: E.apiBadAmount,
        received: String(rawAmount),
        keys: [...Object.keys(data), ...Object.keys(form)],
        content_type: contentType || null,
      },
      400,
    );
  }
  if (amount <= 0) return c.json({ ok: false, error: E.apiAmountPositive, received: String(rawAmount) }, 400);

  let category = categoryId(String(field('category')).trim());
  if (!CATEGORIES.includes(category)) category = 'Прочее';
  const note = [...String(field('note')).trim()].slice(0, 255).join('');

  await c.env.DB.prepare('INSERT INTO expenses (user_id, amount, category, note, expense_date) VALUES (?, ?, ?, ?, ?)')
    .bind(rec.user_id, amount, category, note, periodStart('day'))
    .run();
  return c.json({ ok: true, amount, category });
});

app.get('/settings', async (c) => {
  const user = c.get('user');
  const tgToken = c.env.TELEGRAM_BOT_TOKEN;
  const [tgLink, tgBot] = await Promise.all([
    c.env.DB.prepare('SELECT tg_username FROM telegram_links WHERE user_id = ?').bind(user.id).first<{ tg_username: string | null }>(),
    tgToken ? botUsername(botApi(tgToken, c.env.TELEGRAM_API)) : null,
  ]);
  return c.html(
    settingsPage({
      flashes: popFlashes(c),
      lang: langOf(c.get('user').lang),
      username: user.username,
      hasPassword: !!user.password_hash,
      telegram: { linked: !!tgLink, tgUsername: tgLink?.tg_username ?? null, bot: tgBot, login: !!tgLoginConfig(c) },
      currencies: CURRENCIES,
      currentCurrency: user.currency,
      owner: await isOwner(c, user),
    }),
  );
});

app.post('/settings', async (c) => {
  const user = c.get('user');
  const form = await c.req.parseBody();
  const action = formStr(form, 'action');

  if (action === 'change_password') {
    // У аккаунта, созданного через Telegram, пароля ещё нет — его задают без «текущего»
    if (user.password_hash && !checkPassword(user.password_hash, formStr(form, 'current_password'))) {
      flash(c, flashT(c).pwWrong, 'error');
      return c.redirect('/settings');
    }
    const newPassword = formStr(form, 'new_password');
    if (newPassword.length < MIN_PASSWORD) {
      flash(c, flashT(c).pwShort.replace('%d', String(MIN_PASSWORD)), 'error');
      return c.redirect('/settings');
    }
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hashPassword(newPassword), user.id).run();
    await revokeSessions(c, user.id); // кто знал старый пароль, вылетает со всех устройств
    flash(c, user.password_hash ? flashT(c).pwChanged : flashT(c).pwSet, 'success');
  } else if (action === 'logout_all') {
    await revokeSessions(c, user.id);
    flash(c, flashT(c).loggedOutAll, 'success');
  } else if (action === 'change_currency') {
    const cur = formStr(form, 'currency');
    if (cur in CURRENCIES) {
      await c.env.DB.prepare('UPDATE users SET currency = ? WHERE id = ?').bind(cur, user.id).run();
      flash(c, flashT(c).currencyUpdated, 'success');
    }
  } else if (action === 'change_lang') {
    const lng = langOf(formStr(form, 'lang'));
    await c.env.DB.prepare('UPDATE users SET lang = ? WHERE id = ?').bind(lng, user.id).run();
    setCookie(c, 'lang', lng, { path: '/', maxAge: 400 * 24 * 3600, sameSite: 'Lax' });
    flash(c, tr(lng).fl.langUpdated, 'success');
  }
  return c.redirect('/settings');
});

app.post('/settings/delete_account', async (c) => {
  const id = c.get('user').id;
  const db = c.env.DB;
  await db.batch([
    db.prepare('DELETE FROM friendships WHERE from_user_id = ?1 OR to_user_id = ?1').bind(id),
    db.prepare('DELETE FROM expenses WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM avatars WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM api_tokens WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM telegram_links WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM telegram_codes WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM ai_usage WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  logout(c);
  flash(c, flashT(c).accountDeleted, 'success');
  return c.redirect('/login');
});

// ---------- дашборд владельца: статистика по пользователям ----------

// Владелец — тот, чей аккаунт привязан к Telegram с ID из секрета TELEGRAM_ADMIN_ID (как /admin в боте).
// Остальным страницы как будто нет.
async function isOwner(c: C, user: User): Promise<boolean> {
  const admin = Number(c.env.TELEGRAM_ADMIN_ID ?? '');
  if (!Number.isInteger(admin) || admin <= 0) return false;
  return !!(await c.env.DB.prepare('SELECT 1 FROM telegram_links WHERE user_id = ? AND chat_id = ?').bind(user.id, admin).first());
}

app.get('/admin', async (c) => {
  const user = c.get('user');
  if (!(await isOwner(c, user))) return c.notFound();
  const db = c.env.DB;
  // Активность — когда трата записана (created_at), а не на какую дату
  const [totals, signups, active, funnel, retention, sources, langs, currencies, users] = await db.batch([
    db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-7 days')) AS new7,
         (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-30 days')) AS new30,
         (SELECT COUNT(DISTINCT user_id) FROM expenses WHERE created_at >= datetime('now', '-1 day')) AS active1,
         (SELECT COUNT(DISTINCT user_id) FROM expenses WHERE created_at >= datetime('now', '-7 days')) AS active7,
         (SELECT COUNT(*) FROM expenses) AS expenses,
         (SELECT COUNT(*) FROM expenses WHERE created_at >= datetime('now', '-7 days')) AS expenses7,
         (SELECT COUNT(*) FROM telegram_links) AS tg,
         (SELECT COUNT(*) FROM subscriptions) AS subs,
         (SELECT COUNT(DISTINCT user_id) FROM subscriptions) AS subs_users,
         (SELECT COUNT(*) FROM friendships WHERE status = 'accepted') AS friends,
         (SELECT COUNT(*) FROM avatars) AS avatars,
         (SELECT COUNT(*) FROM users WHERE bio IS NOT NULL AND bio <> '') AS bios`,
    ),
    db.prepare(`SELECT date(created_at) AS d, COUNT(*) AS n FROM users WHERE created_at >= date('now', '-29 days') GROUP BY d`),
    db.prepare(`SELECT date(created_at) AS d, COUNT(DISTINCT user_id) AS n FROM expenses WHERE created_at >= date('now', '-29 days') GROUP BY d`),
    db.prepare(
      `SELECT COUNT(*) AS total, SUM(n >= 1) AS first, SUM(n >= 5) AS five, SUM(days >= 2) AS returned FROM
         (SELECT u.id, COUNT(e.id) AS n, COUNT(DISTINCT date(e.created_at)) AS days FROM users u LEFT JOIN expenses e ON e.user_id = u.id GROUP BY u.id)`,
    ),
    db.prepare(
      `SELECT COUNT(*) AS base, SUM(EXISTS(SELECT 1 FROM expenses e WHERE e.user_id = u.id AND e.created_at >= datetime('now', '-7 days'))) AS kept
       FROM users u WHERE u.created_at < datetime('now', '-7 days')`,
    ),
    db.prepare(
      `SELECT s.source, COUNT(*) AS n, SUM(t.user_id IS NOT NULL) AS linked FROM tg_sources s
       LEFT JOIN telegram_links t ON t.chat_id = s.chat_id GROUP BY s.source ORDER BY n DESC LIMIT 12`,
    ),
    db.prepare('SELECT lang AS k, COUNT(*) AS n FROM users GROUP BY lang ORDER BY n DESC'),
    db.prepare('SELECT currency AS k, COUNT(*) AS n FROM users GROUP BY currency ORDER BY n DESC'),
    db.prepare(
      `SELECT u.id, u.username, u.created_at, u.lang, u.currency,
         (SELECT COUNT(*) FROM expenses WHERE user_id = u.id) AS n,
         (SELECT MAX(created_at) FROM expenses WHERE user_id = u.id) AS last,
         (SELECT COUNT(*) FROM subscriptions WHERE user_id = u.id) AS subs,
         EXISTS(SELECT 1 FROM telegram_links WHERE user_id = u.id) AS tg,
         (SELECT s.source FROM tg_sources s JOIN telegram_links t ON t.chat_id = s.chat_id WHERE t.user_id = u.id) AS source
       FROM users u ORDER BY COALESCE((SELECT MAX(created_at) FROM expenses WHERE user_id = u.id), u.created_at) DESC LIMIT 300`,
    ),
  ]);
  const today = periodStart('day');
  const days = Array.from({ length: 30 }, (_, i) => isoDate(new Date(Date.parse(today) - (29 - i) * 86400000)));
  const series = (r: D1Result) => {
    const m = new Map((r.results as { d: string; n: number }[]).map((x) => [x.d, x.n]));
    return days.map((d) => ({ d, n: m.get(d) ?? 0 }));
  };
  const data: AdminData = {
    totals: totals.results[0] as Record<string, number>,
    signups: series(signups),
    active: series(active),
    funnel: funnel.results[0] as AdminData['funnel'],
    retention: retention.results[0] as AdminData['retention'],
    sources: sources.results as AdminData['sources'],
    langs: langs.results as AdminData['langs'],
    currencies: currencies.results as AdminData['currencies'],
    users: users.results as AdminData['users'],
  };
  return c.html(adminPage({ flashes: popFlashes(c), lang: langOf(user.lang), today, data }));
});

// Расписание (triggers.crons в wrangler.jsonc): итоги от Трэка в Telegram.
// В рассылке нет ссылок на сайт, поэтому адрес сайта не нужен.
const EVENING_CRON = '0 18 * * *'; // 21:00 по Москве
const WEEKLY_CRON = '0 7 * * 1'; // понедельник, 10:00 по Москве
const ADMIN_CRON = '0 6 * * *'; // 9:00 по Москве — утренняя сводка владельцу и списания по подпискам

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    if (event.cron === EVENING_CRON) ctx.waitUntil(cleanupLimits(env.DB));
    const token = env.TELEGRAM_BOT_TOKEN;
    const d = token ? botDeps(env, token, '') : null;
    // Утром проводим списания по подпискам (и без бота), затем бот сообщает о сегодняшних и завтрашних
    if (event.cron === ADMIN_CRON) {
      ctx.waitUntil(
        chargeDue(env.DB, periodStart('day')).then((charged) => (d ? sendSubReminders(d, charged) : undefined)),
      );
      // Первое число: приглашение посмотреть «Итоги прошлого месяца»
      if (d && periodStart('day').endsWith('-01')) ctx.waitUntil(sendWrappedInvites(d));
    }
    if (!d) return;
    if (event.cron === EVENING_CRON) ctx.waitUntil(sendEveningDigests(d));
    if (event.cron === WEEKLY_CRON) ctx.waitUntil(sendWeeklyDigests(d));
    if (event.cron === ADMIN_CRON) ctx.waitUntil(sendAdminReport(d));
  },
} satisfies ExportedHandler<Env>;

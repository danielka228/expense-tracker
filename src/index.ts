import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, getSignedCookie, setCookie, setSignedCookie } from 'hono/cookie';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { lookupProduct, nearbyStores, priceHistory, rememberPlace, rememberProduct } from './lookup';
import { checkPassword, hashPassword, needsRehash } from './passwords';
import { botApi, botFileApi, botUsername, handleUpdate, verifyInitData, webhookSecret, type TgUpdate } from './telegram';
import {
  authPage,
  landingPage,
  dashboardPage,
  friendsPage,
  tgAppPage,
  friendProfilePage,
  profilePage,
  settingsPage,
  type Currency,
  type ExpenseRow,
  type Flash,
} from './views';

type Env = {
  DB: D1Database;
  SECRET_KEY: string;
  SHORTCUT_URL?: string;
  DEMO?: string; // "1" — демо-версия с кнопкой «Войти в демо»
  TELEGRAM_BOT_TOKEN?: string; // токен от @BotFather; workflow кладёт его из секрета GitHub
  TELEGRAM_API?: string; // только для локальной проверки: адрес заглушки вместо api.telegram.org
  AI?: Ai; // Workers AI: распознавание голосовых в Telegram-боте
};

interface User {
  id: number;
  username: string;
  password_hash: string;
  currency: string;
  created_at: string | null;
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
const SESSION_MAX_AGE = 90 * 24 * 3600;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const app = new Hono<App>();

// ---------- сессия и flash-сообщения ----------

async function getSessionUserId(c: C): Promise<number | null> {
  const raw = await getSignedCookie(c, c.env.SECRET_KEY, SESSION_COOKIE);
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function login(c: C, userId: number) {
  await setSignedCookie(c, SESSION_COOKIE, String(userId), c.env.SECRET_KEY, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_MAX_AGE,
  });
}

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
  return (CURRENCIES[user.currency] ?? CURRENCIES.RUB).symbol;
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
    flash(c, 'Сессия устарела, войдите заново', 'error');
    return c.redirect('/login');
  }
  c.set('user', user);
  await next();
};

for (const p of ['/dashboard', '/delete/*', '/friends', '/friends/*', '/profile', '/profile/*', '/avatar/*', '/settings', '/settings/*', '/api/product/*', '/api/stores']) {
  app.use(p, loginRequired);
}

// ---------- маршруты ----------

app.get('/', async (c) => {
  if (await getSessionUserId(c)) return c.redirect('/dashboard');
  return c.html(landingPage({ demo: c.env.DEMO === '1' }));
});

app.get('/register', (c) => c.html(authPage('register', popFlashes(c), c.env.DEMO === '1')));
app.post('/register', async (c) => {
  const form = await c.req.parseBody();
  const username = formStr(form, 'username').trim();
  const password = formStr(form, 'password');
  const fail = (msg: string) => c.html(authPage('register', [...popFlashes(c), ['error', msg]], c.env.DEMO === '1'));

  if (!username || !password) return fail('Заполните все поля');
  if (password.length < 4) return fail('Пароль должен быть не короче 4 символов');
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first()) {
    return fail('Такой пользователь уже существует');
  }

  const row = await c.env.DB.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id')
    .bind(username, hashPassword(password))
    .first<{ id: number }>();
  await login(c, row!.id);
  flash(c, 'Регистрация прошла успешно!', 'success');
  return c.redirect('/dashboard');
});

app.get('/login', (c) => c.html(authPage('login', popFlashes(c), c.env.DEMO === '1')));
app.post('/login', async (c) => {
  const form = await c.req.parseBody();
  const username = formStr(form, 'username').trim();
  const password = formStr(form, 'password');

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<User>();
  if (user && checkPassword(user.password_hash, password)) {
    if (needsRehash(user.password_hash)) {
      await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hashPassword(password), user.id).run();
    }
    await login(c, user.id);
    return c.redirect('/dashboard');
  }
  return c.html(authPage('login', [...popFlashes(c), ['error', 'Неверный логин или пароль']], c.env.DEMO === '1'));
});

app.get('/logout', (c) => {
  logout(c);
  return c.redirect('/login');
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
  const o = await spendingOverview(c.env.DB, user.id, 15);

  return c.html(
    dashboardPage({
      flashes: popFlashes(c),
      sym: symbol(user),
      username: user.username,
      demo: c.env.DEMO === '1',
      categories: CATEGORIES,
      ...o,
    }),
  );
});

app.post('/dashboard', async (c) => {
  const user = c.get('user');
  const form = await c.req.parseBody();
  const rawAmount = formStr(form, 'amount').replace(/,/g, '.').trim();
  const amount = rawAmount === '' ? NaN : Number(rawAmount);
  if (!Number.isFinite(amount)) {
    flash(c, 'Введите корректную сумму', 'error');
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
  flash(c, 'Трата добавлена', 'success');
  return c.redirect('/dashboard');
});

// ---------- сканер: товар по штрих-коду и магазины рядом ----------

app.get('/api/product/:code{[0-9]{8,14}}', async (c) => {
  const code = c.req.param('code');
  const [product, prices] = await Promise.all([
    lookupProduct(c.env.DB, code),
    priceHistory(c.env.DB, code, c.get('user').id),
  ]);
  return c.json({ product, prices });
});

app.get('/api/stores', async (c) => {
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
const DEMO_USERS = ['Демо', 'Аня', 'Макс'];
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
  for (const name of DEMO_USERS) {
    let row = await db.prepare('SELECT id FROM users WHERE username = ?').bind(name).first<{ id: number }>();
    if (!row) {
      // Пароль случайный: в демо входят только кнопкой
      row = await db
        .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, datetime('now', '-40 days')) RETURNING id")
        .bind(name, hashPassword(randomBytes(18).toString('base64url')))
        .first<{ id: number }>();
    }
    ids.push(row!.id);
  }
  const [me, anya, max] = ids;
  await db.batch([
    db.prepare('DELETE FROM expenses WHERE user_id IN (?, ?, ?)').bind(me, anya, max),
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
        .bind(ids[u], amount, category, note, `-${ago} days`, store, barcode, `-${ago} days`, `-${i} minutes`),
    ),
  ]);
  await login(c, me);
  return c.redirect('/dashboard');
});

app.post('/delete/:id{[0-9]+}', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  if (res.meta.changes) flash(c, 'Запись удалена', 'success');
  return c.redirect('/dashboard');
});

/** Рейтинг: я и друзья, кто сколько потратил с даты since. Общий для страницы «Друзья» и бота. */
async function leaderboard(db: D1Database, userId: number, since: string) {
  const ids = [...(await getFriendIds(db, userId)), userId];
  const { results } = await db
    .prepare(
      `SELECT u.id, u.username, COALESCE(SUM(e.amount), 0) AS total
       FROM users u LEFT JOIN expenses e ON e.user_id = u.id AND e.expense_date >= ?
       WHERE u.id IN (SELECT value FROM json_each(?))
       GROUP BY u.id ORDER BY total DESC`,
    )
    .bind(since, JSON.stringify(ids))
    .all<{ id: number; username: string; total: number }>();
  return results.map((r) => ({ ...r, is_me: r.id === userId }));
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
    flash(c, 'Профиль виден только друзьям', 'error');
    return c.redirect('/friends');
  }
  const [o, av] = await Promise.all([
    spendingOverview(db, fid, 10),
    db.prepare('SELECT updated_at FROM avatars WHERE user_id = ?').bind(fid).first<{ updated_at: string }>(),
  ]);
  return c.html(
    friendProfilePage({
      flashes: popFlashes(c),
      sym: symbol(friend),
      id: fid,
      username: friend.username,
      friendsSince: fs.created_at,
      avatarV: av ? String(Date.parse(av.updated_at.replace(' ', 'T') + 'Z') / 1000 || 0) : null,
      ...o,
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
  if (res.meta.changes) flash(c, 'Удалён из друзей', 'success');
  return c.redirect('/friends');
});

app.post('/friends/add', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const form = await c.req.parseBody();
  const targetUsername = formStr(form, 'friend_login').trim().replace(/^@/, '');

  if (targetUsername === user.username) {
    flash(c, 'Нельзя добавить самого себя', 'error');
    return c.redirect('/friends');
  }
  const target = await db.prepare('SELECT id, username FROM users WHERE username = ?').bind(targetUsername).first<{ id: number; username: string }>();
  if (!target) {
    flash(c, 'Пользователь с таким ником не найден', 'error');
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
    flash(c, 'Заявка уже отправлена или вы уже друзья', 'error');
    return c.redirect('/friends');
  }

  await db.prepare("INSERT INTO friendships (from_user_id, to_user_id, status) VALUES (?, ?, 'pending')").bind(user.id, target.id).run();
  flash(c, `Заявка отправлена пользователю ${target.username}`, 'success');
  return c.redirect('/friends');
});

app.post('/friends/accept/:id{[0-9]+}', async (c) => {
  const res = await c.env.DB.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ? AND to_user_id = ? AND status = 'pending'")
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  if (res.meta.changes) flash(c, 'Заявка принята', 'success');
  return c.redirect('/friends');
});

app.post('/friends/decline/:id{[0-9]+}', async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM friendships WHERE id = ? AND to_user_id = ? AND status = 'pending'")
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  if (res.meta.changes) flash(c, 'Заявка отклонена', 'success');
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
      sym: symbol(user),
      shortcutUrl: c.env.SHORTCUT_URL || DEFAULT_SHORTCUT_URL,
      username: user.username,
      userId: user.id,
      createdAt: user.created_at,
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
    flash(c, 'Telegram-бот сейчас недоступен', 'error');
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

app.post('/profile/telegram/unlink', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM telegram_links WHERE user_id = ?').bind(c.get('user').id).run();
  if (res.meta.changes) flash(c, 'Telegram отключён', 'success');
  return c.redirect('/profile');
});

// Сайт внутри Telegram (Mini App): кнопки бота открывают /tg/app, страница отдаёт initData,
// мы проверяем подпись Telegram и входим в привязанный аккаунт без пароля.
app.get('/tg/app', (c) => {
  const next = c.req.query('next') ?? '';
  return c.html(tgAppPage(/^\/[a-z0-9_/-]*$/i.test(next) && !next.startsWith('//') ? next : '/dashboard'));
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
async function transcribe(ai: Ai, audio: ArrayBuffer) {
  const r = await ai.run('@cf/openai/whisper-large-v3-turbo', {
    audio: Buffer.from(audio).toString('base64'),
    language: 'ru',
    vad_filter: true,
    initial_prompt: 'Кофе 250 рублей. Вчера такси 540. Продукты 1200.',
  });
  return r.text ?? '';
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
  const db = c.env.DB;
  try {
    await handleUpdate(
      {
        db,
        api: botApi(token, c.env.TELEGRAM_API),
        file: botFileApi(token, c.env.TELEGRAM_API),
        transcribe: c.env.AI ? (audio) => transcribe(c.env.AI as Ai, audio) : null,
        siteUrl: new URL(c.req.url).origin,
        categories: CATEGORIES,
        currencies: CURRENCIES,
        today: periodStart('day'),
        since: { day: periodStart('day'), week: periodStart('week'), month: periodStart('month') },
        overview: (uid) => spendingOverview(db, uid, 0),
        leaderboard: (uid, since) => leaderboard(db, uid, since),
      },
      update,
    );
  } catch (e) {
    // Отвечаем 200 в любом случае, иначе Telegram будет повторять это сообщение снова и снова
    console.error('telegram update failed', e);
  }
  return c.text('ok');
});

app.get('/avatar/:id{[0-9]+}', async (c) => {
  const a = await c.env.DB.prepare('SELECT data FROM avatars WHERE user_id = ?')
    .bind(Number(c.req.param('id')))
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
    flash(c, 'Выберите фото', 'error');
    return c.redirect('/profile');
  }
  const bytes = new Uint8Array(await f.arrayBuffer());
  // Браузер уже сжал фото до 256x256 JPEG; здесь только проверяем, что это действительно JPEG
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isJpeg || bytes.length > MAX_AVATAR_BYTES) {
    flash(c, 'Не удалось обработать фото, попробуйте другое', 'error');
    return c.redirect('/profile');
  }
  await c.env.DB.prepare(
    `INSERT INTO avatars (user_id, data, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  )
    .bind(c.get('user').id, bytes)
    .run();
  flash(c, 'Фото обновлено', 'success');
  return c.redirect('/profile');
});

app.post('/profile/avatar/delete', async (c) => {
  await c.env.DB.prepare('DELETE FROM avatars WHERE user_id = ?').bind(c.get('user').id).run();
  flash(c, 'Фото удалено', 'success');
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
  flash(c, 'Токен создан', 'success');
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
  if (!rec) {
    const hint = !token
      ? 'Токен не дошёл: проверь, что в заголовке X-Token выбрана переменная с токеном'
      : token.length !== 32
        ? `Пришло ${token.length} символов вместо 32: в действии «Текст» должен быть только токен`
        : 'Такого токена нет на этом сайте: скопируй токен в Профиле на expense-tracker.hhoh7327.workers.dev';
    return c.json({ ok: false, error: 'Неверный токен', hint }, 401);
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
        error: 'Некорректная сумма',
        received: String(rawAmount),
        keys: [...Object.keys(data), ...Object.keys(form)],
        content_type: contentType || null,
      },
      400,
    );
  }
  if (amount <= 0) return c.json({ ok: false, error: 'Сумма должна быть больше нуля', received: String(rawAmount) }, 400);

  let category = String(field('category')).trim();
  if (!CATEGORIES.includes(category)) category = 'Прочее';
  const note = [...String(field('note')).trim()].slice(0, 255).join('');

  await c.env.DB.prepare('INSERT INTO expenses (user_id, amount, category, note, expense_date) VALUES (?, ?, ?, ?, ?)')
    .bind(rec.user_id, amount, category, note, periodStart('day'))
    .run();
  return c.json({ ok: true, amount, category });
});

app.get('/settings', (c) => {
  const user = c.get('user');
  return c.html(
    settingsPage({ flashes: popFlashes(c), username: user.username, currencies: CURRENCIES, currentCurrency: user.currency }),
  );
});

app.post('/settings', async (c) => {
  const user = c.get('user');
  const form = await c.req.parseBody();
  const action = formStr(form, 'action');

  if (action === 'change_password') {
    if (!checkPassword(user.password_hash, formStr(form, 'current_password'))) {
      flash(c, 'Текущий пароль неверен', 'error');
      return c.redirect('/settings');
    }
    const newPassword = formStr(form, 'new_password');
    if (newPassword.length < 4) {
      flash(c, 'Новый пароль должен быть не короче 4 символов', 'error');
      return c.redirect('/settings');
    }
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hashPassword(newPassword), user.id).run();
    flash(c, 'Пароль изменён', 'success');
  } else if (action === 'change_currency') {
    const cur = formStr(form, 'currency');
    if (cur in CURRENCIES) {
      await c.env.DB.prepare('UPDATE users SET currency = ? WHERE id = ?').bind(cur, user.id).run();
      flash(c, 'Валюта обновлена', 'success');
    }
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
    db.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  logout(c);
  flash(c, 'Аккаунт удалён', 'success');
  return c.redirect('/login');
});

export default app;

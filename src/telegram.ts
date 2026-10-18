// Telegram-бот: записывает траты из сообщений («кофе 250»), показывает сводку и последние записи.
// Telegram присылает обновления на POST /tg/webhook (см. index.ts), а workflow при деплое
// регистрирует этот адрес через setWebhook с секретом webhookSecret(токен).

import { CATEGORY_RULES, parseExpense } from './parse';
import { fmt0, MONTHS_NOM, MONTHS_SHORT, type ExpenseRow } from './views';

interface TgUser {
  id: number;
  username?: string;
}
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  text?: string;
  voice?: unknown;
}
interface TgCallback {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}
export interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallback;
}
type Button = { text: string; callback_data?: string; url?: string };
type Keyboard = { inline_keyboard: Button[][] };

export interface BotDeps {
  db: D1Database;
  api: string; // https://api.telegram.org/bot<токен>, см. botApi
  siteUrl: string;
  categories: string[];
  today: string;
  symbol(currency: string): string;
  overview(userId: number): Promise<{
    todayTotal: number;
    weekTotal: number;
    monthTotal: number;
    byCategory: { category: string; total: number }[];
    recent: ExpenseRow[];
  }>;
}

interface Linked {
  id: number;
  username: string;
  currency: string;
}

const EMOJI: Record<string, string> = {
  Еда: '🍔',
  Транспорт: '🚕',
  Жильё: '🏠',
  Развлечения: '🎮',
  Здоровье: '💊',
  Одежда: '👕',
  Табак: '🚬',
  Прочее: '📦',
};
const emoji = (cat: string) => EMOJI[cat] ?? '📦';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const HELP = `Просто напиши трату, и я её запишу:
<code>кофе 250</code>
<code>вчера такси 540</code>
<code>полторы тысячи продукты</code>
Можно несколько строк сразу: каждая станет отдельной тратой.

Категорию угадываю сам. Под каждой записью есть кнопки, чтобы поменять категорию или удалить запись.

/stats — сколько потрачено
/last — последние траты
/undo — удалить последнюю запись
/unlink — отключить бота от аккаунта`;

/** Адрес Bot API. TELEGRAM_API можно подменить для локальной проверки без настоящего Telegram. */
export const botApi = (token: string, base?: string) => `${base || 'https://api.telegram.org'}/bot${token}`;

export async function tg(api: string, method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${api}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as { ok: boolean; result?: { username?: string }; description?: string };
}

/** Секрет, который Telegram присылает в заголовке каждого запроса. Workflow считает так же: sha256(токен), первые 48 символов. */
export async function webhookSecret(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 48);
}

let cachedName: { api: string; name: string } | null = null;

/** Имя бота для ссылок t.me/<имя>. Запрашивается у Telegram один раз на экземпляр Worker. */
export async function botUsername(api: string): Promise<string | null> {
  if (cachedName?.api === api) return cachedName.name;
  try {
    const r = await tg(api, 'getMe', {});
    if (r.ok && r.result?.username) {
      cachedName = { api, name: r.result.username };
      return cachedName.name;
    }
  } catch {
    /* Telegram недоступен — карточку бота просто не показываем */
  }
  return null;
}

function send(d: BotDeps, chatId: number, text: string, keyboard?: Keyboard) {
  return tg(d.api, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
}

function dayLabel(iso: string, today: string) {
  const diff = Math.round((Date.parse(today) - Date.parse(iso)) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  return `${Number(iso.slice(8, 10))} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
}

function card(d: BotDeps, e: ExpenseRow, sym: string) {
  return `✅ <b>${fmt0(e.amount)} ${esc(sym)}</b>${e.note ? ` · ${esc(e.note)}` : ''}
${emoji(e.category)} ${esc(e.category)} · ${dayLabel(e.expense_date, d.today)}`;
}

const mainKeyboard = (id: number): Keyboard => ({
  inline_keyboard: [
    [
      { text: '🏷 Категория', callback_data: `c:${id}` },
      { text: '🗑 Удалить', callback_data: `d:${id}` },
    ],
  ],
});

function categoryKeyboard(d: BotDeps, id: number): Keyboard {
  const buttons = d.categories.map((cat, i) => ({ text: `${emoji(cat)} ${cat}`, callback_data: `s:${id}:${i}` }));
  const rows: Button[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([{ text: '‹ Назад', callback_data: `b:${id}` }]);
  return { inline_keyboard: rows };
}

function linkedUser(d: BotDeps, chatId: number) {
  return d.db
    .prepare('SELECT u.id, u.username, u.currency FROM telegram_links t JOIN users u ON u.id = t.user_id WHERE t.chat_id = ?')
    .bind(chatId)
    .first<Linked>();
}

export async function handleUpdate(d: BotDeps, u: TgUpdate) {
  if (u.callback_query) return onCallback(d, u.callback_query);
  const msg = u.message;
  if (!msg || msg.chat.type !== 'private') return;
  const chatId = msg.chat.id;
  const text = (msg.text ?? '').trim();

  const start = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{8,64})$/);
  if (start) return link(d, msg, start[1]);

  const user = await linkedUser(d, chatId);
  if (!user) {
    return send(
      d,
      chatId,
      'Привет! Я записываю траты в СпендТрекер.\n\nЧтобы начать, подключи меня к своему аккаунту: на сайте открой <b>Профиль</b> и нажми <b>«Подключить Telegram»</b>.',
      { inline_keyboard: [[{ text: 'Открыть профиль', url: `${d.siteUrl}/profile` }]] },
    );
  }

  const cmd = text.match(/^\/(\w+)/)?.[1];
  if (cmd === 'start' || cmd === 'help') return send(d, chatId, HELP);
  if (cmd === 'stats') return stats(d, user, chatId);
  if (cmd === 'last') return last(d, user, chatId);
  if (cmd === 'undo') return undo(d, user, chatId);
  if (cmd === 'unlink') {
    await d.db.prepare('DELETE FROM telegram_links WHERE chat_id = ?').bind(chatId).run();
    return send(d, chatId, 'Бот отключён от аккаунта. Подключить снова можно в профиле на сайте.');
  }
  if (cmd) return send(d, chatId, 'Не знаю такой команды. /help — что я умею.');
  if (!text) {
    return send(d, chatId, msg.voice ? 'Голосовые пока не понимаю. Напиши текстом: <code>кофе 250</code>' : 'Напиши трату текстом: <code>кофе 250</code>');
  }
  return addFromText(d, user, chatId, text);
}

async function link(d: BotDeps, msg: TgMessage, code: string) {
  const chatId = msg.chat.id;
  const row = await d.db
    .prepare("SELECT user_id FROM telegram_codes WHERE code = ? AND created_at > datetime('now', '-30 minutes')")
    .bind(code)
    .first<{ user_id: number }>();
  if (!row) {
    return send(d, chatId, 'Ссылка устарела. Открой профиль на сайте и нажми «Подключить Telegram» ещё раз.', {
      inline_keyboard: [[{ text: 'Открыть профиль', url: `${d.siteUrl}/profile` }]],
    });
  }
  await d.db.batch([
    d.db.prepare('DELETE FROM telegram_links WHERE chat_id = ? OR user_id = ?').bind(chatId, row.user_id),
    d.db.prepare('INSERT INTO telegram_links (user_id, chat_id, tg_username) VALUES (?, ?, ?)').bind(row.user_id, chatId, msg.from?.username ?? null),
    d.db.prepare('DELETE FROM telegram_codes WHERE user_id = ?').bind(row.user_id),
  ]);
  const user = await linkedUser(d, chatId);
  return send(d, chatId, `Готово! Бот подключён к аккаунту <b>${esc(user?.username ?? '')}</b>.\n\n${HELP}`);
}

async function addFromText(d: BotDeps, user: Linked, chatId: number, text: string) {
  const sym = d.symbol(user.currency);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10);
  const parsed = lines.map((l) => parseExpense(l, d.today, CATEGORY_RULES)).filter((p) => p.amount && p.amount > 0 && p.amount < 1e9);
  if (!parsed.length) {
    return send(d, chatId, 'Не нашёл сумму. Напиши, например: <code>кофе 250</code> или <code>вчера такси 540</code>');
  }
  for (const p of parsed) {
    const e: ExpenseRow = {
      id: 0,
      amount: p.amount as number,
      category: p.category && d.categories.includes(p.category) ? p.category : 'Прочее',
      note: p.note || null,
      expense_date: p.date ?? d.today,
    };
    const ins = await d.db
      .prepare('INSERT INTO expenses (user_id, amount, category, note, expense_date) VALUES (?, ?, ?, ?, ?) RETURNING id')
      .bind(user.id, e.amount, e.category, e.note, e.expense_date)
      .first<{ id: number }>();
    e.id = ins?.id ?? 0;
    await send(d, chatId, card(d, e, sym), mainKeyboard(e.id));
  }
}

async function stats(d: BotDeps, user: Linked, chatId: number) {
  const sym = esc(d.symbol(user.currency));
  const o = await d.overview(user.id);
  const sum = o.byCategory.reduce((s, r) => s + r.total, 0);
  const cats = o.byCategory
    .map((r) => `${emoji(r.category)} ${esc(r.category)} — ${fmt0(r.total)} ${sym} · ${Math.round((r.total / sum) * 100)}%`)
    .join('\n');
  const text = `<b>${MONTHS_NOM[Number(d.today.slice(5, 7)) - 1]}</b> — ${fmt0(o.monthTotal)} ${sym}
Сегодня: ${fmt0(o.todayTotal)} ${sym} · Неделя: ${fmt0(o.weekTotal)} ${sym}${cats ? `\n\n${cats}` : ''}`;
  return send(d, chatId, text, { inline_keyboard: [[{ text: 'Открыть сайт', url: `${d.siteUrl}/dashboard` }]] });
}

async function last(d: BotDeps, user: Linked, chatId: number) {
  const sym = esc(d.symbol(user.currency));
  const { recent } = await d.overview(user.id);
  if (!recent.length) return send(d, chatId, 'Пока нет ни одной траты. Напиши, например: <code>кофе 250</code>');
  const rows = recent.map(
    (e) => `${dayLabel(e.expense_date, d.today)} · ${emoji(e.category)} ${esc(e.note || e.category)} — <b>${fmt0(e.amount)} ${sym}</b>`,
  );
  return send(d, chatId, `<b>Последние траты</b>\n${rows.join('\n')}`);
}

async function undo(d: BotDeps, user: Linked, chatId: number) {
  const e = await d.db
    .prepare('DELETE FROM expenses WHERE id = (SELECT MAX(id) FROM expenses WHERE user_id = ?1) AND user_id = ?1 RETURNING amount, note, category')
    .bind(user.id)
    .first<{ amount: number; note: string | null; category: string }>();
  if (!e) return send(d, chatId, 'Удалять нечего: трат пока нет.');
  return send(d, chatId, `↩️ Удалил: ${fmt0(e.amount)} ${esc(d.symbol(user.currency))} · ${esc(e.note || e.category)}`);
}

async function onCallback(d: BotDeps, q: TgCallback) {
  const answer = (text?: string) => tg(d.api, 'answerCallbackQuery', { callback_query_id: q.id, ...(text ? { text } : {}) });
  const msg = q.message;
  const m = (q.data ?? '').match(/^([cdsb]):(\d+)(?::(\d+))?$/);
  if (!msg || !m) return answer();
  const user = await linkedUser(d, msg.chat.id);
  if (!user) return answer('Бот не подключён к аккаунту');

  const id = Number(m[2]);
  const e = await d.db
    .prepare('SELECT id, amount, category, note, expense_date FROM expenses WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<ExpenseRow>();
  const edit = { chat_id: msg.chat.id, message_id: msg.message_id };
  if (!e) {
    await tg(d.api, 'editMessageReplyMarkup', { ...edit, reply_markup: { inline_keyboard: [] } });
    return answer('Этой записи уже нет');
  }
  const sym = d.symbol(user.currency);

  if (m[1] === 'c') {
    await tg(d.api, 'editMessageReplyMarkup', { ...edit, reply_markup: categoryKeyboard(d, id) });
    return answer();
  }
  if (m[1] === 'b') {
    await tg(d.api, 'editMessageReplyMarkup', { ...edit, reply_markup: mainKeyboard(id) });
    return answer();
  }
  if (m[1] === 's') {
    const cat = d.categories[Number(m[3])];
    if (!cat) return answer();
    await d.db.prepare('UPDATE expenses SET category = ? WHERE id = ? AND user_id = ?').bind(cat, id, user.id).run();
    await tg(d.api, 'editMessageText', { ...edit, text: card(d, { ...e, category: cat }, sym), parse_mode: 'HTML', reply_markup: mainKeyboard(id) });
    return answer(`${emoji(cat)} ${cat}`);
  }
  // d — удалить
  await d.db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  await tg(d.api, 'editMessageText', {
    ...edit,
    text: `🗑 <s>${fmt0(e.amount)} ${esc(sym)}${e.note ? ` · ${esc(e.note)}` : ''}</s> — удалено`,
    parse_mode: 'HTML',
  });
  return answer('Удалено');
}

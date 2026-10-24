// Telegram-бот: записывает траты из сообщений и голосовых («кофе 250»), а всё остальное — через меню
// с кнопками, которое живёт в одном сообщении и перерисовывается на месте (как в Crypto Bot).
// Инлайн-режим: «@бот сигареты 250» в любом чате → карточка «Записать» → трата записана, сообщение в чате.
// Telegram присылает обновления на POST /tg/webhook (см. index.ts), а workflow при деплое
// регистрирует этот адрес через setWebhook с секретом webhookSecret(токен).

import { CATEGORY_RULES, parseExpense, type ParsedExpense } from './parse';
import { STICKERS, animStickerFile, stickerFile } from './stickers';
import { eveningText, plural, quip, weeklyText } from './trek';
import { aiDayAllowed, hit } from './limits';
import { takeAiQuota, type Guess } from './vision';
import { fmt0, type ExpenseRow } from './views';
import { botText, esc, langFromTg } from './botText';
import { SUB_PRESETS, chargeDue, firstCharge, insertSub, parseSubInput, perMonth, subDay, subsText, type Charged, type Sub } from './subs';
import { convert } from './money';
import { categoryLabel, currencyLabel, currencySymbol, langOf, LANGS, LANG_LABEL, tr, type Lang } from './i18n';

interface TgUser {
  id: number;
  username?: string;
  language_code?: string; // язык интерфейса Telegram: по нему выбираем язык, пока аккаунта нет
}
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  text?: string;
  voice?: { file_id: string; duration: number };
  photo?: { file_id: string; width: number }[]; // один снимок в нескольких размерах, от малого к большому
  caption?: string;
  guest_query_id?: string; // гостевой режим: бота упомянули в чужом чате
  guest_bot_caller_user?: TgUser; // кто упомянул
}
interface TgCallback {
  id: string;
  from: TgUser;
  message?: TgMessage;
  inline_message_id?: string; // кнопка под сообщением, отправленным через инлайн-режим
  data?: string;
}
interface TgInlineQuery {
  id: string;
  from: TgUser;
  query: string;
}
interface TgChosenInline {
  result_id: string;
  from: TgUser;
  query: string;
  inline_message_id?: string;
}
export interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallback;
  inline_query?: TgInlineQuery;
  chosen_inline_result?: TgChosenInline;
  guest_message?: TgMessage;
}
type Button = { text: string; callback_data?: string; url?: string; web_app?: { url: string } };
type Keyboard = { inline_keyboard: Button[][] };
type Period = 'day' | 'week' | 'month';
interface Screen {
  text: string;
  kb: Keyboard;
}

export interface BotDeps {
  db: D1Database;
  api: string; // https://api.telegram.org/bot<токен>, см. botApi
  file: string; // откуда скачивать файлы (голосовые), см. botFileApi
  transcribe: ((audio: ArrayBuffer, lang: Lang) => Promise<string>) | null; // распознавание речи; null — голосовые не понимаем
  readPhoto: ((jpeg: Uint8Array, lang: Lang) => Promise<Guess | null>) | null; // что и за сколько на фото товара или чека; null — фото не понимаем
  siteUrl: string;
  categories: string[];
  currencies: Record<string, { label: string; symbol: string }>;
  today: string;
  since: Record<Period, string>; // с какой даты считается день, неделя и месяц
  overview(userId: number): Promise<{ todayTotal: number; weekTotal: number; monthTotal: number }>;
  leaderboard(userId: number, since: string): Promise<{ username: string; total: number; is_me: boolean }[]>;
  asset(path: string): Promise<Blob | null>; // файл из public/ (видеостикеры загружаются в Telegram файлом)
  adminId: number | null; // Telegram ID владельца сайта: только ему доступна /admin
}

interface Linked {
  id: number;
  username: string;
  currency: string;
  pending_category: string | null; // выбрана в меню «Добавить», ждёт сумму
  pending_sub: string | null; // выбран сервис в «Добавить подписку» ('*' — своя), ждёт сумму и число
  notify: number; // 1 — Трэк присылает вечерние и недельные итоги
  lang: Lang; // язык аккаунта (users.lang): один и для бота, и для сайта
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
const symOf = (d: BotDeps, user: Linked) => {
  const code = user.currency in d.currencies ? user.currency : 'RUB';
  return currencySymbol(code, user.lang, d.currencies[code].symbol);
};
const LIST_PAGE = 6;
/** Знак валюты по коду (у подписки валюта может отличаться от валюты аккаунта) */
const curSym = (d: BotDeps, code: string, lang: Lang) => {
  const c = code in d.currencies ? code : 'RUB';
  return currencySymbol(c, lang, d.currencies[c].symbol);
};
/** Сумма «как в кошельке»: копейки только у небольших сумм, где они есть (9.99 $); 4010.87 ₽ → «4 011» */
const money = (n: number) => (n >= 1000 || Math.abs(n - Math.round(n)) < 0.005 ? fmt0(n) : n.toFixed(2));

/** Адрес Bot API. TELEGRAM_API можно подменить для локальной проверки без настоящего Telegram. */
export const botApi = (token: string, base?: string) => `${base || 'https://api.telegram.org'}/bot${token}`;
export const botFileApi = (token: string, base?: string) => `${base || 'https://api.telegram.org'}/file/bot${token}`;

export async function tg<T = { username?: string; file_path?: string }>(api: string, method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${api}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as { ok: boolean; result?: T; description?: string };
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Секрет, который Telegram присылает в заголовке каждого запроса. Workflow считает так же: sha256(токен), первые 48 символов. */
export async function webhookSecret(token: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).slice(0, 48);
}

/**
 * Проверка данных, с которыми Telegram открывает сайт как Mini App (Telegram.WebApp.initData).
 * Подпись: HMAC-SHA256(ключ = HMAC-SHA256("WebAppData", токен бота), строка «ключ=значение» по алфавиту).
 * Возвращает id пользователя Telegram или null.
 */
export async function verifyInitData(initData: string, token: string, maxAgeSec = 86400): Promise<number | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const enc = new TextEncoder();
  const hmac = (key: BufferSource) => crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const secret = await crypto.subtle.sign('HMAC', await hmac(enc.encode('WebAppData')), enc.encode(token));
  const sig = hex(await crypto.subtle.sign('HMAC', await hmac(secret), enc.encode(check)));
  if (sig !== hash) return null;
  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try {
    const id = (JSON.parse(params.get('user') ?? 'null') as { id?: number } | null)?.id;
    return typeof id === 'number' ? id : null;
  } catch {
    return null;
  }
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

function dayLabel(iso: string, today: string, lang: Lang) {
  const diff = Math.round((Date.parse(today) - Date.parse(iso)) / 86400000);
  const T = botText(lang);
  if (diff === 0) return T.todayWord;
  if (diff === 1) return T.yesterdayWord;
  const month = tr(lang).months.short[Number(iso.slice(5, 7)) - 1];
  const day = Number(iso.slice(8, 10));
  return lang === 'en' ? `${month} ${day}` : `${day} ${month}`;
}

function card(d: BotDeps, e: ExpenseRow, sym: string, lang: Lang) {
  return `✅ <b>${fmt0(e.amount)} ${esc(sym)}</b>${e.note ? ` · ${esc(e.note)}` : ''}
${emoji(e.category)} ${esc(categoryLabel(e.category, lang))} · ${dayLabel(e.expense_date, d.today, lang)}`;
}

/** Плитка кнопок по две в ряд */
function grid(buttons: Button[], cols = 2): Button[][] {
  const rows: Button[][] = [];
  for (let i = 0; i < buttons.length; i += cols) rows.push(buttons.slice(i, i + cols));
  return rows;
}

const back = (lang: Lang, to = 'm:home', text?: string): Button[] => [{ text: text ?? botText(lang).b.back, callback_data: to }];

/** Кнопка, которая открывает сайт прямо в Telegram (Mini App) уже со входом в аккаунт */
const appButton = (d: BotDeps, text: string, path = '/dashboard'): Button => ({
  text,
  web_app: { url: `${d.siteUrl}/tg/app?next=${encodeURIComponent(path)}` },
});

// Кнопки под тратой. page — трата открыта из списка «Мои траты», тогда есть возврат к нему.
const pg = (page?: number) => (page === undefined ? '' : `:p${page}`);

// promo — ссылка «Тоже хочу» под сообщением в чужом чате (см. promoUrl)
function expenseKeyboard(id: number, lang: Lang, page?: number, promo?: string): Keyboard {
  const T = botText(lang);
  const rows: Button[][] = [
    [
      { text: T.b.category, callback_data: `c:${id}${pg(page)}` },
      { text: T.b.del, callback_data: `d:${id}${pg(page)}` },
    ],
  ];
  if (page !== undefined) rows.push(back(lang, `m:ls:${page}`, T.b.toList));
  if (promo) rows.push([{ text: T.b.promo, url: promo }]);
  return { inline_keyboard: rows };
}

// Сообщения инлайн- и гостевого режима видят все в чужом чате: ссылка на бота с меткой chat — бесплатная реклама,
// а метка в админке показывает, сколько людей пришло именно так
async function promoUrl(d: BotDeps) {
  const bot = await botUsername(d.api);
  return bot ? `https://t.me/${bot}?start=chat` : undefined;
}

function categoryKeyboard(d: BotDeps, id: number, lang: Lang, page?: number): Keyboard {
  const buttons = d.categories.map((cat, i) => ({ text: `${emoji(cat)} ${categoryLabel(cat, lang)}`, callback_data: `s:${id}:${i}${pg(page)}` }));
  return { inline_keyboard: [...grid(buttons), back(lang, `b:${id}${pg(page)}`)] };
}

/** Переключатель периода, как сегменты на сайте: выбранный отмечен точками */
function periodRow(prefix: string, current: Period, lang: Lang): Button[] {
  return botText(lang).periods.map(([p, label]) => ({ text: p === current ? `· ${label} ·` : label, callback_data: `${prefix}:${p}` }));
}

async function linkedUser(d: BotDeps, chatId: number): Promise<Linked | null> {
  const row = await d.db
    .prepare(
      `SELECT u.id, u.username, u.currency, u.lang, t.notify,
              CASE WHEN t.pending_at > datetime('now', '-10 minutes') THEN t.pending_category END AS pending_category,
              CASE WHEN t.pending_at > datetime('now', '-10 minutes') THEN t.pending_sub END AS pending_sub
       FROM telegram_links t JOIN users u ON u.id = t.user_id WHERE t.chat_id = ?`,
    )
    .bind(chatId)
    .first<Omit<Linked, 'lang'> & { lang: string }>();
  return row ? { ...row, lang: langOf(row.lang) } : null;
}

const setPending = (d: BotDeps, user: Linked, cat: string | null) =>
  d.db.prepare("UPDATE telegram_links SET pending_category = ?, pending_sub = NULL, pending_at = datetime('now') WHERE user_id = ?").bind(cat, user.id).run();

const setPendingSub = (d: BotDeps, user: Linked, name: string | null) =>
  d.db.prepare("UPDATE telegram_links SET pending_sub = ?, pending_category = NULL, pending_at = datetime('now') WHERE user_id = ?").bind(name, user.id).run();

// ---------- экраны меню ----------

const monthName = (d: BotDeps, lang: Lang) => tr(lang).months.nom[Number(d.today.slice(5, 7)) - 1];
const LANG_BTN: Record<Lang, string> = { ru: '🇷🇺 Русский', en: '🇬🇧 English' };

async function homeScreen(d: BotDeps, user: Linked): Promise<Screen> {
  const T = botText(user.lang);
  const o = await d.overview(user.id);
  return {
    text: T.home(user.username, esc(symOf(d, user)), o, monthName(d, user.lang)),
    kb: {
      inline_keyboard: [
        [appButton(d, T.b.openApp)],
        [
          { text: T.b.add, callback_data: 'm:add' },
          { text: T.b.stats, callback_data: 'm:st:month' },
        ],
        [
          { text: T.b.mine, callback_data: 'm:ls:0' },
          { text: subsText(user.lang).bot.btn, callback_data: 'm:sub' },
        ],
        [
          { text: T.b.friends, callback_data: 'm:fr:month' },
          { text: T.b.settings, callback_data: 'm:set' },
        ],
        [
          { text: T.b.help, callback_data: 'm:help' },
          { text: T.b.stickers, callback_data: 'stk' },
        ],
      ],
    },
  };
}

function addScreen(d: BotDeps, user: Linked): Screen {
  const T = botText(user.lang);
  const buttons = d.categories.map((cat, i) => ({ text: `${emoji(cat)} ${categoryLabel(cat, user.lang)}`, callback_data: `pc:${i}` }));
  return { text: T.addScreen, kb: { inline_keyboard: [...grid(buttons), back(user.lang)] } };
}

function pendingScreen(cat: string, lang: Lang): Screen {
  const T = botText(lang);
  return { text: T.pending(emoji(cat), categoryLabel(cat, lang)), kb: { inline_keyboard: [back(lang, 'pc:x', T.b.cancel)] } };
}

async function statsScreen(d: BotDeps, user: Linked, period: Period): Promise<Screen> {
  const T = botText(user.lang);
  const sym = esc(symOf(d, user));
  const { results } = await d.db
    .prepare('SELECT category, SUM(amount) AS total FROM expenses WHERE user_id = ? AND expense_date >= ? GROUP BY category ORDER BY total DESC')
    .bind(user.id, d.since[period])
    .all<{ category: string; total: number }>();
  const sum = results.reduce((s, r) => s + r.total, 0);
  const rows = results.map((r) => {
    const pct = Math.round((r.total / sum) * 100);
    const filled = Math.max(1, Math.round(pct / 10));
    return `${emoji(r.category)} ${esc(categoryLabel(r.category, user.lang))} · <b>${fmt0(r.total)} ${sym}</b>\n${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)}  ${pct}%`;
  });
  return {
    text: T.stats(T.periodTitle(period, monthName(d, user.lang)), sum, sym, rows),
    kb: { inline_keyboard: [periodRow('m:st', period, user.lang), [appButton(d, T.b.charts)], [appButton(d, T.b.monthCard, '/month')], back(user.lang)] },
  };
}

async function listScreen(d: BotDeps, user: Linked, page: number): Promise<Screen> {
  const T = botText(user.lang);
  const sym = symOf(d, user);
  const [countRes, rowsRes] = await d.db.batch([
    d.db.prepare('SELECT COUNT(*) AS n FROM expenses WHERE user_id = ?').bind(user.id),
    d.db
      .prepare(
        `SELECT id, amount, category, note, expense_date FROM expenses WHERE user_id = ?
         ORDER BY expense_date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .bind(user.id, LIST_PAGE, page * LIST_PAGE),
  ]);
  const total = (countRes.results[0] as { n: number }).n;
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE));
  const items = (rowsRes.results as unknown as ExpenseRow[]).map((e) => [
    {
      text: `${emoji(e.category)} ${e.note || categoryLabel(e.category, user.lang)} · ${fmt0(e.amount)} ${sym} · ${dayLabel(e.expense_date, d.today, user.lang)}`,
      callback_data: `e:${e.id}:p${page}`,
    },
  ]);
  const nav: Button[] = [];
  if (pages > 1) {
    if (page > 0) nav.push({ text: '‹', callback_data: `m:ls:${page - 1}` });
    nav.push({ text: T.pageOf(page + 1, pages), callback_data: 'n' });
    if (page < pages - 1) nav.push({ text: '›', callback_data: `m:ls:${page + 1}` });
  }
  return { text: T.list(total), kb: { inline_keyboard: [...items, ...(nav.length ? [nav] : []), back(user.lang)] } };
}

async function friendsScreen(d: BotDeps, user: Linked, period: Period): Promise<Screen> {
  const T = botText(user.lang);
  const sym = esc(symOf(d, user));
  const board = await d.leaderboard(user.id, d.since[period]);
  const medals = ['🥇', '🥈', '🥉'];
  const rows = board.map(
    (r, i) => `${medals[i] ?? `${i + 1}.`} ${r.is_me ? `<b>${T.you}</b>` : esc(r.username)} — <b>${fmt0(r.total)} ${sym}</b>`,
  );
  return {
    text: T.friends(T.periodTitle(period, monthName(d, user.lang)), rows, board.length > 1),
    kb: { inline_keyboard: [periodRow('m:fr', period, user.lang), [appButton(d, T.b.addFriend, '/friends')], back(user.lang)] },
  };
}

// ---------- подписки ----------

const daysTo = (d: BotDeps, date: string) => Math.round((Date.parse(date) - Date.parse(d.today)) / 86400000);
const SUBS_SHOWN = 20; // кнопок с подписками на экране; остальные — на сайте

/** Список подписок: сколько в месяц и в год, что спишется на неделе, кнопка на каждую */
async function subsScreen(d: BotDeps, user: Linked): Promise<Screen> {
  const lang = user.lang;
  const S = subsText(lang);
  const B = S.bot;
  await chargeDue(d.db, d.today, user.id); // как на сайте: списание, у которого наступил день, записываем сразу
  const { results } = await d.db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_date, id').bind(user.id).all<Sub>();
  if (!results.length) {
    return { text: `${B.title}\n\n${B.empty}`, kb: { inline_keyboard: [[{ text: B.add, callback_data: 'sb:new' }], back(lang)] } };
  }
  const sym = esc(symOf(d, user));
  const monthly = (s: Sub) => convert(perMonth(s), s.currency, user.currency);
  const total = results.reduce((a, s) => a + monthly(s), 0);
  const top = results.reduce((a, s) => (monthly(s) > monthly(a) ? s : a));
  const soon = results.filter((s) => daysTo(d, s.next_date) <= 7);
  const lines = [B.title, '', B.totals(`${fmt0(total)} ${sym}`, `${fmt0(total * 12)} ${sym}`)];
  if (results.length > 1) lines.push(B.top(esc(top.name), `${fmt0(monthly(top))} ${sym}`));
  if (soon.length) {
    lines.push('', B.upcomingH);
    for (const s of soon) lines.push(B.line(esc(s.name), `${money(s.amount)} ${esc(curSym(d, s.currency, lang))}`, S.when(daysTo(d, s.next_date), subDay(s.next_date, lang))));
  }
  lines.push('', B.tapHint);
  const rows: Button[][] = results.slice(0, SUBS_SHOWN).map((s) => [
    {
      text: `${s.auto ? '' : '✋ '}${s.name} · ${money(s.amount)} ${curSym(d, s.currency, lang)}/${S.per[s.period]} · ${subDay(s.next_date, lang)}`,
      callback_data: `sb:${s.id}`,
    },
  ]);
  if (results.length > SUBS_SHOWN) rows.push([appButton(d, B.more(results.length - SUBS_SHOWN), '/subs')]);
  rows.push([{ text: B.add, callback_data: 'sb:new' }], [appButton(d, B.openSite, '/subs')], back(lang));
  return { text: lines.join('\n'), kb: { inline_keyboard: rows } };
}

/** Одна подписка: цена в месяц и в год в валюте человека, следующее списание, автозапись и удаление */
async function subCard(d: BotDeps, user: Linked, id: number): Promise<Screen | null> {
  const s = await d.db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?').bind(id, user.id).first<Sub>();
  if (!s) return null;
  const lang = user.lang;
  const S = subsText(lang);
  const B = S.bot;
  const sym = esc(symOf(d, user));
  const m = convert(perMonth(s), s.currency, user.currency);
  // «399 ₽ в месяц · ≈ 4 788 ₽ в год», «20 $ в месяц ≈ 1 640 ₽ · ≈ 19 680 ₽ в год», «1 490 ₽ в год ≈ 124 ₽ в месяц»
  let amountLine = `${money(s.amount)} ${esc(curSym(d, s.currency, lang))} ${B.per[s.period]}`;
  if (s.period !== 'month') amountLine += ` ≈ ${fmt0(m)} ${sym} ${B.per.month}`;
  else if (s.currency !== user.currency) amountLine += ` ≈ ${fmt0(m)} ${sym}`;
  if (s.period !== 'year') amountLine += ` · ≈ ${fmt0(m * 12)} ${sym} ${B.per.year}`;
  return {
    text: B.card({
      name: esc(s.name),
      amountLine,
      next: subDay(s.next_date, lang),
      when: B.inDays(daysTo(d, s.next_date)),
      category: `${emoji(s.category)} ${esc(categoryLabel(s.category, lang))}`,
      auto: !!s.auto,
    }),
    kb: {
      inline_keyboard: [
        [{ text: s.auto ? B.autoOffBtn : B.autoOnBtn, callback_data: `sb:a:${s.id}` }],
        [{ text: B.delBtn, callback_data: `sb:d:${s.id}` }],
        [appButton(d, B.editSite, '/subs')],
        back(lang, 'm:sub', B.toList),
      ],
    },
  };
}

/** «Добавить подписку»: популярные сервисы и своя */
function subPickScreen(user: Linked): Screen {
  const B = subsText(user.lang).bot;
  const buttons = SUB_PRESETS[user.lang].map((p, i) => ({ text: p.name, callback_data: `sb:p:${i}` }));
  return { text: B.pickTitle, kb: { inline_keyboard: [...grid(buttons), [{ text: B.custom, callback_data: 'sb:c' }], back(user.lang, 'm:sub')] } };
}

/** Ждём сумму и число: для выбранного сервиса или для своей подписки ('*') */
function subPromptScreen(d: BotDeps, user: Linked, name: string): Screen {
  const B = subsText(user.lang).bot;
  const sym = esc(symOf(d, user));
  return {
    text: name === '*' ? B.promptCustom(sym) : B.promptPreset(esc(name), sym),
    kb: { inline_keyboard: [back(user.lang, 'sb:x', botText(user.lang).b.cancel)] },
  };
}

/** Сообщение после выбора сервиса: «399 15», «Бассейн 3000 5», «ChatGPT $20 3 числа» */
async function addSubFromText(d: BotDeps, user: Linked, chatId: number, text: string) {
  const lang = user.lang;
  const B = subsText(lang).bot;
  const cancel = { inline_keyboard: [back(lang, 'sb:x', botText(lang).b.cancel)] };
  const p = parseSubInput(text);
  const presetName = user.pending_sub === '*' ? null : user.pending_sub;
  const name = (presetName ?? p.name).slice(0, 60);
  if (!p.amount || p.amount <= 0 || p.amount > 1e9) return send(d, chatId, B.needAmount, cancel);
  if (!name) return send(d, chatId, B.needName, cancel);
  const preset = Object.values(SUB_PRESETS).flat().find((x) => x.name.toLowerCase() === name.toLowerCase());
  const currency = p.currency && p.currency in d.currencies ? p.currency : user.currency;
  const { next, anchor } = firstCharge(p.day, d.today, p.period);
  const id = await insertSub(d.db, user.id, { name, amount: p.amount, currency, period: p.period, next, anchor, category: preset?.category ?? parseExpense(name, null, CATEGORY_RULES).category ?? 'Развлечения', auto: 1 });
  await setPendingSub(d, user, null);
  if (id === null) return send(d, chatId, B.tooMany);
  const charged = await chargeDue(d.db, d.today, user.id); // число — сегодня: списание записываем сразу
  const row = await d.db.prepare('SELECT next_date FROM subscriptions WHERE id = ?').bind(id).first<{ next_date: string }>();
  return send(d, chatId, B.added(esc(name), `${money(p.amount)} ${esc(curSym(d, currency, lang))} ${B.per[p.period]}`, subDay(row?.next_date ?? next, lang), charged.length > 0), {
    inline_keyboard: [[{ text: `🔁 ${name}`, callback_data: `sb:${id}` }], [{ text: B.add, callback_data: 'sb:new' }], back(lang, 'm:sub', B.toList)],
  });
}

function settingsScreen(d: BotDeps, user: Linked): Screen {
  const T = botText(user.lang);
  const code = user.currency in d.currencies ? user.currency : 'RUB';
  const cur = d.currencies[code];
  return {
    text: T.settings({
      name: user.username,
      sym: currencySymbol(code, user.lang, cur.symbol),
      curLabel: `${currencySymbol(code, user.lang, cur.symbol)} ${currencyLabel(code, user.lang, cur.label)}`,
      notify: !!user.notify,
      langName: LANG_LABEL[user.lang],
    }),
    kb: {
      inline_keyboard: [
        [{ text: user.notify ? T.b.notifyOn : T.b.notifyOff, callback_data: 'ntf' }],
        [
          { text: T.b.currency, callback_data: 'm:cur' },
          { text: T.b.language, callback_data: 'm:lang' },
        ],
        [{ text: T.b.unlink, callback_data: 'm:unl' }],
        [appButton(d, T.b.allSettings, '/settings')],
        back(user.lang),
      ],
    },
  };
}

function currencyScreen(d: BotDeps, user: Linked): Screen {
  const T = botText(user.lang);
  const buttons = Object.entries(d.currencies).map(([code, c]) => ({
    text: `${code === user.currency ? '✓ ' : ''}${currencySymbol(code, user.lang, c.symbol)} · ${code}`,
    callback_data: `cur:${code}`,
  }));
  return { text: T.currencyScreen, kb: { inline_keyboard: [...grid(buttons), back(user.lang, 'm:set')] } };
}

// Выбор языка: один на бота и на сайт (users.lang)
function languageScreen(user: Linked): Screen {
  const buttons = LANGS.map((code) => ({ text: `${code === user.lang ? '✓ ' : ''}${LANG_BTN[code]}`, callback_data: `lang:${code}` }));
  return { text: botText(user.lang).languageScreen, kb: { inline_keyboard: [buttons, back(user.lang, 'm:set')] } };
}

function unlinkScreen(user: Linked): Screen {
  const T = botText(user.lang);
  return {
    text: T.unlink(user.username),
    kb: {
      inline_keyboard: [
        [
          { text: T.b.yesUnlink, callback_data: 'unl!' },
          { text: T.b.no, callback_data: 'm:set' },
        ],
      ],
    },
  };
}

function screen(d: BotDeps, user: Linked, route: string): Promise<Screen> | Screen {
  const [name, arg] = route.split(':');
  const period = (['day', 'week', 'month'].includes(arg) ? arg : 'month') as Period;
  switch (name) {
    case 'add':
      return addScreen(d, user);
    case 'st':
      return statsScreen(d, user, period);
    case 'ls':
      return listScreen(d, user, Math.max(0, Number(arg) || 0));
    case 'fr':
      return friendsScreen(d, user, period);
    case 'sub':
      return subsScreen(d, user);
    case 'set':
      return settingsScreen(d, user);
    case 'cur':
      return currencyScreen(d, user);
    case 'lang':
      return languageScreen(user);
    case 'unl':
      return unlinkScreen(user);
    case 'help':
      return { text: botText(user.lang).help, kb: { inline_keyboard: [back(user.lang)] } };
    default:
      return homeScreen(d, user);
  }
}

async function sendScreen(d: BotDeps, chatId: number, s: Screen | Promise<Screen>) {
  const { text, kb } = await s;
  return send(d, chatId, text, kb);
}

// ---------- сообщения ----------

export async function handleUpdate(d: BotDeps, u: TgUpdate) {
  if (u.callback_query) return onCallback(d, u.callback_query);
  if (u.inline_query) return onInlineQuery(d, u.inline_query);
  if (u.chosen_inline_result) return onChosenInline(d, u.chosen_inline_result);
  if (u.guest_message) return onGuestMessage(d, u.guest_message);
  const msg = u.message;
  if (!msg || msg.chat.type !== 'private') return;
  const chatId = msg.chat.id;
  const text = (msg.text ?? '').trim();
  const tgLang = langFromTg(msg.from?.language_code); // язык Telegram: пока аккаунта нет, говорим на нём

  const start = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{8,64})$/);
  if (start) return link(d, msg, start[1]);
  // Метка источника из ссылки t.me/<бот>?start=ig (короче 8 символов, чтобы не спутать с кодом привязки)
  const source = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_]{1,7})$/)?.[1];
  if (source) await d.db.prepare('INSERT OR IGNORE INTO tg_sources (chat_id, source) VALUES (?, ?)').bind(chatId, source.toLowerCase()).run();
  // Свой Telegram ID может узнать любой — он нужен владельцу, чтобы включить админ-панель
  if (/^\/myid(@\w+)?$/.test(text)) return send(d, chatId, botText(tgLang).myId(msg.from?.id ?? chatId));
  // Админ-панель — только владельцу; для остальных команды /admin как будто нет
  if (/^\/admin(@\w+)?$/.test(text) && isAdmin(d, msg.from?.id)) return sendScreen(d, chatId, adminScreen(d, 'main'));

  const user = await linkedUser(d, chatId);
  if (!user) {
    const T = botText(tgLang);
    return send(d, chatId, T.welcome, {
      inline_keyboard: [
        [{ text: T.b.start, url: `${d.siteUrl}/auth/telegram` }],
        [{ text: T.b.haveAccount, url: `${d.siteUrl}/profile` }],
      ],
    });
  }

  const T = botText(user.lang);
  const cmd = text.match(/^\/(\w+)/)?.[1];
  // Любая команда отменяет ожидание суммы для подписки
  if (cmd && user.pending_sub) await setPendingSub(d, user, null);
  if (cmd === 'start' || cmd === 'menu') return sendScreen(d, chatId, homeScreen(d, user));
  if (cmd === 'subs') return sendScreen(d, chatId, subsScreen(d, user));
  if (cmd === 'help') return sendScreen(d, chatId, screen(d, user, 'help'));
  if (cmd === 'stats') return sendScreen(d, chatId, screen(d, user, 'st:month'));
  if (cmd === 'last') return sendScreen(d, chatId, screen(d, user, 'ls:0'));
  if (cmd === 'undo') return undo(d, user, chatId);
  if (cmd === 'lang' || cmd === 'language') return sendScreen(d, chatId, languageScreen(user));
  if (cmd === 'stickers') return stickerPack(d, chatId, msg.from?.id ?? chatId, user.lang);
  if (cmd === 'unlink') return sendScreen(d, chatId, unlinkScreen(user));
  if (cmd) return send(d, chatId, T.unknownCmd);
  if (msg.voice) return addFromVoice(d, user, chatId, msg.voice);
  if (msg.photo) return addFromPhoto(d, user, chatId, msg.photo, (msg.caption ?? '').trim());
  if (!text) return send(d, chatId, T.sayExpense);
  return addFromText(d, user, chatId, text);
}

async function link(d: BotDeps, msg: TgMessage, code: string) {
  const chatId = msg.chat.id;
  const row = await d.db
    .prepare("SELECT user_id FROM telegram_codes WHERE code = ? AND created_at > datetime('now', '-30 minutes')")
    .bind(code)
    .first<{ user_id: number }>();
  if (!row) {
    const T = botText(langFromTg(msg.from?.language_code));
    return send(d, chatId, T.linkExpired, { inline_keyboard: [[{ text: T.b.openProfile, url: `${d.siteUrl}/profile` }]] });
  }
  await d.db.batch([
    d.db.prepare('DELETE FROM telegram_links WHERE chat_id = ? OR user_id = ?').bind(chatId, row.user_id),
    d.db.prepare('INSERT INTO telegram_links (user_id, chat_id, tg_username) VALUES (?, ?, ?)').bind(row.user_id, chatId, msg.from?.username ?? null),
    d.db.prepare('DELETE FROM telegram_codes WHERE user_id = ?').bind(row.user_id),
  ]);
  const user = await linkedUser(d, chatId);
  if (!user) return;
  await send(d, chatId, botText(user.lang).linkDone(user.username));
  return sendScreen(d, chatId, homeScreen(d, user));
}

async function addFromVoice(d: BotDeps, user: Linked, chatId: number, voice: { file_id: string; duration: number }) {
  const T = botText(user.lang);
  if (!d.transcribe) return send(d, chatId, T.voice.off);
  if (voice.duration > 60) return send(d, chatId, T.voice.tooLong);
  // Распознавание тратит Workers AI: не больше 100 голосовых в сутки на человека и общий потолок на сайт
  if (!(await hit(d.db, `voice:${user.id}`, 100, 86400)) || !(await aiDayAllowed(d.db))) {
    return send(d, chatId, T.voice.quota);
  }
  await tg(d.api, 'sendChatAction', { chat_id: chatId, action: 'typing' });
  let text = '';
  try {
    const path = (await tg(d.api, 'getFile', { file_id: voice.file_id })).result?.file_path;
    const audio = path ? await fetch(`${d.file}/${path}`) : null;
    if (audio?.ok) text = (await d.transcribe(await audio.arrayBuffer(), user.lang)).trim();
  } catch (e) {
    console.error('voice transcription failed', e);
  }
  if (!text) return send(d, chatId, T.voice.fail);
  await send(d, chatId, `🎙 <i>${esc(text)}</i>`);
  return addFromText(d, user, chatId, text);
}

async function addFromText(d: BotDeps, user: Linked, chatId: number, text: string) {
  // Выбран сервис в «Добавить подписку» — сообщение (или голосовое) про подписку, а не про трату
  if (user.pending_sub) return addSubFromText(d, user, chatId, text);
  // Каждая строка или фраза — отдельная трата. Кусок без суммы («Кофе.» из «Кофе. 250 рублей.»)
  // приклеиваем к следующему: так распознавание речи нередко расставляет точки.
  const parts = text.split(/\n|(?<=[.!?;])\s+/).map((l) => l.trim()).filter(Boolean).slice(0, 20);
  const parsed: ParsedExpense[] = [];
  let pending = '';
  for (const part of parts) {
    const chunk = pending ? `${pending} ${part}` : part;
    const p = parseExpense(chunk, d.today, CATEGORY_RULES);
    if (validAmount(p)) {
      parsed.push(p);
      pending = '';
    } else {
      pending = chunk.replace(/[.!?;]+$/, '');
    }
  }
  parsed.splice(10);
  if (!parsed.length) return send(d, chatId, botText(user.lang).noAmount);
  return addParsed(d, user, chatId, parsed);
}

async function addParsed(d: BotDeps, user: Linked, chatId: number, parsed: ParsedExpense[]) {
  // Категория, выбранная в меню «Добавить», важнее угаданной
  if (user.pending_category) {
    for (const p of parsed) p.category = user.pending_category;
    await setPending(d, user, null);
  }
  for (const p of parsed) {
    const e = await insertExpense(d, user, p);
    await send(d, chatId, `${card(d, e, symOf(d, user), user.lang)}\n\n<i>${esc(await quipFor(d, user, e))}</i>`, expenseKeyboard(e.id, user.lang));
  }
}

// Фото товара или чека: ИИ называет покупку и читает сумму (итог чека или ценник); подпись к фото может задать сумму или всё сразу
async function addFromPhoto(d: BotDeps, user: Linked, chatId: number, photos: { file_id: string; width: number }[], caption: string) {
  const T = botText(user.lang);
  const typed = parseExpense(caption, d.today, CATEGORY_RULES);
  if (validAmount(typed) && typed.note) return addFromText(d, user, chatId, caption); // в подписи уже всё есть, ИИ не нужен
  const hint = T.photo.hint;
  if (!d.readPhoto) return send(d, chatId, `${T.photo.off} ${hint}`);
  if (!(await takeAiQuota(d.db, user.id))) return send(d, chatId, `${T.photo.quota} ${hint}`);
  await tg(d.api, 'sendChatAction', { chat_id: chatId, action: 'typing' });
  let guess: Guess | null = null;
  try {
    const photo = photos.find((p) => p.width >= 800) ?? photos[photos.length - 1];
    const path = (await tg(d.api, 'getFile', { file_id: photo.file_id })).result?.file_path;
    const img = path ? await fetch(`${d.file}/${path}`) : null;
    if (img?.ok) guess = await d.readPhoto(new Uint8Array(await img.arrayBuffer()), user.lang);
  } catch (e) {
    console.error('photo recognition failed', e);
  }
  if (!guess) return send(d, chatId, `${T.photo.unknown} ${hint}`);
  const amount = typed.amount ?? guess.amount;
  if (!amount) return send(d, chatId, T.photo.noPrice(guess.name));
  return addParsed(d, user, chatId, [{ amount, category: guess.category, note: typed.note || guess.name, date: null }]);
}

// ---------- стикерпаки Трэка ----------

type StickerSet = { stickers: { file_id: string }[] };

interface Pack {
  name: string;
  title: string;
  // Как передать стикер i в Telegram: обычные — ссылкой на картинку, видео — только загрузкой файла
  input(i: number): Promise<{ sticker: string; format: string; emoji_list: string[] } | null>;
}

async function tgForm<T>(api: string, method: string, form: FormData) {
  const res = await fetch(`${api}/${method}`, { method: 'POST', body: form });
  return (await res.json()) as { ok: boolean; result?: T; description?: string };
}

/** Картинка в чат с ботом (сайт присылает «Мой месяц», чтобы её было легко переслать или выложить в сторис) */
export async function sendPhoto(api: string, chatId: number, photo: Blob, caption: string) {
  const form = new FormData();
  form.set('chat_id', String(chatId));
  form.set('photo', photo, 'month.jpg');
  form.set('caption', caption);
  form.set('parse_mode', 'HTML');
  return tgForm(api, 'sendPhoto', form);
}

function packs(d: BotDeps, bot: string, tgUserId: number): Pack[] {
  return [
    {
      name: `trek_by_${bot}`,
      title: 'Трэк · СпендТрекер',
      input: async (i) => ({ sticker: `${d.siteUrl}${stickerFile(i)}`, format: 'static', emoji_list: STICKERS[i].emoji }),
    },
    {
      name: `trek_anim_by_${bot}`,
      title: 'Трэк · анимированные',
      input: async (i) => {
        const file = await d.asset(animStickerFile(i));
        if (!file) return null;
        const form = new FormData();
        form.set('user_id', String(tgUserId));
        form.set('sticker_format', 'video');
        form.set('sticker', file, `trek${i + 1}.webm`);
        const up = await tgForm<{ file_id: string }>(d.api, 'uploadStickerFile', form);
        return up.ok && up.result ? { sticker: up.result.file_id, format: 'video', emoji_list: STICKERS[i].emoji } : null;
      },
    },
  ];
}

/**
 * Выпускает набор (или дописывает в него новые стикеры из списка). Владелец набора — тот, кто первым
 * попросил. Возвращает набор или null, если Telegram отказал.
 */
async function ensurePack(d: BotDeps, p: Pack, tgUserId: number): Promise<StickerSet | null> {
  const set = await tg<StickerSet>(d.api, 'getStickerSet', { name: p.name });
  const have = set.ok ? (set.result?.stickers.length ?? 0) : 0;
  if (set.ok && have >= STICKERS.length) return set.result ?? null;
  const inputs = [];
  for (let i = have; i < STICKERS.length; i++) {
    const input = await p.input(i);
    if (!input) break;
    inputs.push(input);
  }
  if (!set.ok) {
    if (!inputs.length) return null;
    const created = await tg(d.api, 'createNewStickerSet', { user_id: tgUserId, name: p.name, title: p.title, stickers: inputs });
    if (!created.ok) {
      console.error('createNewStickerSet failed', p.name, created.description);
      return null;
    }
  } else {
    // В список добавили новые стикеры — дописываем их (получится только у владельца набора)
    for (const sticker of inputs) {
      if (!(await tg(d.api, 'addStickerToSet', { user_id: tgUserId, name: p.name, sticker })).ok) break;
    }
  }
  return (await tg<StickerSet>(d.api, 'getStickerSet', { name: p.name })).result ?? null;
}

async function stickerPack(d: BotDeps, chatId: number, tgUserId: number, lang: Lang) {
  const T = botText(lang);
  const bot = await botUsername(d.api);
  if (!bot || !d.siteUrl) return send(d, chatId, T.stickersFail);
  await tg(d.api, 'sendChatAction', { chat_id: chatId, action: 'choose_sticker' });
  const [still, anim] = packs(d, bot, tgUserId);
  const stillSet = await ensurePack(d, still, tgUserId);
  const animSet = await ensurePack(d, anim, tgUserId);
  if (!stillSet && !animSet) return send(d, chatId, T.stickersFail2);
  const first = animSet?.stickers[0]?.file_id ?? stillSet?.stickers[0]?.file_id;
  if (first) await tg(d.api, 'sendSticker', { chat_id: chatId, sticker: first });
  const buttons: Button[] = [];
  if (stillSet) buttons.push({ text: T.b.plain, url: `https://t.me/addstickers/${still.name}` });
  if (animSet) buttons.push({ text: T.b.anim, url: `https://t.me/addstickers/${anim.name}` });
  return send(d, chatId, T.stickersMsg(STICKERS.length, !!animSet), { inline_keyboard: [buttons] });
}

/** Реплика Трэка: собирает, что было сегодня и в этом месяце, и отдаёт в quip() */
async function quipFor(d: BotDeps, user: Linked, e: ExpenseRow) {
  const [day, o] = await Promise.all([
    d.db
      .prepare(
        `SELECT COUNT(*) AS n,
                SUM(CASE WHEN note LIKE '%кофе%' OR note LIKE '%Кофе%' OR note LIKE '%coffee%' THEN 1 ELSE 0 END) AS coffee,
                (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = ?1 AND category = 'Табак' AND expense_date >= ?3) AS tobacco
         FROM expenses WHERE user_id = ?1 AND expense_date = ?2`,
      )
      .bind(user.id, d.today, d.since.month)
      .first<{ n: number; coffee: number | null; tobacco: number }>(),
    d.overview(user.id),
  ]);
  const dayOfMonth = Number(d.today.slice(8, 10));
  return quip({
    category: e.category,
    note: e.note,
    amount: e.amount,
    sym: symOf(d, user),
    hourMsk: (new Date().getUTCHours() + 3) % 24,
    todayCount: day?.n ?? 1,
    coffeeToday: day?.coffee ?? 0,
    tobaccoMonth: day?.tobacco ?? 0,
    usualDay: dayOfMonth > 1 ? (o.monthTotal - o.todayTotal) / (dayOfMonth - 1) : 0,
  }, user.lang);
}

const validAmount = (p: ParsedExpense) => !!p.amount && p.amount > 0 && p.amount < 1e9;

function toExpense(d: BotDeps, p: ParsedExpense): ExpenseRow {
  return {
    id: 0,
    amount: p.amount as number,
    category: p.category && d.categories.includes(p.category) ? p.category : 'Прочее',
    note: p.note || null,
    expense_date: p.date ?? d.today,
  };
}

async function insertExpense(d: BotDeps, user: Linked, p: ParsedExpense) {
  const e = toExpense(d, p);
  const ins = await d.db
    .prepare('INSERT INTO expenses (user_id, amount, category, note, expense_date) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .bind(user.id, e.amount, e.category, e.note, e.expense_date)
    .first<{ id: number }>();
  e.id = ins?.id ?? 0;
  return e;
}

async function undo(d: BotDeps, user: Linked, chatId: number) {
  const e = await d.db
    .prepare('DELETE FROM expenses WHERE id = (SELECT MAX(id) FROM expenses WHERE user_id = ?1) AND user_id = ?1 RETURNING amount, note, category')
    .bind(user.id)
    .first<{ amount: number; note: string | null; category: string }>();
  const T = botText(user.lang);
  if (!e) return send(d, chatId, T.undoNone);
  return send(d, chatId, T.undone(`${fmt0(e.amount)} ${esc(symOf(d, user))}`, e.note || categoryLabel(e.category, user.lang)));
}

// ---------- инлайн-режим: «@бот сигареты 250» в любом чате ----------

async function onInlineQuery(d: BotDeps, q: TgInlineQuery) {
  const answer = (results: unknown[], button?: { text: string; start_parameter: string }) =>
    tg(d.api, 'answerInlineQuery', { inline_query_id: q.id, results, cache_time: 0, is_personal: true, ...(button ? { button } : {}) });
  const user = await linkedUser(d, q.from.id);
  const lang = user?.lang ?? langFromTg(q.from.language_code);
  const T = botText(lang);
  // start_parameter короче 8 символов, поэтому /start не примет его за код привязки
  if (!user) return answer([], { text: T.inline.connect, start_parameter: 'connect' });
  const p = parseExpense(q.query, d.today, CATEGORY_RULES);
  if (!validAmount(p)) return answer([], { text: T.inline.needAmount, start_parameter: 'help' });

  const e = toExpense(d, p);
  const sym = symOf(d, user);
  const catName = categoryLabel(e.category, lang);
  // Сообщение уходит в чат сразу, а трата записывается, когда Telegram пришлёт chosen_inline_result.
  // Кнопка нужна, чтобы Telegram дал inline_message_id и сообщение можно было поправить на «✅».
  return answer([
    {
      type: 'article',
      id: 'add',
      title: T.inline.title(`${fmt0(e.amount)} ${sym}`),
      description: `${emoji(e.category)} ${e.note || catName} · ${catName} · ${dayLabel(e.expense_date, d.today, lang)}`,
      input_message_content: {
        message_text: `⏳ <b>${fmt0(e.amount)} ${esc(sym)}</b>${e.note ? ` · ${esc(e.note)}` : ''}`,
        parse_mode: 'HTML',
      },
      reply_markup: { inline_keyboard: [[{ text: T.b.saving, callback_data: 'w' }]] },
    },
  ]);
}

// ---------- гостевой режим: «@бот сигареты 250» прямо в переписке, бот отвечает «Бот для тебя» ----------

async function onGuestMessage(d: BotDeps, msg: TgMessage) {
  if (!msg.guest_query_id) return;
  const caller = msg.guest_bot_caller_user ?? msg.from;
  const user = caller ? await linkedUser(d, caller.id) : null;
  const lang = user?.lang ?? langFromTg(caller?.language_code);
  const T = botText(lang);
  const reply = (text: string, kb?: Keyboard) =>
    tg(d.api, 'answerGuestQuery', {
      guest_query_id: msg.guest_query_id,
      result: {
        type: 'article',
        id: 'guest',
        title: tr(lang).brand,
        input_message_content: { message_text: text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
        ...(kb ? { reply_markup: kb } : {}),
      },
    });
  const promo = await promoUrl(d);
  if (!user) return reply(T.guest.start, promo ? { inline_keyboard: [[{ text: T.b.start, url: promo }]] } : undefined);
  // Убираем упоминания вида @бот, остальное — трата
  const text = (msg.text ?? '').replace(/@\w+/g, ' ').trim();
  const p = parseExpense(text, d.today, CATEGORY_RULES);
  if (!validAmount(p)) return reply(T.guest.noAmount);
  const e = await insertExpense(d, user, p);
  return reply(card(d, e, symOf(d, user), lang), expenseKeyboard(e.id, lang, undefined, promo));
}

async function onChosenInline(d: BotDeps, r: TgChosenInline) {
  const user = await linkedUser(d, r.from.id);
  if (!user) return;
  const p = parseExpense(r.query, d.today, CATEGORY_RULES);
  if (!validAmount(p)) return;
  const e = await insertExpense(d, user, p);
  if (r.inline_message_id) {
    await tg(d.api, 'editMessageText', {
      inline_message_id: r.inline_message_id,
      text: card(d, e, symOf(d, user), user.lang),
      parse_mode: 'HTML',
      reply_markup: expenseKeyboard(e.id, user.lang, undefined, await promoUrl(d)),
    });
  }
}

// ---------- кнопки ----------

async function onCallback(d: BotDeps, q: TgCallback) {
  const answer = (text?: string) => tg(d.api, 'answerCallbackQuery', { callback_query_id: q.id, ...(text ? { text } : {}) });
  const data = q.data ?? '';
  const tgT = botText(langFromTg(q.from.language_code)); // пока не знаем аккаунт — язык Telegram
  if (data === 'w') return answer(tgT.toast.saving);
  if (data === 'n') return answer();
  const msg = q.message;
  const edit = msg ? { chat_id: msg.chat.id, message_id: msg.message_id } : q.inline_message_id ? { inline_message_id: q.inline_message_id } : null;
  if (!edit) return answer();
  const show = async (s: Screen | Promise<Screen>) => {
    const { text, kb } = await s;
    await tg(d.api, 'editMessageText', { ...edit, text, parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
  };
  if (data === 'adm' || data === 'adm:new') {
    if (!isAdmin(d, q.from.id)) return answer();
    await show(adminScreen(d, data === 'adm' ? 'main' : 'new'));
    return answer('Обновлено');
  }
  // Кнопки под сообщением в общем чате видит и собеседник, поэтому всё ищем у того, кто нажал
  const user = await linkedUser(d, q.from.id);
  if (!user) return answer(msg ? tgT.toast.notLinked : tgT.toast.notYours);
  const lang = user.lang;
  const T = botText(lang);

  if (data.startsWith('m:')) {
    // Ушли из «Добавить подписку» в меню — следующее сообщение снова трата, а не подписка
    if (user.pending_sub) await setPendingSub(d, user, null);
    await show(screen(d, user, data.slice(2)));
    return answer();
  }
  // Подписки: sb:new — выбор сервиса, sb:p:<i> — сервис из списка, sb:c — своя, sb:x — отмена,
  // sb:<id> — карточка, sb:a:<id> — автозапись вкл/выкл, sb:d:<id> — спросить про удаление, sb:D:<id> — удалить
  if (data.startsWith('sb:')) {
    const B = subsText(lang).bot;
    const [, op, arg] = data.split(':');
    if (op === 'new') {
      await show(subPickScreen(user));
      return answer();
    }
    if (op === 'p' || op === 'c') {
      const name = op === 'c' ? '*' : SUB_PRESETS[lang][Number(arg)]?.name;
      if (!name) return answer();
      await setPendingSub(d, user, name);
      await show(subPromptScreen(d, user, name));
      return answer(name === '*' ? undefined : `🔁 ${name}`);
    }
    if (op === 'x') {
      await setPendingSub(d, user, null);
      await show(subsScreen(d, user));
      return answer();
    }
    const id = Number(op === 'a' || op === 'd' || op === 'D' ? arg : op);
    if (!Number.isInteger(id) || id <= 0) return answer();
    if (op === 'D') {
      const res = await d.db.prepare('DELETE FROM subscriptions WHERE id = ? AND user_id = ?').bind(id, user.id).run();
      await show(subsScreen(d, user));
      return answer(res.meta.changes ? B.toastDeleted : B.toastGone);
    }
    if (op === 'd') {
      const row = await d.db.prepare('SELECT name FROM subscriptions WHERE id = ? AND user_id = ?').bind(id, user.id).first<{ name: string }>();
      if (!row) {
        await show(subsScreen(d, user));
        return answer(B.toastGone);
      }
      await show({ text: B.delQ(esc(row.name)), kb: { inline_keyboard: [[{ text: B.yesDel, callback_data: `sb:D:${id}` }, { text: T.b.no, callback_data: `sb:${id}` }]] } });
      return answer();
    }
    const toggled =
      op === 'a'
        ? await d.db.prepare('UPDATE subscriptions SET auto = 1 - auto WHERE id = ? AND user_id = ? RETURNING auto').bind(id, user.id).first<{ auto: number }>()
        : null;
    const card = await subCard(d, user, id);
    if (!card) {
      await show(subsScreen(d, user));
      return answer(B.toastGone);
    }
    await show(card);
    return answer(toggled ? (toggled.auto ? B.toastAutoOn : B.toastAutoOff) : undefined);
  }

  if (data.startsWith('pc:')) {
    const cat = d.categories[Number(data.slice(3))];
    await setPending(d, user, cat ?? null);
    await show(cat ? pendingScreen(cat, lang) : homeScreen(d, user));
    return answer(cat ? `${emoji(cat)} ${categoryLabel(cat, lang)}` : undefined);
  }
  if (data.startsWith('cur:')) {
    const code = data.slice(4);
    if (!d.currencies[code]) return answer();
    await d.db.prepare('UPDATE users SET currency = ? WHERE id = ?').bind(code, user.id).run();
    await show(settingsScreen(d, { ...user, currency: code }));
    return answer(T.toast.currency(currencySymbol(code, lang, d.currencies[code].symbol)));
  }
  if (data === 'stk') {
    await answer(T.toast.stickers);
    if (msg) await stickerPack(d, msg.chat.id, q.from.id, lang);
    return;
  }
  // Язык один на бота и на сайт: пишем в users.lang
  if (data.startsWith('lang:')) {
    const code = data.slice(5);
    if (!(LANGS as string[]).includes(code)) return answer();
    await d.db.prepare('UPDATE users SET lang = ? WHERE id = ?').bind(code, user.id).run();
    const next = { ...user, lang: code as Lang };
    await show(settingsScreen(d, next));
    return answer(botText(next.lang).toast.lang(LANG_LABEL[next.lang]));
  }
  if (data === 'ntf') {
    const notify = user.notify ? 0 : 1;
    await d.db.prepare('UPDATE telegram_links SET notify = ? WHERE user_id = ?').bind(notify, user.id).run();
    await show(settingsScreen(d, { ...user, notify }));
    return answer(notify ? T.toast.notifyOn : T.toast.notifyOff);
  }
  if (data === 'unl!') {
    await d.db.prepare('DELETE FROM telegram_links WHERE user_id = ?').bind(user.id).run();
    await tg(d.api, 'editMessageText', {
      ...edit,
      text: T.unlinked,
      reply_markup: { inline_keyboard: [[{ text: T.b.openProfile, url: `${d.siteUrl}/profile` }]] },
    });
    return answer(T.toast.disconnected);
  }

  // Трата: e — открыть из списка, c — выбор категории, s — сохранить категорию, b — назад, d — удалить
  const m = data.match(/^([ecdsb]):(\d+)(?::(\d+))?(?::p(\d+))?$/);
  if (!m) return answer();
  const id = Number(m[2]);
  const page = m[4] === undefined ? undefined : Number(m[4]);
  const e = await d.db
    .prepare('SELECT id, amount, category, note, expense_date FROM expenses WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<ExpenseRow>();
  if (!e) return answer(T.toast.gone);
  const sym = symOf(d, user);
  const promo = msg ? undefined : await promoUrl(d); // нет msg — кнопку нажали под сообщением в чужом чате

  if (m[1] === 'e') {
    await show({ text: card(d, e, sym, lang), kb: expenseKeyboard(id, lang, page, promo) });
    return answer();
  }
  if (m[1] === 'c') {
    await tg(d.api, 'editMessageReplyMarkup', { ...edit, reply_markup: categoryKeyboard(d, id, lang, page) });
    return answer();
  }
  if (m[1] === 'b') {
    await tg(d.api, 'editMessageReplyMarkup', { ...edit, reply_markup: expenseKeyboard(id, lang, page, promo) });
    return answer();
  }
  if (m[1] === 's') {
    const cat = d.categories[Number(m[3])];
    if (!cat) return answer();
    await d.db.prepare('UPDATE expenses SET category = ? WHERE id = ? AND user_id = ?').bind(cat, id, user.id).run();
    await show({ text: card(d, { ...e, category: cat }, sym, lang), kb: expenseKeyboard(id, lang, page, promo) });
    return answer(`${emoji(cat)} ${categoryLabel(cat, lang)}`);
  }
  // d — удалить
  await d.db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  await show({
    text: T.deletedNote(`${fmt0(e.amount)} ${esc(sym)}${e.note ? ` · ${esc(e.note)}` : ''}`),
    kb: { inline_keyboard: page !== undefined ? [back(lang, `m:ls:${page}`, T.b.toList)] : promo ? [[{ text: T.b.promo, url: promo }]] : [] },
  });
  return answer(T.toast.deleted);
}

// ---------- итоги от Трэка: по расписанию (cron в wrangler.jsonc) ----------

const shiftDay = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);

interface Subscriber {
  chat_id: number;
  id: number;
  currency: string;
  lang: string;
}

function subscribers(d: BotDeps) {
  return d.db
    .prepare('SELECT t.chat_id, u.id, u.currency, u.lang FROM telegram_links t JOIN users u ON u.id = t.user_id WHERE t.notify = 1')
    .all<Subscriber>()
    .then((r) => r.results);
}

/** Сумма, число трат и главная категория за даты from..to включительно */
async function periodSummary(d: BotDeps, userId: number, from: string, to: string) {
  const [sum, top] = await d.db.batch([
    d.db
      .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ?')
      .bind(userId, from, to),
    d.db
      .prepare(
        `SELECT category, SUM(amount) AS total FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ?
         GROUP BY category ORDER BY total DESC LIMIT 1`,
      )
      .bind(userId, from, to),
  ]);
  const s = sum.results[0] as { n: number; total: number };
  return { count: s.n, total: s.total, top: (top.results[0] as { category: string; total: number } | undefined) ?? null };
}

const digestKeyboard = (stats: string, lang: Lang): Keyboard => {
  const T = botText(lang);
  return {
    inline_keyboard: [
      [
        { text: T.b.stats, callback_data: stats },
        { text: T.b.stopNotify, callback_data: 'ntf' },
      ],
    ],
  };
};

/** 21:00 по Москве: итоги дня всем, кто не выключил сообщения и вообще пользуется ботом */
export async function sendEveningDigests(d: BotDeps) {
  const dayOfMonth = Number(d.today.slice(8, 10));
  for (const u of await subscribers(d)) {
    try {
      const ever = await d.db.prepare('SELECT 1 FROM expenses WHERE user_id = ? LIMIT 1').bind(u.id).first();
      if (!ever) continue;
      const day = await periodSummary(d, u.id, d.today, d.today);
      const month = dayOfMonth > 1 ? await periodSummary(d, u.id, d.since.month, shiftDay(d.today, -1)) : null;
      const sym = esc(currencySymbol(u.currency in d.currencies ? u.currency : 'RUB', langOf(u.lang), d.currencies[u.currency in d.currencies ? u.currency : 'RUB'].symbol));
      const lang = langOf(u.lang);
      const text = eveningText({ sym, ...day, usualDay: month ? month.total / (dayOfMonth - 1) : 0 }, lang);
      await send(d, u.chat_id, text, digestKeyboard('m:st:day', lang));
    } catch (e) {
      console.error('evening digest failed', u.chat_id, e);
    }
  }
}

/** Понедельник утром: итоги прошлой недели в сравнении с позапрошлой */
export async function sendWeeklyDigests(d: BotDeps) {
  const start = shiftDay(d.since.week, -7);
  for (const u of await subscribers(d)) {
    try {
      const week = await periodSummary(d, u.id, start, shiftDay(d.since.week, -1));
      if (!week.count) continue;
      const prev = await periodSummary(d, u.id, shiftDay(start, -7), shiftDay(start, -1));
      const sym = esc(currencySymbol(u.currency in d.currencies ? u.currency : 'RUB', langOf(u.lang), d.currencies[u.currency in d.currencies ? u.currency : 'RUB'].symbol));
      const lang = langOf(u.lang);
      await send(d, u.chat_id, weeklyText({ sym, ...week, prevTotal: prev.total }, lang), digestKeyboard('m:st:week', lang));
    } catch (e) {
      console.error('weekly digest failed', u.chat_id, e);
    }
  }
}

/** Утро: что списалось сегодня по подпискам (уже записано в траты) и что спишется завтра — чтобы успеть отменить */
export async function sendSubReminders(d: BotDeps, charged: Charged[]) {
  const { results: soon } = await d.db
    .prepare('SELECT user_id, name, amount, currency FROM subscriptions WHERE next_date = ?')
    .bind(shiftDay(d.today, 1))
    .all<{ user_id: number; name: string; amount: number; currency: string }>();
  if (!charged.length && !soon.length) return;
  for (const u of await subscribers(d)) {
    const today = charged.filter((x) => x.user_id === u.id);
    const tomorrow = soon.filter((x) => x.user_id === u.id);
    if (!today.length && !tomorrow.length) continue;
    try {
      const lang = langOf(u.lang);
      const T = subsText(lang);
      const sym = (code: string) => esc(curSym(d, code, lang));
      // Если cron пропускал дни, одно и то же списание могло пройти несколько раз — показываем «×3»
      const lines = new Map<string, number>();
      for (const x of today) {
        const line = `• ${esc(x.name)} — ${money(x.amount)} ${sym(u.currency)}`;
        lines.set(line, (lines.get(line) ?? 0) + 1);
      }
      const parts = [
        lines.size ? T.bot.today([...lines].map(([line, n]) => (n > 1 ? `${line} ×${n}` : line))) : '',
        tomorrow.length ? T.bot.tomorrow(tomorrow.map((x) => `• ${esc(x.name)} — ${money(x.amount)} ${sym(x.currency)}`)) : '',
      ];
      await send(d, u.chat_id, parts.filter(Boolean).join('\n\n'));
    } catch (e) {
      console.error('subscription reminder failed', u.chat_id, e);
    }
  }
}

// ---------- админ-панель владельца ----------

const isAdmin = (d: BotDeps, tgId: number | undefined) => d.adminId !== null && tgId === d.adminId;

async function adminScreen(d: BotDeps, view: 'main' | 'new'): Promise<Screen> {
  const kb: Keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Обновить', callback_data: 'adm' },
        { text: '🆕 Новые пользователи', callback_data: 'adm:new' },
      ],
    ],
  };
  if (view === 'new') {
    const { results } = await d.db
      .prepare(
        `SELECT u.username, u.created_at, COUNT(e.id) AS n, MAX(t.user_id IS NOT NULL) AS tg
         FROM users u LEFT JOIN expenses e ON e.user_id = u.id LEFT JOIN telegram_links t ON t.user_id = u.id
         GROUP BY u.id ORDER BY u.created_at DESC, u.id DESC LIMIT 15`,
      )
      .all<{ username: string; created_at: string; n: number; tg: number }>();
    const rows = results.map(
      (u) => `• <b>${esc(u.username)}</b> — ${u.created_at.slice(8, 10)}.${u.created_at.slice(5, 7)} · ${u.n} ${plural(u.n, 'трата', 'траты', 'трат')}${u.tg ? ' · 🤖' : ''}`,
    );
    return {
      text: `🆕 <b>Последние регистрации</b>\n\n${rows.join('\n') || 'Пока никого.'}\n\n<i>🤖 — подключил Telegram-бота</i>`,
      kb: { inline_keyboard: [[{ text: '‹ К сводке', callback_data: 'adm' }]] },
    };
  }
  const s = await d.db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-1 day')) AS new_day,
        (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-7 days')) AS new_week,
        (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-30 days')) AS new_month,
        (SELECT COUNT(DISTINCT user_id) FROM expenses WHERE expense_date = ?1) AS active_day,
        (SELECT COUNT(DISTINCT user_id) FROM expenses WHERE expense_date >= ?2) AS active_week,
        (SELECT COUNT(*) FROM expenses) AS expenses,
        (SELECT COUNT(*) FROM expenses WHERE expense_date = ?1) AS expenses_day,
        (SELECT COUNT(*) FROM telegram_links) AS tg,
        (SELECT COUNT(*) FROM friendships WHERE status = 'accepted') AS friends`,
    )
    .bind(d.today, shiftDay(d.today, -6))
    .first<Record<string, number>>();
  const v = (k: string) => fmt0(s?.[k] ?? 0);
  const { results: sources } = await d.db
    .prepare(
      `SELECT s.source, COUNT(*) AS n, SUM(t.user_id IS NOT NULL) AS linked FROM tg_sources s
       LEFT JOIN telegram_links t ON t.chat_id = s.chat_id GROUP BY s.source ORDER BY n DESC LIMIT 8`,
    )
    .all<{ source: string; n: number; linked: number }>();
  const from = sources.map((r) => `${esc(r.source)} — <b>${fmt0(r.n)}</b>, с аккаунтом ${fmt0(r.linked)}`).join('\n');
  return {
    text: `🛠 <b>Админ-панель СпендТрекера</b>

👥 Пользователей — <b>${v('users')}</b>
Новых: за сутки <b>${v('new_day')}</b> · за неделю <b>${v('new_week')}</b> · за месяц <b>${v('new_month')}</b>

🔥 Активных (записали трату): сегодня <b>${v('active_day')}</b> · за 7 дней <b>${v('active_week')}</b>
🧾 Трат всего — <b>${v('expenses')}</b>, сегодня — <b>${v('expenses_day')}</b>
🤖 Подключили бота — <b>${v('tg')}</b>
👫 Пар друзей — <b>${v('friends')}</b>

📣 <b>Откуда пришли в бота</b> (метка из ссылки ?start=)
${from || 'Пока никто не пришёл по ссылке с меткой.'}

<i>Видно только тебе</i>`,
    kb,
  };
}

/** Утренняя сводка владельцу (cron) */
export async function sendAdminReport(d: BotDeps) {
  if (d.adminId === null) return;
  const { text, kb } = await adminScreen(d, 'main');
  await send(d, d.adminId, `☀️ Доброе утро! Сводка по сайту:\n\n${text}`, kb);
}

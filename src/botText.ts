// Тексты Telegram-бота на двух языках. Язык берётся из users.lang (его можно сменить и на сайте, и в настройках бота);
// пока аккаунта нет, смотрим на язык Telegram у человека (language_code).
// Админ-панель владельца остаётся только на русском и сюда не входит.

import { fmt0 } from './views';
import type { Lang } from './i18n';

export type Period = 'day' | 'week' | 'month';

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Telegram присылает language_code («ru», «en», «uk»…). Русскоязычным и соседним языкам отвечаем по-русски, остальным по-английски.
const RU_LIKE = new Set(['ru', 'uk', 'be', 'kk', 'ky', 'uz', 'tg', 'tk', 'hy', 'az', 'ka', 'mo']);
export const langFromTg = (code?: string): Lang => (!code || RU_LIKE.has(code.slice(0, 2).toLowerCase()) ? 'ru' : 'en');

export interface BotText {
  periods: [Period, string][];
  help: string;
  todayWord: string;
  yesterdayWord: string;
  b: Record<
    | 'back' | 'toList' | 'cancel' | 'category' | 'del' | 'promo' | 'openApp' | 'add' | 'stats' | 'mine' | 'friends' | 'settings' | 'help'
    | 'stickers' | 'charts' | 'monthCard' | 'addFriend' | 'allSettings' | 'currency' | 'language' | 'unlink' | 'yesUnlink' | 'start'
    | 'no' | 'haveAccount' | 'openProfile' | 'plain' | 'anim' | 'notifyOn' | 'notifyOff' | 'stopNotify' | 'saving',
    string
  >;
  toast: {
    saving: string;
    notLinked: string;
    notYours: string;
    currency(sym: string): string;
    notifyOn: string;
    notifyOff: string;
    disconnected: string;
    gone: string;
    deleted: string;
    stickers: string;
    lang(name: string): string;
  };
  home(name: string, sym: string, o: { todayTotal: number; weekTotal: number; monthTotal: number }, monthName: string): string;
  addScreen: string;
  pending(emoji: string, cat: string): string;
  periodTitle(p: Period, monthName: string): string;
  stats(title: string, sum: number, sym: string, rows: string[]): string;
  list(total: number): string;
  pageOf(page: number, pages: number): string;
  friends(title: string, rows: string[], hasFriends: boolean): string;
  you: string;
  settings(o: { name: string; sym: string; curLabel: string; notify: boolean; langName: string }): string;
  currencyScreen: string;
  languageScreen: string;
  unlink(name: string): string;
  unlinked: string;
  myId(id: number | string): string;
  welcome: string;
  unknownCmd: string;
  sayExpense: string;
  linkExpired: string;
  linkDone(name: string): string;
  voice: {
    off: string;
    tooLong: string;
    quota: string;
    fail: string;
  };
  noAmount: string;
  photo: {
    hint: string;
    off: string;
    quota: string;
    unknown: string;
    noPrice(name: string): string;
  };
  stickersFail: string;
  stickersFail2: string;
  stickersMsg(n: number, hasAnim: boolean): string;
  undoNone: string;
  undone(amount: string, label: string): string;
  inline: { connect: string; needAmount: string; title(amount: string): string };
  guest: { start: string; noAmount: string };
  deletedNote(text: string): string;
  expenseMissing: string;
  digestDayBtn: string;
}

const ru: BotText = {
  periods: [
    ['day', 'День'],
    ['week', 'Неделя'],
    ['month', 'Месяц'],
  ],
  help: `❓ <b>Как пользоваться</b>

Просто напиши или надиктуй голосовым трату, и я её запишу:
<code>кофе 250</code>
<code>вчера такси 540</code>
<code>полторы тысячи продукты</code>
Можно несколько трат сразу, каждую с новой строки или отдельной фразой.

Можно прислать фото чека или товара: назову покупку и возьму сумму из чека или с ценника. Если цены не видно, подпиши фото суммой: <code>89</code>.

Категорию угадываю сам. Под каждой записью есть кнопки, чтобы поменять категорию или удалить запись.

В любом чате с человеком набери @ и имя бота, затем трату: <code>сигареты 250</code>. Нажми на появившуюся карточку, и трата запишется, а в чате останется сообщение о ней.

/menu — меню
/stats — статистика
/last — мои траты
/undo — удалить последнюю запись
/lang — язык
/stickers — стикеры Трэка`,
  todayWord: 'сегодня',
  yesterdayWord: 'вчера',
  b: {
    back: '‹ Назад',
    toList: '‹ К списку',
    cancel: '✖️ Отмена',
    category: '🏷 Категория',
    del: '🗑 Удалить',
    promo: '📲 Тоже хочу считать траты',
    openApp: '📱 Открыть СпендТрекер',
    add: '➕ Добавить',
    stats: '📊 Статистика',
    mine: '🧾 Мои траты',
    friends: '👥 Друзья',
    settings: '⚙️ Настройки',
    help: '❓ Помощь',
    stickers: '🎨 Стикеры Трэка',
    charts: '📈 Графики на сайте',
    monthCard: '📸 Мой месяц картинкой',
    addFriend: '➕ Добавить друга',
    allSettings: '🌐 Все настройки на сайте',
    currency: '💱 Валюта',
    language: '🌍 Язык',
    unlink: '🔌 Отключить бота',
    yesUnlink: 'Да, отключить',
    no: 'Отмена',
    start: '🚀 Начать',
    haveAccount: 'У меня уже есть аккаунт',
    openProfile: 'Открыть профиль',
    plain: '➕ Обычные',
    anim: '✨ Анимированные',
    notifyOn: '🔔 Итоги от Трэка: вкл',
    notifyOff: '🔕 Итоги от Трэка: выкл',
    stopNotify: '🔕 Не присылать',
    saving: '⏳ Записываю…',
  },
  toast: {
    saving: 'Секунду, записываю…',
    notLinked: 'Бот не подключён к аккаунту',
    notYours: 'Это не твоя запись',
    currency: (sym) => `Валюта: ${sym}`,
    notifyOn: 'Трэк будет присылать итоги 🔔',
    notifyOff: 'Больше не буду присылать итоги 🔕',
    disconnected: 'Отключено',
    gone: 'Этой записи нет — её удалили или она не твоя',
    deleted: 'Удалено',
    stickers: 'Секунду, готовлю стикеры…',
    lang: (name) => `Язык: ${name}`,
  },
  home: (name, sym, o, monthName) => `💸 <b>СпендТрекер</b> · ${esc(name)}

Сегодня — <b>${fmt0(o.todayTotal)} ${sym}</b>
Неделя — <b>${fmt0(o.weekTotal)} ${sym}</b>
${monthName} — <b>${fmt0(o.monthTotal)} ${sym}</b>

<i>Чтобы записать трату, просто напиши или надиктуй: «кофе 250»</i>`,
  addScreen: `➕ <b>Новая трата</b>

Выбери категорию, а потом отправь сумму и, если хочешь, заметку — например <code>250 обед</code>.

Можно и без меню: напиши «кофе 250», и категорию я угадаю.`,
  pending: (emoji, cat) => `${emoji} <b>${esc(cat)}</b>

Отправь сумму и заметку одним сообщением или голосовым: <code>250 обед</code>`,
  periodTitle: (p, monthName) => (p === 'day' ? 'сегодня' : p === 'week' ? 'за неделю' : monthName.toLowerCase()),
  stats: (title, sum, sym, rows) => `📊 <b>Статистика · ${title}</b>

${sum ? `Потрачено <b>${fmt0(sum)} ${sym}</b>\n\n${rows.join('\n\n')}` : 'За этот период трат пока нет.'}`,
  list: (total) =>
    total
      ? `🧾 <b>Мои траты</b> · ${total}\n\nНажми на трату, чтобы поменять категорию или удалить её.`
      : '🧾 <b>Мои траты</b>\n\nПока нет ни одной траты. Напиши, например: <code>кофе 250</code>',
  pageOf: (page, pages) => `· ${page} из ${pages} ·`,
  friends: (title, rows, hasFriends) => `👥 <b>Друзья · ${title}</b>

${hasFriends ? rows.join('\n') : 'Пока никого нет. Добавь друзей по нику — и смотрите, кто сколько тратит.'}`,
  you: 'Ты',
  settings: (o) => `⚙️ <b>Настройки</b>

Аккаунт — <b>${esc(o.name)}</b>
Валюта — <b>${esc(o.curLabel)}</b>
Язык — <b>${esc(o.langName)}</b>
Telegram — подключён
Итоги от Трэка — ${o.notify ? 'присылать вечером и по понедельникам' : 'выключены'}`,
  currencyScreen: '💱 <b>Валюта</b>\n\nВ ней показываются все суммы — здесь и на сайте.',
  languageScreen: '🌍 <b>Язык</b>\n\nНа каком языке мне с тобой говорить? Язык один на бота и на сайт.',
  unlink: (name) => `🔌 <b>Отключить бота от аккаунта ${esc(name)}?</b>\n\nТраты останутся на сайте. Подключить снова можно в профиле.`,
  unlinked: '🔌 Бот отключён от аккаунта. Подключить снова можно в профиле на сайте.',
  myId: (id) => `Твой Telegram ID: <code>${id}</code>`,
  welcome:
    '👋 Привет! Я Трэк, записываю траты в <b>СпендТрекер</b>.\n\nНажми <b>«Начать»</b> и войди через Telegram: аккаунт создастся за пару секунд. Потом просто пиши мне: <code>кофе 250</code>.',
  unknownCmd: 'Не знаю такой команды. /menu — меню, /help — что я умею.',
  sayExpense: 'Напиши трату текстом или надиктуй голосовым: <code>кофе 250</code>',
  linkExpired: 'Ссылка устарела. Открой профиль на сайте и нажми «Подключить Telegram» ещё раз.',
  linkDone: (name) => `🎉 Готово! Бот подключён к аккаунту <b>${esc(name)}</b>.`,
  voice: {
    off: 'Голосовые пока не понимаю. Напиши текстом: <code>кофе 250</code>',
    tooLong: 'Голосовое длиннее минуты. Скажи покороче, например: «кофе 250».',
    quota: 'На сегодня голосовые закончились. Напиши текстом: <code>кофе 250</code>',
    fail: 'Не получилось разобрать голосовое. Попробуй ещё раз или напиши текстом.',
  },
  noAmount: 'Не нашёл сумму. Напиши, например: <code>кофе 250</code> или <code>вчера такси 540</code>',
  photo: {
    hint: 'Напиши текстом: <code>кофе 250</code>',
    off: 'Фото пока не понимаю.',
    quota: 'На сегодня фото закончились.',
    unknown: 'Не разобрал, что на фото.',
    noPrice: (name) => `Похоже на «${esc(name)}», но цены не вижу. Пришли фото с подписью-суммой, например <code>89</code>, или напиши текстом.`,
  },
  stickersFail: 'Не получилось достать стикеры, попробуй чуть позже.',
  stickersFail2: 'Не получилось выпустить стикеры. Попробуй ещё раз чуть позже.',
  stickersMsg: (n, hasAnim) =>
    `🎨 <b>Стикеры Трэка</b> — ${n} штук: «Записал!», «Опять кофе?», «Кэшбэк!», «Денег нет» и другие.${hasAnim ? '\n\nЕсть и анимированные: Трэк машет, прыгает и моргает ✨' : ''}\n\nДобавь их и отправляй друзьям 👇`,
  undoNone: 'Удалять нечего: трат пока нет.',
  undone: (amount, label) => `↩️ Удалил: ${amount} · ${esc(label)}`,
  inline: {
    connect: 'Подключить бота к СпендТрекеру',
    needAmount: 'Напиши трату и сумму: «кофе 250»',
    title: (amount) => `Записать ${amount}`,
  },
  guest: {
    start: 'Чтобы записывать траты, начни со мной в личке — это пара секунд.',
    noAmount: 'Не нашёл сумму. Напиши, например: <code>@бот сигареты 250</code>',
  },
  deletedNote: (text) => `🗑 <s>${text}</s> — удалено`,
  expenseMissing: 'Этой записи нет — её удалили или она не твоя',
  digestDayBtn: '📊 Статистика',
};

const en: BotText = {
  periods: [
    ['day', 'Day'],
    ['week', 'Week'],
    ['month', 'Month'],
  ],
  help: `❓ <b>How to use</b>

Just write or dictate an expense by voice and I'll record it:
<code>coffee 250</code>
<code>taxi 540 yesterday</code>
<code>two thousand groceries</code>
You can send several at once, each on a new line or as a separate phrase.

You can send a photo of a receipt or a product: I'll name the purchase and take the amount from the receipt or the price tag. If the price isn't visible, add the amount as a caption: <code>89</code>.

I guess the category myself. Each entry has buttons to change the category or delete it.

In any chat with a person, type @ and the bot's name, then an expense: <code>cigarettes 250</code>. Tap the card that appears, and the expense is saved while the chat keeps a message about it.

/menu — menu
/stats — stats
/last — my expenses
/undo — delete the last entry
/lang — language
/stickers — Track stickers`,
  todayWord: 'today',
  yesterdayWord: 'yesterday',
  b: {
    back: '‹ Back',
    toList: '‹ To the list',
    cancel: '✖️ Cancel',
    category: '🏷 Category',
    del: '🗑 Delete',
    promo: '📲 I want to track expenses too',
    openApp: '📱 Open SpendTracker',
    add: '➕ Add',
    stats: '📊 Stats',
    mine: '🧾 My expenses',
    friends: '👥 Friends',
    settings: '⚙️ Settings',
    help: '❓ Help',
    stickers: '🎨 Track stickers',
    charts: '📈 Charts on the site',
    monthCard: '📸 My month as a picture',
    addFriend: '➕ Add a friend',
    allSettings: '🌐 All settings on the site',
    currency: '💱 Currency',
    language: '🌍 Language',
    unlink: '🔌 Disconnect the bot',
    yesUnlink: 'Yes, disconnect',
    no: 'Cancel',
    start: '🚀 Get started',
    haveAccount: 'I already have an account',
    openProfile: 'Open profile',
    plain: '➕ Regular',
    anim: '✨ Animated',
    notifyOn: '🔔 Track recaps: on',
    notifyOff: '🔕 Track recaps: off',
    stopNotify: '🔕 Stop sending',
    saving: '⏳ Saving…',
  },
  toast: {
    saving: 'One sec, saving…',
    notLinked: "The bot isn't connected to an account",
    notYours: "This isn't your entry",
    currency: (sym) => `Currency: ${sym}`,
    notifyOn: 'Track will send you recaps 🔔',
    notifyOff: "I won't send recaps anymore 🔕",
    disconnected: 'Disconnected',
    gone: 'This entry is gone — it was deleted or is not yours',
    deleted: 'Deleted',
    stickers: 'One sec, preparing stickers…',
    lang: (name) => `Language: ${name}`,
  },
  home: (name, sym, o, monthName) => `💸 <b>SpendTracker</b> · ${esc(name)}

Today — <b>${fmt0(o.todayTotal)} ${sym}</b>
Week — <b>${fmt0(o.weekTotal)} ${sym}</b>
${monthName} — <b>${fmt0(o.monthTotal)} ${sym}</b>

<i>To record an expense, just write or dictate it: "coffee 250"</i>`,
  addScreen: `➕ <b>New expense</b>

Pick a category, then send the amount and, if you like, a note — for example <code>250 lunch</code>.

You can also skip the menu: write "coffee 250" and I'll guess the category.`,
  pending: (emoji, cat) => `${emoji} <b>${esc(cat)}</b>

Send the amount and a note in one message or by voice: <code>250 lunch</code>`,
  periodTitle: (p, monthName) => (p === 'day' ? 'today' : p === 'week' ? 'this week' : monthName),
  stats: (title, sum, sym, rows) => `📊 <b>Stats · ${title}</b>

${sum ? `Spent <b>${fmt0(sum)} ${sym}</b>\n\n${rows.join('\n\n')}` : 'No expenses for this period yet.'}`,
  list: (total) =>
    total
      ? `🧾 <b>My expenses</b> · ${total}\n\nTap an expense to change its category or delete it.`
      : '🧾 <b>My expenses</b>\n\nNo expenses yet. Write, for example: <code>coffee 250</code>',
  pageOf: (page, pages) => `· ${page} of ${pages} ·`,
  friends: (title, rows, hasFriends) => `👥 <b>Friends · ${title}</b>

${hasFriends ? rows.join('\n') : "No one here yet. Add friends by username — and see who spends how much."}`,
  you: 'You',
  settings: (o) => `⚙️ <b>Settings</b>

Account — <b>${esc(o.name)}</b>
Currency — <b>${esc(o.curLabel)}</b>
Language — <b>${esc(o.langName)}</b>
Telegram — connected
Track recaps — ${o.notify ? 'sent in the evening and on Mondays' : 'off'}`,
  currencyScreen: '💱 <b>Currency</b>\n\nAll amounts are shown in it — here and on the site.',
  languageScreen: '🌍 <b>Language</b>\n\nWhich language should I speak with you? One language for the bot and the site.',
  unlink: (name) => `🔌 <b>Disconnect the bot from the account ${esc(name)}?</b>\n\nYour expenses stay on the site. You can connect again in your profile.`,
  unlinked: '🔌 The bot is disconnected from the account. You can connect again in your profile on the site.',
  myId: (id) => `Your Telegram ID: <code>${id}</code>`,
  welcome:
    "👋 Hi! I'm Track, I log your expenses in <b>SpendTracker</b>.\n\nTap <b>\"Get started\"</b> and log in with Telegram: the account is created in a couple of seconds. Then just write to me: <code>coffee 250</code>.",
  unknownCmd: "I don't know that command. /menu — menu, /help — what I can do.",
  sayExpense: 'Write an expense as text or dictate it by voice: <code>coffee 250</code>',
  linkExpired: 'The link has expired. Open your profile on the site and tap "Connect Telegram" again.',
  linkDone: (name) => `🎉 Done! The bot is connected to the account <b>${esc(name)}</b>.`,
  voice: {
    off: "I can't understand voice messages yet. Write it as text: <code>coffee 250</code>",
    tooLong: 'That voice message is longer than a minute. Keep it shorter, for example: "coffee 250".',
    quota: 'No more voice messages for today. Write it as text: <code>coffee 250</code>',
    fail: "Couldn't make out the voice message. Try again or write it as text.",
  },
  noAmount: "I couldn't find an amount. Write, for example: <code>coffee 250</code> or <code>taxi 540 yesterday</code>",
  photo: {
    hint: 'Write it as text: <code>coffee 250</code>',
    off: "I can't understand photos yet.",
    quota: 'No more photos for today.',
    unknown: "Couldn't tell what's in the photo.",
    noPrice: (name) => `Looks like "${esc(name)}", but I can't see the price. Send the photo with the amount as a caption, for example <code>89</code>, or write it as text.`,
  },
  stickersFail: "Couldn't get the stickers, try a bit later.",
  stickersFail2: "Couldn't create the stickers. Try again a bit later.",
  stickersMsg: (n, hasAnim) =>
    `🎨 <b>Track stickers</b> — ${n} of them: "Saved!", "Coffee again?", "Cashback!", "Broke" and more.${hasAnim ? '\n\nThere are animated ones too: Track waves, jumps and blinks ✨' : ''}\n\nAdd them and send them to friends 👇`,
  undoNone: 'Nothing to delete: no expenses yet.',
  undone: (amount, label) => `↩️ Deleted: ${amount} · ${esc(label)}`,
  inline: {
    connect: 'Connect the bot to SpendTracker',
    needAmount: 'Write an expense and amount: "coffee 250"',
    title: (amount) => `Record ${amount}`,
  },
  guest: {
    start: 'To record expenses, start with me in a private chat — it takes a couple of seconds.',
    noAmount: "I couldn't find an amount. Write, for example: <code>@bot cigarettes 250</code>",
  },
  deletedNote: (text) => `🗑 <s>${text}</s> — deleted`,
  expenseMissing: 'This entry is gone — it was deleted or is not yours',
  digestDayBtn: '📊 Stats',
};

export const botText = (lang: Lang): BotText => (lang === 'en' ? en : ru);

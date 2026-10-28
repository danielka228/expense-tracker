// «Итоги месяца» в духе Spotify Wrapped: полноэкранные слайды от Трэка — сколько потрачено, на что,
// твой тип трат, самый дорогой день, «на эти деньги можно было бы…», место среди друзей.
// Здесь — подсчёт и тексты на двух языках; вёрстка слайдов — wrappedPage в views.ts.

import { convert } from './money';
import { perMonth } from './subs';
import type { Lang } from './i18n';

export interface WrappedData {
  month: string; // YYYY-MM
  partial: boolean; // месяц ещё идёт — итоги «на сегодня»
  daysInPeriod: number; // дней в месяце (или прошло, если месяц идёт)
  total: number;
  count: number;
  prevTotal: number;
  cats: { category: string; total: number }[];
  topNote: { note: string; n: number; total: number } | null;
  coffee: { n: number; total: number };
  bigDay: { date: string; total: number; note: string | null; category: string; amount: number } | null;
  weekday: { day: number; total: number } | null; // 0 — воскресенье
  zeroDays: number;
  streak: number; // самая длинная серия дней без трат
  friends: { rank: number; of: number } | null; // место по экономности среди тебя и друзей (1 — тратил меньше всех)
  subsMonthly: number; // подписки в месяц, в валюте человека
}

export const monthBounds = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const prevStart = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const prevEnd = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  return { start, end, prevStart, prevEnd };
};

/** Какой месяц показывать: ?m=YYYY-MM (не из будущего), иначе в первую неделю — прошлый, потом — текущий */
export function pickMonth(q: string | undefined, today: string): string {
  const cur = today.slice(0, 7);
  if (q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q) && q <= cur) return q;
  if (Number(today.slice(8, 10)) <= 7) return monthBounds(cur).prevStart.slice(0, 7);
  return cur;
}

const COFFEE = "(lower(note) LIKE '%кофе%' OR lower(note) LIKE '%капуч%' OR lower(note) LIKE '%латте%' OR lower(note) LIKE '%раф%' OR lower(note) LIKE '%американо%' OR lower(note) LIKE '%эспрессо%' OR lower(note) LIKE '%coffee%' OR lower(note) LIKE '%latte%' OR lower(note) LIKE '%cappuccino%' OR lower(note) LIKE '%espresso%')";

export async function loadWrapped(db: D1Database, user: { id: number; currency: string }, month: string, today: string): Promise<WrappedData> {
  const { start, end: monthEnd, prevStart, prevEnd } = monthBounds(month);
  const partial = monthEnd > today;
  const end = partial ? today : monthEnd;
  const [sum, cats, note, coffee, day, big, wd, dates, prev, friends, subs] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ?1 AND expense_date BETWEEN ?2 AND ?3').bind(user.id, start, end),
    db.prepare('SELECT category, SUM(amount) AS total FROM expenses WHERE user_id = ?1 AND expense_date BETWEEN ?2 AND ?3 GROUP BY category ORDER BY total DESC').bind(user.id, start, end),
    db
      .prepare(
        `SELECT note, COUNT(*) AS n, SUM(amount) AS total FROM expenses WHERE user_id = ?1 AND expense_date BETWEEN ?2 AND ?3 AND note IS NOT NULL AND note <> ''
         GROUP BY lower(note) ORDER BY n DESC, total DESC LIMIT 1`,
      )
      .bind(user.id, start, end),
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ?1 AND expense_date BETWEEN ?2 AND ?3 AND ${COFFEE}`).bind(user.id, start, end),
    db.prepare('SELECT expense_date AS date, SUM(amount) AS total FROM expenses WHERE user_id = ?1 AND expense_date BETWEEN ?2 AND ?3 GROUP BY expense_date ORDER BY total DESC LIMIT 1').bind(user.id, start, end),
    db
      .prepare(
        `SELECT expense_date AS date, note, category, amount FROM expenses WHERE user_id = ?1 AND expense_date =
           (SELECT expense_date FROM expenses WHERE user_id = ?1 AND expense_date BETWEEN ?2 AND ?3 GROUP BY expense_date ORDER BY SUM(amount) DESC LIMIT 1)
         ORDER BY amount DESC LIMIT 1`,
      )
      .bind(user.id, start, end),
    db
      .prepare(
        `SELECT CAST(strftime('%w', expense_date) AS INTEGER) AS day, SUM(amount) AS total FROM expenses WHERE user_id = ?1 AND expense_date BETWEEN ?2 AND ?3
         GROUP BY day ORDER BY total DESC LIMIT 1`,
      )
      .bind(user.id, start, end),
    db.prepare('SELECT DISTINCT expense_date AS d FROM expenses WHERE user_id = ?1 AND expense_date BETWEEN ?2 AND ?3 ORDER BY d').bind(user.id, start, end),
    db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ?1 AND expense_date BETWEEN ?2 AND ?3').bind(user.id, prevStart, prevEnd),
    // Ты и друзья: траты за тот же период, каждый в своей валюте
    db
      .prepare(
        `SELECT u.id, u.currency, COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.user_id = u.id AND e.expense_date BETWEEN ?2 AND ?3), 0) AS total
         FROM users u WHERE u.id = ?1 OR u.id IN (
           SELECT CASE WHEN from_user_id = ?1 THEN to_user_id ELSE from_user_id END FROM friendships
           WHERE status = 'accepted' AND (from_user_id = ?1 OR to_user_id = ?1))`,
      )
      .bind(user.id, start, end),
    db.prepare('SELECT amount, currency, period FROM subscriptions WHERE user_id = ?').bind(user.id),
  ]);
  const s = sum.results[0] as { n: number; total: number };
  const daysInPeriod = Number(end.slice(8, 10));
  // Дни без трат и самая длинная их серия
  const spent = new Set((dates.results as { d: string }[]).map((r) => r.d));
  let streak = 0;
  let run = 0;
  for (let i = 1; i <= daysInPeriod; i++) {
    const d = `${month}-${String(i).padStart(2, '0')}`;
    run = spent.has(d) ? 0 : run + 1;
    streak = Math.max(streak, run);
  }
  // Место по экономности: только среди тех, кто что-то записал
  const board = (friends.results as { id: number; currency: string; total: number }[])
    .filter((r) => r.total > 0)
    .map((r) => ({ id: r.id, total: convert(r.total, r.currency, user.currency) }))
    .sort((a, b) => a.total - b.total);
  const myRank = board.findIndex((r) => r.id === user.id) + 1;
  const n = note.results[0] as { note: string; n: number; total: number } | undefined;
  const c = coffee.results[0] as { n: number; total: number };
  const top = day.results[0] as { date: string; total: number } | undefined;
  const b = big.results[0] as { date: string; note: string | null; category: string; amount: number } | undefined;
  const w = wd.results[0] as { day: number; total: number } | undefined;
  return {
    month,
    partial,
    daysInPeriod,
    total: s.total,
    count: s.n,
    prevTotal: (prev.results[0] as { total: number }).total,
    cats: cats.results as { category: string; total: number }[],
    topNote: n && n.n > 1 ? n : null,
    coffee: c,
    bigDay: top && b ? { date: top.date, total: top.total, note: b.note, category: b.category, amount: b.amount } : null,
    weekday: w ?? null,
    zeroDays: daysInPeriod - spent.size,
    streak,
    friends: board.length > 1 && myRank ? { rank: myRank, of: board.length } : null,
    subsMonthly: (subs.results as { amount: number; currency: string; period: string }[]).reduce(
      (a, x) => a + convert(perMonth(x), x.currency, user.currency),
      0,
    ),
  };
}

// ---------- тип трат ----------

export interface Persona {
  emoji: string;
  name: string;
  line: string;
  colors: [string, string]; // градиент слайда и картинки
}

type PersonaKey = 'smoke' | 'coffee' | 'food' | 'taxi' | 'party' | 'style' | 'health' | 'home' | 'mystery' | 'tiny' | 'zen';

export function personaKey(w: WrappedData): PersonaKey {
  const share = (cat: string) => (w.total ? (w.cats.find((c) => c.category === cat)?.total ?? 0) / w.total : 0);
  if (share('Табак') >= 0.12) return 'smoke';
  if (w.coffee.n >= 8) return 'coffee';
  const top = w.cats[0];
  if (top && top.total / w.total >= 0.35) {
    const map: Record<string, PersonaKey> = {
      Еда: 'food',
      Транспорт: 'taxi',
      Развлечения: 'party',
      Одежда: 'style',
      Здоровье: 'health',
      Жильё: 'home',
      Табак: 'smoke',
      Прочее: 'mystery',
    };
    if (map[top.category]) return map[top.category];
  }
  if (w.count >= 60) return 'tiny';
  return 'zen';
}

const PERSONAS: Record<Lang, Record<PersonaKey, Omit<Persona, 'colors'>>> = {
  ru: {
    smoke: { emoji: '🚬', name: 'Дымный барон', line: 'Твои деньги буквально уходят в дым. Красиво, но дорого.' },
    coffee: { emoji: '☕', name: 'Кофейный магнат', line: 'Бариста знает тебя по имени. Возможно, уже и твою маму.' },
    food: { emoji: '🍔', name: 'Гурман', line: 'Еда — твой главный жизненный проект. Уважаем.' },
    taxi: { emoji: '🚕', name: 'Король такси', line: 'Метро — это для других. Ты передвигаешься с комфортом.' },
    party: { emoji: '🎉', name: 'Душа вечеринки', line: 'Жизнь одна, и ты точно знаешь, на что её тратить.' },
    style: { emoji: '👟', name: 'Икона стиля', line: 'Гардероб растёт быстрее, чем зарплата. Зато как выглядишь!' },
    health: { emoji: '💪', name: 'ЗОЖ-машина', line: 'Инвестируешь в лучшее вложение — в себя.' },
    home: { emoji: '🏠', name: 'Хранитель очага', line: 'Дом — твоя крепость. И основная статья расходов.' },
    mystery: { emoji: '🕵️', name: 'Человек-загадка', line: 'Больше всего — на «Прочее». Что там? Даже Трэк не знает.' },
    tiny: { emoji: '🪙', name: 'Мастер мелких трат', line: 'Ни одной крупной покупки, зато сотня мелких. Классика.' },
    zen: { emoji: '🧘', name: 'Мастер баланса', line: 'Ровно, спокойно, без перекосов. Трэк гордится.' },
  },
  en: {
    smoke: { emoji: '🚬', name: 'Smoke Baron', line: 'Your money literally goes up in smoke. Stylish, but pricey.' },
    coffee: { emoji: '☕', name: 'Coffee Tycoon', line: 'Your barista knows your name. Maybe your mom’s too.' },
    food: { emoji: '🍔', name: 'Foodie', line: 'Food is your main life project. Respect.' },
    taxi: { emoji: '🚕', name: 'Taxi Royalty', line: 'Public transport is for others. You ride in comfort.' },
    party: { emoji: '🎉', name: 'Life of the Party', line: 'You only live once, and you know exactly how to spend it.' },
    style: { emoji: '👟', name: 'Style Icon', line: 'Your wardrobe grows faster than your salary. But you look great!' },
    health: { emoji: '💪', name: 'Wellness Machine', line: 'Investing in the best asset there is — yourself.' },
    home: { emoji: '🏠', name: 'Homebody', line: 'Home is your castle. And your biggest expense.' },
    mystery: { emoji: '🕵️', name: 'Mystery Spender', line: 'Most of it went to “Other”. What’s in there? Even Track doesn’t know.' },
    tiny: { emoji: '🪙', name: 'Small-Change Master', line: 'Not one big purchase, but a hundred small ones. A classic.' },
    zen: { emoji: '🧘', name: 'Balance Master', line: 'Steady, calm, no extremes. Track is proud of you.' },
  },
};
const PERSONA_COLORS: Record<PersonaKey, [string, string]> = {
  smoke: ['#3a3f58', '#8c6b5d'],
  coffee: ['#6b3f22', '#d39a5c'],
  food: ['#c2410c', '#f59e0b'],
  taxi: ['#a16207', '#facc15'],
  party: ['#7c3aed', '#ec4899'],
  style: ['#0f766e', '#a3e635'],
  health: ['#047857', '#34d399'],
  home: ['#1d4ed8', '#38bdf8'],
  mystery: ['#312e81', '#6366f1'],
  tiny: ['#78716c', '#fbbf24'],
  zen: ['#4f46e5', '#4fd6c7'],
};
export const persona = (w: WrappedData, lang: Lang): Persona => {
  const k = personaKey(w);
  return { ...PERSONAS[lang][k], colors: PERSONA_COLORS[k] };
};

// ---------- «на эти деньги можно было бы…» ----------

// Цены в рублях на осень 2026 — прикидка; для других валют пересчитываются по курсу
const THINGS: { emoji: string; ru: [string, string, string]; en: [string, string]; rub: number }[] = [
  { emoji: '📱', ru: ['iPhone 17 Pro', 'iPhone 17 Pro', 'iPhone 17 Pro'], en: ['iPhone 17 Pro', 'iPhone 17 Pros'], rub: 130000 },
  { emoji: '🎮', ru: ['PlayStation 5', 'PlayStation 5', 'PlayStation 5'], en: ['PlayStation 5', 'PlayStation 5s'], rub: 55000 },
  { emoji: '✈️', ru: ['билет в Стамбул и обратно', 'билета в Стамбул и обратно', 'билетов в Стамбул и обратно'], en: ['return flight to Istanbul', 'return flights to Istanbul'], rub: 30000 },
  { emoji: '🎧', ru: ['AirPods Pro', 'AirPods Pro', 'AirPods Pro'], en: ['pair of AirPods Pro', 'pairs of AirPods Pro'], rub: 25000 },
  { emoji: '🎬', ru: ['поход в кино на двоих', 'похода в кино на двоих', 'походов в кино на двоих'], en: ['movie night for two', 'movie nights for two'], rub: 1400 },
  { emoji: '🌯', ru: ['шаурма', 'шаурмы', 'шаурм'], en: ['shawarma', 'shawarmas'], rub: 350 },
];

export interface WhatIf {
  label: string; // на что («Табак», «Капучино»)
  yearly: number;
  emoji: string;
  count: number;
  thing: string;
}

const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/** Самая «утекающая» статья (табак, кофе, частая покупка или главная категория) за год такими темпами */
export function whatIf(w: WrappedData, lang: Lang, currency: string, categoryLabel: (c: string) => string): WhatIf | null {
  const tobacco = w.cats.find((c) => c.category === 'Табак');
  const base =
    tobacco && tobacco.total > 0
      ? { label: categoryLabel('Табак'), total: tobacco.total }
      : w.coffee.n >= 3
        ? { label: lang === 'en' ? 'coffee' : 'кофе', total: w.coffee.total }
        : w.topNote
          ? { label: w.topNote.note, total: w.topNote.total }
          : w.cats[0]
            ? { label: categoryLabel(w.cats[0].category), total: w.cats[0].total }
            : null;
  if (!base || base.total <= 0) return null;
  // Месяц ещё идёт — растягиваем на полный месяц, потом на год
  const yearly = (base.total / w.daysInPeriod) * 30.4 * 12;
  for (const t of THINGS) {
    const price = convert(t.rub, 'RUB', currency);
    const count = Math.floor(yearly / price);
    if (count >= 1) {
      const thing = lang === 'en' ? (count === 1 ? t.en[0] : t.en[1]) : ruPlural(count, ...t.ru);
      return { label: base.label, yearly, emoji: t.emoji, count, thing };
    }
  }
  return null;
}

// ---------- тексты ----------

export interface WrappedText {
  title: (month: string) => string; // «Твой октябрь»
  intro: string;
  start: string;
  spent: string;
  entries: (n: number) => string;
  vsPrev: (pct: number, less: boolean, prevMonth: string) => string;
  firstMonth: string;
  topCat: string;
  ofAll: (pct: number) => string;
  persona: string;
  favorite: string;
  favTimes: (n: number, sum: string) => string;
  bigDay: string;
  bigDayWhat: (what: string) => string;
  weekday: (day: string) => string;
  weekdays: string[];
  zero: (n: number) => string;
  streak: (n: number) => string;
  zeroNone: string;
  whatIf: (label: string, yearly: string) => string;
  whatIfThing: (count: number, thing: string) => string;
  friends: (rank: number, of: number) => string;
  friendsLine: (rank: number) => string;
  subs: (monthly: string, yearly: string) => string;
  outro: string;
  share: string;
  sendTg: string;
  again: string;
  close: string;
  prep: string;
  holdSave: string;
  imgFail: string;
  sending: string;
  sent: string;
  sendFail: string;
  empty: string;
  emptyBtn: string;
  partial: (day: number) => string;
  cardTitle: (month: string) => string;
  cardSpent: string;
  cardTop: string;
  tapHint: string;
  banner: (month: string) => string;
  bannerSub: string;
  bot: (month: string) => string;
  botBtn: string;
}

const ru: WrappedText = {
  title: (m) => `Твой ${m}`,
  intro: 'Трэк подвёл итоги месяца. Готов узнать, какой ты транжира?',
  start: 'Поехали →',
  spent: 'За месяц ты потратил',
  entries: (n) => `в ${n} ${ruPlural(n, 'записи', 'записях', 'записях')}`,
  vsPrev: (pct, less, prev) => (less ? `На ${pct}% меньше, чем в ${prev}. Красавчик 🎉` : `На ${pct}% больше, чем в ${prev}. Бывает 😅`),
  firstMonth: 'Это твой первый месяц со мной — дальше будет с чем сравнить.',
  topCat: 'Больше всего ушло на',
  ofAll: (pct) => `${pct}% всех трат`,
  persona: 'Твой тип трат',
  favorite: 'Чаще всего ты покупал',
  favTimes: (n, sum) => `${n} ${ruPlural(n, 'раз', 'раза', 'раз')} · ${sum}`,
  bigDay: 'Самый дорогой день',
  bigDayWhat: (what) => `Главная покупка: ${what}. Что это было? 👀`,
  weekday: (day) => `Опаснее всего для кошелька — ${day}`,
  weekdays: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  zero: (n) => `${n} ${ruPlural(n, 'день', 'дня', 'дней')} без единой траты 🌱`,
  streak: (n) => `Самая длинная серия — ${n} ${ruPlural(n, 'день', 'дня', 'дней')} подряд`,
  zeroNone: 'Ни одного дня без трат. Деньги не спят — и ты тоже 😄',
  whatIf: (label, yearly) => `Такими темпами за год на «${label}» уйдёт ${yearly}`,
  whatIfThing: (count, thing) => `Это ${count} ${thing}`,
  friends: (rank, of) => (rank === 1 ? `Ты самый экономный из ${of} друзей 🏆` : `${rank}-е место по экономности из ${of}`),
  friendsLine: (rank) => (rank === 1 ? 'Друзья могут брать у тебя уроки.' : 'Есть куда расти — друзья тратят меньше 😏'),
  subs: (monthly, yearly) => `Подписки забирают ${monthly} в месяц — это ${yearly} в год`,
  outro: 'Вот такой у тебя месяц. Покажи друзьям — пусть тоже узнают свой тип трат!',
  share: 'Поделиться',
  sendTg: 'Отправить в Telegram',
  again: 'Посмотреть ещё раз',
  close: 'Закрыть',
  prep: 'Готовлю картинку…',
  holdSave: 'Зажми картинку, чтобы сохранить',
  imgFail: 'Не получилось сделать картинку',
  sending: 'Отправляю…',
  sent: 'Отправил в чат с ботом — оттуда легко переслать или выложить в сторис',
  sendFail: 'Не получилось отправить',
  empty: 'В этом месяце пока нет трат — итоги подводить не из чего.',
  emptyBtn: 'Записать трату',
  partial: (day) => `Месяц ещё идёт — итоги на ${day}-е число`,
  cardTitle: (m) => `Мой ${m}`,
  cardSpent: 'потрачено',
  cardTop: 'больше всего на',
  tapHint: 'Нажимай справа — дальше, слева — назад',
  banner: (m) => `Твой ${m} готов 🎁`,
  bannerSub: 'Итоги месяца от Трэка: тип трат, самый дорогой день и не только',
  bot: (m) => `🎁 <b>Твой ${m} готов!</b>\n\nТрэк подвёл итоги: сколько ушло, на что, какой у тебя тип трат и что можно было купить на эти деньги 👀`,
  botBtn: '🎁 Смотреть итоги',
};

const en: WrappedText = {
  title: (m) => `Your ${m}`,
  intro: 'Track has wrapped up your month. Ready to find out what kind of spender you are?',
  start: 'Let’s go →',
  spent: 'This month you spent',
  entries: (n) => `across ${n} ${n === 1 ? 'entry' : 'entries'}`,
  vsPrev: (pct, less, prev) => (less ? `${pct}% less than in ${prev}. Nice 🎉` : `${pct}% more than in ${prev}. It happens 😅`),
  firstMonth: 'It’s your first month with me — next time we’ll have something to compare.',
  topCat: 'Most of it went to',
  ofAll: (pct) => `${pct}% of everything`,
  persona: 'Your spending type',
  favorite: 'Your most frequent buy',
  favTimes: (n, sum) => `${n} times · ${sum}`,
  bigDay: 'Your most expensive day',
  bigDayWhat: (what) => `Biggest purchase: ${what}. What was that? 👀`,
  weekday: (day) => `The most dangerous day for your wallet: ${day}`,
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  zero: (n) => `${n} ${n === 1 ? 'day' : 'days'} without spending a thing 🌱`,
  streak: (n) => `Longest streak: ${n} ${n === 1 ? 'day' : 'days'} in a row`,
  zeroNone: 'Not a single day without spending. Money never sleeps — neither do you 😄',
  whatIf: (label, yearly) => `At this pace, “${label}” will cost you ${yearly} a year`,
  whatIfThing: (count, thing) => `That’s ${count} ${thing}`,
  friends: (rank, of) => (rank === 1 ? `You’re the thriftiest of ${of} friends 🏆` : `#${rank} in thriftiness out of ${of}`),
  friendsLine: (rank) => (rank === 1 ? 'Your friends could take lessons from you.' : 'Room to grow — your friends spend less 😏'),
  subs: (monthly, yearly) => `Subscriptions take ${monthly} a month — ${yearly} a year`,
  outro: 'That was your month. Show your friends — let them find out their spending type too!',
  share: 'Share',
  sendTg: 'Send to Telegram',
  again: 'Watch again',
  close: 'Close',
  prep: 'Preparing the image…',
  holdSave: 'Press and hold the image to save it',
  imgFail: 'Couldn’t make the image',
  sending: 'Sending…',
  sent: 'Sent to your chat with the bot — easy to forward or post to stories from there',
  sendFail: 'Couldn’t send',
  empty: 'No expenses this month yet — nothing to wrap up.',
  emptyBtn: 'Add an expense',
  partial: (day) => `The month isn’t over — this is as of day ${day}`,
  cardTitle: (m) => `My ${m}`,
  cardSpent: 'spent',
  cardTop: 'mostly on',
  tapHint: 'Tap right for next, left for back',
  banner: (m) => `Your ${m} is ready 🎁`,
  bannerSub: 'Track’s monthly wrap-up: your spending type, priciest day and more',
  bot: (m) => `🎁 <b>Your ${m} is ready!</b>\n\nTrack wrapped up your month: how much went where, your spending type, and what you could have bought instead 👀`,
  botBtn: '🎁 See my wrap-up',
};

export const wrappedText = (lang: Lang): WrappedText => (lang === 'en' ? en : ru);

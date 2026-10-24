// Подписки: регулярные списания (Netflix, спортзал, связь). Хранятся в своей валюте, итоги считаются
// в валюте человека. В день списания трата записывается сама (если не выключено), дата
// следующего списания сдвигается на период. Списывает утренний cron, а на всякий случай — и открытие
// страниц: так трата появляется, даже если cron в этот день не сработал.

import { tr, type Lang } from './i18n';
import { convert } from './money';

export type SubPeriod = 'month' | 'year' | 'week';
export const SUB_PERIODS: SubPeriod[] = ['month', 'year', 'week'];

export interface Sub {
  id: number;
  user_id: number;
  name: string;
  amount: number;
  currency: string;
  period: SubPeriod;
  next_date: string;
  anchor_day: number;
  category: string;
  auto: number;
}

/** Популярные подписки: по нажатию заполняют название и категорию. Цвет — для значка в списке. */
export interface SubPreset {
  name: string;
  color: string;
  category: string;
  period?: SubPeriod;
}

const P = (name: string, color: string, category = 'Развлечения', period?: SubPeriod): SubPreset => ({ name, color, category, period });

export const SUB_PRESETS: Record<Lang, SubPreset[]> = {
  ru: [
    P('Яндекс Плюс', '#fc3f1d'),
    P('Кинопоиск', '#ff6600'),
    P('Netflix', '#e50914'),
    P('Spotify', '#1db954'),
    P('YouTube Premium', '#ff0033'),
    P('VK Музыка', '#0077ff'),
    P('Okko', '#6b2bff'),
    P('Иви', '#ea003d'),
    P('Telegram Premium', '#2aabee'),
    P('iCloud+', '#3693f3', 'Прочее'),
    P('Apple Music', '#fa2d48'),
    P('ChatGPT Plus', '#10a37f', 'Прочее'),
    P('Claude Pro', '#d97757', 'Прочее'),
    P('Спортзал', '#30d158', 'Здоровье'),
    P('Мобильная связь', '#8e8e93', 'Прочее'),
    P('Домашний интернет', '#5ac8fa', 'Жильё'),
  ],
  en: [
    P('Netflix', '#e50914'),
    P('Spotify', '#1db954'),
    P('YouTube Premium', '#ff0033'),
    P('Apple Music', '#fa2d48'),
    P('Disney+', '#113ccf'),
    P('Amazon Prime', '#00a8e1'),
    P('iCloud+', '#3693f3', 'Прочее'),
    P('ChatGPT Plus', '#10a37f', 'Прочее'),
    P('Claude Pro', '#d97757', 'Прочее'),
    P('Telegram Premium', '#2aabee'),
    P('Xbox Game Pass', '#107c10'),
    P('PlayStation Plus', '#0070d1'),
    P('Gym', '#30d158', 'Здоровье'),
    P('Phone plan', '#8e8e93', 'Прочее'),
    P('Home internet', '#5ac8fa', 'Жильё'),
  ],
};

const OTHER_COLORS = ['#8e81ff', '#5ad1c6', '#ffb35c', '#ef6a9c', '#5f8cf7', '#2fc487', '#efb73d', '#9a72f7'];

/** Цвет значка: у известных сервисов — фирменный, у остальных — стабильный по названию */
export function subColor(name: string): string {
  const n = name.trim().toLowerCase();
  for (const list of Object.values(SUB_PRESETS)) {
    const p = list.find((x) => x.name.toLowerCase() === n);
    if (p) return p.color;
  }
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return OTHER_COLORS[h % OTHER_COLORS.length];
}

/** Сколько подписка стоит в месяц (в её валюте): годовая — /12, недельная — ×52/12 */
export const perMonth = (s: { amount: number; period: string }) =>
  s.period === 'year' ? s.amount / 12 : s.period === 'week' ? (s.amount * 52) / 12 : s.amount;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Следующая дата списания после date. Месячные держатся за своё число: 31 янв → 28 фев → 31 мар */
export function addPeriod(date: string, period: SubPeriod, anchorDay: number): string {
  const d = new Date(date + 'T00:00:00Z');
  if (period === 'week') return iso(d.getTime() + 7 * 86400000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + (period === 'year' ? 12 : 1);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(Date.UTC(y, m, Math.min(anchorDay, last)));
}

/** Первая дата списания не раньше today (для подписки, у которой указали прошедшую дату) */
export function rollForward(date: string, period: SubPeriod, anchorDay: number, today: string): string {
  let d = date;
  for (let i = 0; d < today && i < 600; i++) d = addPeriod(d, period, anchorDay);
  return d;
}

export interface Charged {
  user_id: number;
  name: string;
  amount: number; // в валюте человека
  date: string;
}

/**
 * Проводит все списания с датой не позже today: записывает траты (если auto) и сдвигает next_date.
 * userId — только для одного человека (при открытии страницы), иначе для всех (cron).
 */
export async function chargeDue(db: D1Database, today: string, userId?: number): Promise<Charged[]> {
  const q = userId
    ? db.prepare('SELECT s.*, u.currency AS user_currency FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE s.next_date <= ? AND s.user_id = ?').bind(today, userId)
    : db.prepare('SELECT s.*, u.currency AS user_currency FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE s.next_date <= ?').bind(today);
  const { results } = await q.all<Sub & { user_currency: string }>();
  const charged: Charged[] = [];
  const stmts: D1PreparedStatement[] = [];
  for (const s of results) {
    let next = s.next_date;
    const due: { amount: number; note: string; date: string }[] = [];
    // Если страницу долго не открывали и cron пропускал дни, списания догоняются (не больше 60 раз)
    for (let i = 0; next <= today && i < 60; i++) {
      if (s.auto) {
        const same = s.currency === s.user_currency;
        const amount = same ? s.amount : Math.round(convert(s.amount, s.currency, s.user_currency) * 100) / 100;
        due.push({ amount, note: (same ? s.name : `${s.name} (${fmtAmount(s.amount)} ${s.currency})`).slice(0, 255), date: next });
      }
      next = addPeriod(next, s.period, s.anchor_day);
    }
    if (next <= today) next = rollForward(next, s.period, s.anchor_day, iso(Date.parse(today + 'T00:00:00Z') + 86400000));
    // Сначала сдвигаем дату (только если её никто не сдвинул раньше нас), и траты пишем, лишь если
    // сдвиг прошёл: changes() — сколько строк изменил предыдущий запрос. Так одновременные cron и
    // открытие страницы не запишут одно списание дважды. batch в D1 выполняется по порядку и целиком.
    stmts.push(db.prepare('UPDATE subscriptions SET next_date = ? WHERE id = ? AND next_date = ?').bind(next, s.id, s.next_date));
    for (const e of due) {
      stmts.push(
        db
          .prepare('INSERT INTO expenses (user_id, amount, category, note, expense_date) SELECT ?, ?, ?, ?, ? WHERE changes() = 1')
          .bind(s.user_id, e.amount, s.category, e.note, e.date),
      );
      charged.push({ user_id: s.user_id, name: s.name, amount: e.amount, date: e.date });
    }
  }
  if (stmts.length) await db.batch(stmts);
  return charged;
}

const fmtAmount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export const MAX_SUBS = 100; // подписок на человека — с запасом, чтобы никто не забил базу

export interface NewSub {
  name: string;
  amount: number;
  currency: string;
  period: SubPeriod;
  next: string;
  anchor: number;
  category: string;
  auto: number;
}

/** Записывает подписку и возвращает её id; null — если у человека уже MAX_SUBS подписок */
export async function insertSub(db: D1Database, userId: number, s: NewSub): Promise<number | null> {
  const row = await db
    .prepare(
      `INSERT INTO subscriptions (user_id, name, amount, currency, period, next_date, anchor_day, category, auto)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9 WHERE (SELECT COUNT(*) FROM subscriptions WHERE user_id = ?1) < ?10 RETURNING id`,
    )
    .bind(userId, s.name, s.amount, s.currency, s.period, s.next, s.anchor, s.category, s.auto, MAX_SUBS)
    .first<{ id: number }>();
  return row?.id ?? null;
}

/**
 * Первое списание по числу месяца из сообщения боту: ближайшее такое число, начиная с сегодня
 * (сегодня — значит, списание сегодня и трата запишется сразу). Без числа считаем, что сегодня
 * уже заплачено, и следующее списание — через период. У недельных число месяца не используется.
 */
export function firstCharge(day: number | null, today: string, period: SubPeriod): { next: string; anchor: number } {
  const t = new Date(today + 'T00:00:00Z');
  if (day === null || period === 'week') {
    const anchor = t.getUTCDate();
    return { next: addPeriod(today, period, anchor), anchor };
  }
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const thisMonth = iso(Date.UTC(y, m, Math.min(day, last)));
  return { next: thisMonth >= today ? thisMonth : addPeriod(thisMonth, 'month', day), anchor: day };
}

/** «25 окт» / «Oct 25» */
export function subDay(date: string, lang: Lang) {
  const month = tr(lang).months.short[Number(date.slice(5, 7)) - 1];
  const day = Number(date.slice(8, 10));
  return lang === 'en' ? `${month} ${day}` : `${day} ${month}`;
}

// Разбор сообщения боту про подписку: «Бассейн 3000 5», «Netflix 799 15-го», «ChatGPT $20 3 числа»,
// «iCloud 1490 в год 21», «Spotify 11,99 eur on the 1st». Сумма — число при знаке валюты или самое
// «денежное» из чисел, число месяца — с «-го»/«числа»/«th» или второе число от 1 до 31.
const CURRENCY_WORDS: Record<string, string> = {};
for (const [code, words] of Object.entries({
  USD: ['$', 'usd', 'доллар', 'доллара', 'долларов', 'бакс', 'бакса', 'баксов', 'dollar', 'dollars', 'buck', 'bucks'],
  EUR: ['€', 'eur', 'евро', 'euro', 'euros'],
  RUB: ['₽', 'р', 'р.', 'руб', 'руб.', 'рубль', 'рубля', 'рублей', 'rub', 'ruble', 'rubles', 'rouble', 'roubles'],
  KZT: ['₸', 'тенге', 'kzt', 'tenge'],
  AED: ['aed', 'дирхам', 'дирхама', 'дирхамов', 'dirham', 'dirhams'],
  KGS: ['kgs', 'сом', 'сома', 'сомов', 'som'],
  UZS: ['uzs', 'сум', 'сума', 'сумов', "so'm", 'sum'],
})) {
  for (const w of words) CURRENCY_WORDS[w] = code;
}
const PERIOD_WORDS: Record<string, SubPeriod> = {
  год: 'year', года: 'year', году: 'year', годовая: 'year', годовой: 'year', ежегодно: 'year', year: 'year', yearly: 'year', annual: 'year', annually: 'year', yr: 'year',
  неделю: 'week', неделя: 'week', недели: 'week', недельная: 'week', еженедельно: 'week', week: 'week', weekly: 'week', wk: 'week',
  месяц: 'month', мес: 'month', месяца: 'month', ежемесячно: 'month', month: 'month', monthly: 'month', mo: 'month',
};
const DAY_SUFFIX = new Set(['го', 'е', 'числа', 'число', 'th', 'st', 'nd', 'rd']);
const FILLER = new Set(['в', 'во', 'за', 'по', 'на', 'раз', 'каждый', 'каждое', 'каждого', 'каждую', 'каждые', 'числа', 'число', 'every', 'each', 'on', 'the', 'of', 'a', 'an', 'per', 'once', 'a', '/', '-', '—', '–', ',']);

export interface SubInput {
  name: string;
  amount: number | null;
  currency: string | null;
  period: SubPeriod;
  day: number | null;
}

export function parseSubInput(text: string): SubInput {
  let t = String(text || '').replace(/ё/g, 'е').replace(/Ё/g, 'Е');
  t = t.replace(/(\d)\s+(?=\d{3}(\D|$))/g, '$1'); // «2 900» → «2900»
  t = t.replace(/([$€₽₸/])/g, ' $1 ').replace(/(\d)-?(?=[a-zа-я])/gi, '$1 ').replace(/,(?!\d)/g, ' ');
  const tokens = t.split(/\s+/).filter(Boolean);
  const nums: { value: number; i: number; day: boolean; cur: boolean }[] = [];
  const kind: ('num' | 'cur' | 'period' | 'skip' | 'word')[] = [];
  let currency: string | null = null;
  let period: SubPeriod = 'month';
  tokens.forEach((tok, i) => {
    const low = tok.toLowerCase();
    if (/^\d+(?:[.,]\d{1,2})?$/.test(tok)) {
      nums.push({ value: parseFloat(tok.replace(',', '.')), i, day: false, cur: false });
      kind.push('num');
    } else if (CURRENCY_WORDS[low]) {
      currency = CURRENCY_WORDS[low];
      kind.push('cur');
    } else if (PERIOD_WORDS[low]) {
      period = PERIOD_WORDS[low];
      kind.push('period');
    } else if (DAY_SUFFIX.has(low) && kind[i - 1] === 'num') {
      nums[nums.length - 1].day = true;
      kind.push('skip');
    } else if (FILLER.has(low)) {
      kind.push('skip');
    } else {
      kind.push('word');
    }
  });
  // Знак валюты рядом с числом — это сумма
  for (const n of nums) n.cur = kind[n.i + 1] === 'cur' || kind[n.i - 1] === 'cur';
  const plain = nums.filter((n) => !n.day);
  const amount =
    nums.find((n) => n.cur && !n.day) ??
    (plain.length > 1 ? plain.find((n) => n.value > 31 || !Number.isInteger(n.value)) ?? plain[0] : plain[0]);
  const dayNum =
    nums.find((n) => n.day && n !== amount) ?? nums.find((n) => n !== amount && Number.isInteger(n.value) && n.value >= 1 && n.value <= 31);
  let name = tokens.filter((_, i) => kind[i] === 'word').join(' ').replace(/^[-—:,.\s]+|[-—:,.\s]+$/g, '').slice(0, 60);
  // «бассейн» → «Бассейн», но «iCloud» и «eSIM» остаются как написаны
  const first = name.split(' ')[0];
  if (first && first === first.toLowerCase()) name = name.charAt(0).toUpperCase() + name.slice(1);
  return {
    name,
    amount: amount ? Math.round(amount.value * 100) / 100 : null,
    currency,
    period,
    day: dayNum && dayNum.value >= 1 && dayNum.value <= 31 && Number.isInteger(dayNum.value) ? dayNum.value : null,
  };
}

// ---------- тексты ----------

export interface SubsText {
  title: string;
  subtitle: (n: number) => string;
  emptySub: string;
  perMonth: string;
  perYear: string;
  count: string;
  per: Record<SubPeriod, string>;
  periods: Record<SubPeriod, string>;
  trekEmpty: string;
  trekYear: (year: string) => string;
  trekTop: (name: string, monthly: string) => string;
  trekShare: (pct: number) => string;
  tips: string[];
  upcomingH: string;
  allH: string;
  addRow: string;
  presetsH: string;
  name: string;
  namePh: string;
  amount: string;
  currency: string;
  period: string;
  nextDate: string;
  category: string;
  auto: string;
  autoFoot: string;
  add: string;
  save: string;
  del: string;
  delQ: string;
  inMonth: string;
  when: (days: number, dateLabel: string) => string;
  teaserH: string;
  teaserLine: (n: number, monthly: string) => string;
  teaserNext: (name: string, when: string) => string;
  teaserEmpty: string;
  fl: { added: string; updated: string; deleted: string; bad: string; charged: (n: number) => string };
  bot: {
    today: (lines: string[]) => string;
    tomorrow: (lines: string[]) => string;
    btn: string; // кнопка в главном меню
    title: string;
    totals: (month: string, year: string) => string;
    top: (name: string, monthly: string) => string;
    upcomingH: string;
    line: (name: string, amount: string, when: string) => string;
    tapHint: string;
    empty: string;
    more: (n: number) => string;
    add: string;
    openSite: string;
    editSite: string;
    toList: string;
    pickTitle: string;
    custom: string;
    promptPreset: (name: string, sym: string) => string;
    promptCustom: (sym: string) => string;
    needAmount: string;
    needName: string;
    tooMany: string;
    per: Record<SubPeriod, string>; // «в месяц»
    added: (name: string, amount: string, next: string, chargedToday: boolean) => string;
    card: (o: { name: string; amountLine: string; next: string; when: string; category: string; auto: boolean }) => string;
    autoOffBtn: string;
    autoOnBtn: string;
    delBtn: string;
    delQ: (name: string) => string;
    yesDel: string;
    toastAutoOn: string;
    toastAutoOff: string;
    toastDeleted: string;
    toastGone: string;
    inDays: (days: number) => string;
  };
}

const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const ru: SubsText = {
  title: 'Подписки',
  subtitle: (n) => `${n} ${ruPlural(n, 'подписка', 'подписки', 'подписок')} · списываются сами`,
  emptySub: 'Всё, что списывается каждый месяц',
  perMonth: 'В месяц на подписки',
  perYear: 'В год',
  count: 'Подписок',
  per: { month: 'мес', year: 'год', week: 'нед' },
  periods: { month: 'Каждый месяц', year: 'Раз в год', week: 'Каждую неделю' },
  trekEmpty: 'Добавь свои подписки — посчитаю, сколько они съедают за год. Обычно выходит больше, чем кажется 👀',
  trekYear: (year) => `За год подписки съедят <b>${year}</b>.`,
  trekTop: (name, monthly) => `Дороже всех — <b>${name}</b>, ${monthly} в месяц.`,
  trekShare: (pct) => `Это ${pct}% твоих трат за месяц.`,
  tips: ['Пользуешься всем этим? Отмени лишнее за день до списания — я напомню в Telegram.', 'В день списания я сам запишу трату — вносить руками не нужно.'],
  upcomingH: 'Ближайшие списания',
  allH: 'Все подписки',
  addRow: 'Добавить подписку',
  presetsH: 'Популярные',
  name: 'Название',
  namePh: 'Например, Netflix',
  amount: 'Сумма',
  currency: 'Валюта',
  period: 'Как часто',
  nextDate: 'Списание',
  category: 'Категория',
  auto: 'Записывать в траты',
  autoFoot: 'Дату можно указать и прошлую — например, когда списалось в этом месяце: следующее списание посчитаю сам. В день списания трата добавится сама, а накануне Трэк напомнит в Telegram — успеешь отменить ненужное.',
  add: 'Добавить',
  save: 'Сохранить',
  del: 'Удалить подписку',
  delQ: 'Удалить подписку? Уже записанные траты останутся.',
  inMonth: 'в месяц',
  when: (days, label) => (days <= 0 ? 'сегодня' : days === 1 ? 'завтра' : days < 7 ? `через ${days} ${ruPlural(days, 'день', 'дня', 'дней')}` : label),
  teaserH: 'Подписки',
  teaserLine: (n, monthly) => `${n} ${ruPlural(n, 'подписка', 'подписки', 'подписок')} · ${monthly} в месяц`,
  teaserNext: (name, when) => `Ближайшая — ${name}, ${when}`,
  teaserEmpty: 'Посчитаю, сколько уходит на Netflix, музыку и связь',
  fl: {
    added: 'Подписка добавлена',
    updated: 'Подписка сохранена',
    deleted: 'Подписка удалена',
    bad: 'Проверь название, сумму и дату',
    charged: (n) => `Списание по ${n} ${ruPlural(n, 'подписке', 'подпискам', 'подпискам')} записано в траты`,
  },
  bot: {
    today: (lines) => `🔁 <b>Сегодня списание по подпискам</b>\n${lines.join('\n')}\n\nЗаписал в траты.`,
    tomorrow: (lines) => `⏰ <b>Завтра спишется</b>\n${lines.join('\n')}\n\nЕсли что-то уже не нужно — отмени сегодня.`,
    btn: '🔁 Подписки',
    title: '🔁 <b>Подписки</b>',
    totals: (month, year) => `В месяц: <b>${month}</b> · в год: <b>${year}</b>`,
    top: (name, monthly) => `Дороже всех — ${name}, ${monthly} в месяц.`,
    upcomingH: '⏰ <b>Ближайшие списания</b>',
    line: (name, amount, when) => `• ${name} — ${amount}, ${when}`,
    tapHint: 'Нажми на подписку, чтобы выключить автозапись в траты или удалить её.',
    empty:
      'Подписок пока нет.\n\nДобавь Netflix, музыку, связь, спортзал — посчитаю, сколько они съедают за год. В день списания сам запишу трату, а накануне напомню, чтобы успеть отменить ненужное.',
    more: (n) => `Ещё ${n} — на сайте`,
    add: '➕ Добавить подписку',
    openSite: '📱 Подписки на сайте',
    editSite: '✏️ Изменить на сайте',
    toList: '‹ К подпискам',
    pickTitle: '➕ <b>Новая подписка</b>\n\nВыбери сервис или добавь свою.',
    custom: '✏️ Своя подписка',
    promptPreset: (name, sym) =>
      `🔁 <b>${name}</b>\n\nНапиши сумму и число месяца, когда списывается. Например: <code>399 15</code> — 399 ${sym} каждый месяц 15-го.\n\nМожно в другой валюте (<code>$20 3</code>) и раз в год (<code>1490 в год 21</code>).`,
    promptCustom: (sym) =>
      `✏️ <b>Своя подписка</b>\n\nНапиши название, сумму и число списания. Например: <code>Бассейн 3000 5</code> — 3 000 ${sym} каждый месяц 5-го.\n\nМожно в другой валюте (<code>ChatGPT $20 3</code>) и раз в год (<code>iCloud 1490 в год 21</code>).`,
    needAmount: 'Не вижу суммы. Напиши, например: <code>399 15</code>',
    needName: 'Напиши ещё и название, например: <code>Бассейн 3000 5</code>',
    tooMany: 'Подписок уже очень много — удали лишние, чтобы добавить новую.',
    per: { month: 'в месяц', year: 'в год', week: 'в неделю' },
    added: (name, amount, next, chargedToday) =>
      `✅ Подписка <b>${name}</b> добавлена: ${amount}.\nСледующее списание — ${next}.${chargedToday ? '\n\nСписание за сегодня записал в траты.' : ''}`,
    card: (o) =>
      `🔁 <b>${o.name}</b>\n${o.amountLine}\nСледующее списание: ${o.next} (${o.when})\n${o.category}\n\n${o.auto ? '✅ В день списания запишу трату сам.' : '✋ В траты не записываю — только напоминаю накануне.'}`,
    autoOffBtn: '✋ Не записывать в траты',
    autoOnBtn: '✅ Записывать в траты',
    delBtn: '🗑 Удалить',
    delQ: (name) => `Удалить подписку <b>${name}</b>? Уже записанные траты останутся.`,
    yesDel: 'Да, удалить',
    toastAutoOn: 'Буду записывать в траты',
    toastAutoOff: 'Не буду записывать в траты',
    toastDeleted: 'Подписка удалена',
    toastGone: 'Этой подписки уже нет',
    inDays: (days) => (days <= 0 ? 'сегодня' : days === 1 ? 'завтра' : `через ${days} ${ruPlural(days, 'день', 'дня', 'дней')}`),
  },
};

const enPlural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const en: SubsText = {
  title: 'Subscriptions',
  subtitle: (n) => `${n} ${enPlural(n, 'subscription', 'subscriptions')} · logged automatically`,
  emptySub: 'Everything that charges you every month',
  perMonth: 'Subscriptions per month',
  perYear: 'Per year',
  count: 'Active',
  per: { month: 'mo', year: 'yr', week: 'wk' },
  periods: { month: 'Monthly', year: 'Yearly', week: 'Weekly' },
  trekEmpty: "Add your subscriptions — I'll show what they cost you in a year. It's usually more than it feels 👀",
  trekYear: (year) => `Over a year your subscriptions eat <b>${year}</b>.`,
  trekTop: (name, monthly) => `The priciest is <b>${name}</b>, ${monthly} a month.`,
  trekShare: (pct) => `That's ${pct}% of your spending this month.`,
  tips: ["Still using all of these? Cancel the extras a day before renewal — I'll remind you in Telegram.", "On the billing day I log the expense myself — no need to add it by hand."],
  upcomingH: 'Upcoming charges',
  allH: 'All subscriptions',
  addRow: 'Add subscription',
  presetsH: 'Popular',
  name: 'Name',
  namePh: 'For example, Netflix',
  amount: 'Amount',
  currency: 'Currency',
  period: 'How often',
  nextDate: 'Next charge',
  category: 'Category',
  auto: 'Log as expense',
  autoFoot: "You can pick a past date too — say, when you were charged this month — and I'll work out the next charge. On the billing day the expense is added automatically, and the day before Track reminds you in Telegram — so you can cancel in time.",
  add: 'Add',
  save: 'Save',
  del: 'Delete subscription',
  delQ: 'Delete this subscription? Expenses already logged will stay.',
  inMonth: 'a month',
  when: (days, label) => (days <= 0 ? 'today' : days === 1 ? 'tomorrow' : days < 7 ? `in ${days} days` : label),
  teaserH: 'Subscriptions',
  teaserLine: (n, monthly) => `${n} ${enPlural(n, 'subscription', 'subscriptions')} · ${monthly} a month`,
  teaserNext: (name, when) => `Next: ${name}, ${when}`,
  teaserEmpty: "I'll count what goes to Netflix, music and your phone plan",
  fl: {
    added: 'Subscription added',
    updated: 'Subscription saved',
    deleted: 'Subscription deleted',
    bad: 'Check the name, amount and date',
    charged: (n) => `${n} ${enPlural(n, 'subscription charge', 'subscription charges')} logged as expenses`,
  },
  bot: {
    today: (lines) => `🔁 <b>Subscriptions charged today</b>\n${lines.join('\n')}\n\nLogged as expenses.`,
    tomorrow: (lines) => `⏰ <b>Renewing tomorrow</b>\n${lines.join('\n')}\n\nIf you don't need something anymore, cancel it today.`,
    btn: '🔁 Subscriptions',
    title: '🔁 <b>Subscriptions</b>',
    totals: (month, year) => `Per month: <b>${month}</b> · per year: <b>${year}</b>`,
    top: (name, monthly) => `The priciest is ${name}, ${monthly} a month.`,
    upcomingH: '⏰ <b>Upcoming charges</b>',
    line: (name, amount, when) => `• ${name} — ${amount}, ${when}`,
    tapHint: 'Tap a subscription to stop logging it as an expense or delete it.',
    empty:
      "No subscriptions yet.\n\nAdd Netflix, music, your phone plan, the gym — I'll show what they cost you in a year. On the billing day I'll log the expense myself, and the day before I'll remind you so you can cancel what you don't need.",
    more: (n) => `${n} more — on the website`,
    add: '➕ Add subscription',
    openSite: '📱 Subscriptions on the website',
    editSite: '✏️ Edit on the website',
    toList: '‹ To subscriptions',
    pickTitle: '➕ <b>New subscription</b>\n\nPick a service or add your own.',
    custom: '✏️ Custom subscription',
    promptPreset: (name, sym) =>
      `🔁 <b>${name}</b>\n\nSend the amount and the day of the month it renews. For example: <code>15 3</code> — 15 ${sym} every month on the 3rd.\n\nOther currencies work too (<code>$20 3</code>), and yearly plans (<code>99 yearly 21</code>).`,
    promptCustom: (sym) =>
      `✏️ <b>Custom subscription</b>\n\nSend the name, amount and billing day. For example: <code>Gym 45 1</code> — 45 ${sym} every month on the 1st.\n\nOther currencies work too (<code>ChatGPT $20 3</code>), and yearly plans (<code>iCloud 99 yearly 21</code>).`,
    needAmount: "I don't see an amount. Send, for example: <code>15 3</code>",
    needName: 'Add a name too, for example: <code>Gym 45 1</code>',
    tooMany: 'You already have a lot of subscriptions — delete some to add a new one.',
    per: { month: 'a month', year: 'a year', week: 'a week' },
    added: (name, amount, next, chargedToday) =>
      `✅ <b>${name}</b> added: ${amount}.\nNext charge — ${next}.${chargedToday ? "\n\nToday's charge is logged as an expense." : ''}`,
    card: (o) =>
      `🔁 <b>${o.name}</b>\n${o.amountLine}\nNext charge: ${o.next} (${o.when})\n${o.category}\n\n${o.auto ? "✅ On the billing day I'll log the expense myself." : "✋ Not logged as an expense — I'll only remind you the day before."}`,
    autoOffBtn: "✋ Don't log as expense",
    autoOnBtn: '✅ Log as expense',
    delBtn: '🗑 Delete',
    delQ: (name) => `Delete <b>${name}</b>? Expenses already logged will stay.`,
    yesDel: 'Yes, delete',
    toastAutoOn: "I'll log it as an expense",
    toastAutoOff: "I won't log it as an expense",
    toastDeleted: 'Subscription deleted',
    toastGone: 'This subscription is gone',
    inDays: (days) => (days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`),
  },
};

export const subsText = (lang: Lang): SubsText => (lang === 'en' ? en : ru);

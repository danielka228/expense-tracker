// Подписки: регулярные списания (Netflix, спортзал, связь). Хранятся в своей валюте, итоги считаются
// в валюте человека. В день списания трата записывается сама (если не выключено), дата
// следующего списания сдвигается на период. Списывает утренний cron, а на всякий случай — и открытие
// страниц: так трата появляется, даже если cron в этот день не сработал.

import type { Lang } from './i18n';
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
  bot: { today: (lines: string[]) => string; tomorrow: (lines: string[]) => string };
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
  autoFoot: 'В день списания трата добавится сама, а накануне Трэк напомнит в Telegram — успеешь отменить ненужное.',
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
  autoFoot: 'On the billing day the expense is added automatically, and the day before Track reminds you in Telegram — so you can cancel in time.',
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
  },
};

export const subsText = (lang: Lang): SubsText => (lang === 'en' ? en : ru);

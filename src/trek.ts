// Характер Трэка в Telegram-боте: реплики к тратам и тексты вечерних/недельных итогов.
// Здесь только слова — отправкой занимается telegram.ts. Новые шутки можно просто дописывать в списки.

import { fmt0 } from './views';
import { categoryLabel, type Lang } from './i18n';

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const BY_CATEGORY: Record<string, string[]> = {
  Еда: ['Вкусно поел — богато пожил 🍔', 'Еда — лучшая инвестиция. Почти 😋', 'Записал. Приятного аппетита!', 'Трэк тоже хочет кусочек 🥺'],
  Транспорт: ['Поехали! 🚀', 'Каждая поездка приближает к цели 🛣', 'Записал. Пристегнись! 🚗'],
  Жильё: ['Дом, милый дом 🏠', 'Крыша над головой — это святое', 'Уют стоит денег. Записал 🛋'],
  Развлечения: ['Отдыхать тоже надо! 🎉', 'Веселье — инвестиция в настроение 🎮', 'Надеюсь, было весело! 🍿'],
  Здоровье: ['Здоровье — лучшая трата. Береги себя 💚', 'Трэк одобряет заботу о себе 💊', 'Выздоравливай! Трэк держит кулачки 🤞'],
  Одежда: ['Обновка! Покажешь? 👀', 'Стиль — это важно. Записал 😎', 'Шопинг-терапия засчитана 🛍'],
  Табак: ['Записал. Лёгкие просили передать: «ну такое» 🫁', 'Трэк молча кашляет в сторонке 😶‍🌫️', 'Может, завтра без них? 🌱'],
  Прочее: ['Загадочная трата… записал! 👀', 'Что бы это ни было — записал 📦', 'Трэк не спрашивает, Трэк записывает 🤐'],
};

const BY_CATEGORY_EN: Record<string, string[]> = {
  Еда: ['Good food, good life 🍔', 'Food is the best investment. Almost 😋', 'Saved. Enjoy your meal!', 'Track wants a bite too 🥺'],
  Транспорт: ["Let's go! 🚀", 'Every ride gets you closer to the goal 🛣', 'Saved. Buckle up! 🚗'],
  Жильё: ['Home, sweet home 🏠', 'A roof over your head is sacred', 'Comfort costs money. Saved 🛋'],
  Развлечения: ['You gotta rest too! 🎉', 'Fun is an investment in your mood 🎮', 'Hope you had a blast! 🍿'],
  Здоровье: ['Health is the best purchase. Take care 💚', 'Track approves of looking after yourself 💊', 'Get well soon! Track keeps fingers crossed 🤞'],
  Одежда: ['New threads! Show me? 👀', 'Style matters. Saved 😎', 'Retail therapy counted 🛍'],
  Табак: ['Saved. Your lungs asked me to say: "meh" 🫁', 'Track quietly coughs in the corner 😶‍🌫️', 'Maybe tomorrow without them? 🌱'],
  Прочее: ['A mysterious expense… saved! 👀', 'Whatever it was — saved 📦', "Track doesn't ask, Track records 🤐"],
};

export interface QuipContext {
  category: string;
  note: string | null;
  amount: number;
  sym: string;
  hourMsk: number; // 0–23 по Москве
  todayCount: number; // сколько трат сегодня, включая эту
  coffeeToday: number; // сколько раз сегодня был кофе
  tobaccoMonth: number; // сколько за месяц ушло на табак
  usualDay: number; // обычные траты за день в этом месяце (0 — пока не знаем)
}

/** Короткая реплика Трэка под записанной тратой: сначала особые случаи, иначе — шутка по категории */
export function quip(c: QuipContext, lang: Lang = 'ru'): string {
  if (lang === 'en') return quipEn(c);
  const note = (c.note ?? '').toLowerCase();
  const big = c.usualDay > 0 ? c.amount >= Math.max(3000, c.usualDay * 3) : c.amount >= 10000;
  if (big) return pick(['😳 Ого! Крупная покупка. Надеюсь, она того стоила', 'Трэк аж подпрыгнул 😳 Записал!']);
  if (note.includes('кофе') && c.coffeeToday >= 3) return `☕ Это уже ${c.coffeeToday}-й кофе за сегодня. Сердечко, держись!`;
  // Ночью шутим про ночь не каждый раз, иначе надоест
  if (c.hourMsk < 5 && (c.todayCount === 1 || Math.random() < 0.3)) {
    return pick(['Ночная трата? Трэк ничего не видел… 🌙', 'В такое время? Ну ладно, записал 🦉']);
  }
  if (c.category === 'Табак' && c.tobaccoMonth >= 1000 && Math.random() < 0.5) {
    return `🚬 За месяц на сигареты — ${fmt0(c.tobaccoMonth)} ${c.sym}. Это примерно ${Math.round(c.tobaccoMonth / 200)} чашек кофе ☕`;
  }
  if (note.includes('кофе')) return pick(['☕ Кофеин засчитан. Бодрость +10', 'Ещё кофе? Трэк уже вибрирует ☕']);
  if (note.includes('такси')) return 'Такси — это когда метро тебя не достойно 😎';
  if (note.includes('шаурм')) return 'Шаурма — топливо чемпионов 🌯';
  if (c.amount <= 50) return 'Мелочь, а приятно 🪙';
  if (c.todayCount === 1 && c.hourMsk < 12) return '☀️ Первая трата за день. Поехали!';
  return pick(BY_CATEGORY[c.category] ?? BY_CATEGORY['Прочее']);
}

function quipEn(c: QuipContext): string {
  const note = (c.note ?? '').toLowerCase();
  const big = c.usualDay > 0 ? c.amount >= Math.max(3000, c.usualDay * 3) : c.amount >= 10000;
  if (big) return pick(['😳 Whoa! A big purchase. Hope it was worth it', 'Track jumped a little 😳 Saved!']);
  if (note.includes('coffee') && c.coffeeToday >= 3) return `☕ That's coffee number ${c.coffeeToday} today. Hang in there, heart!`;
  if (c.hourMsk < 5 && (c.todayCount === 1 || Math.random() < 0.3)) {
    return pick(['A night expense? Track saw nothing… 🌙', 'At this hour? Well, saved 🦉']);
  }
  if (c.category === 'Табак' && c.tobaccoMonth >= 1000 && Math.random() < 0.5) {
    return `🚬 ${fmt0(c.tobaccoMonth)} ${c.sym} on cigarettes this month. That's about ${Math.round(c.tobaccoMonth / 200)} cups of coffee ☕`;
  }
  if (note.includes('coffee')) return pick(['☕ Caffeine counted. Energy +10', 'More coffee? Track is already vibrating ☕']);
  if (note.includes('taxi') || note.includes('uber')) return "A taxi is when the metro isn't worthy of you 😎";
  if (note.includes('shawarma')) return 'Shawarma — fuel of champions 🌯';
  if (c.amount <= 50) return 'Small change, still nice 🪙';
  if (c.todayCount === 1 && c.hourMsk < 12) return '☀️ First expense of the day. Off we go!';
  return pick(BY_CATEGORY_EN[c.category] ?? BY_CATEGORY_EN['Прочее']);
}

const CAT_EMOJI: Record<string, string> = {
  Еда: '🍔',
  Транспорт: '🚕',
  Жильё: '🏠',
  Развлечения: '🎮',
  Здоровье: '💊',
  Одежда: '👕',
  Табак: '🚬',
  Прочее: '📦',
};

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/** Вечерние итоги дня (21:00 по Москве) */
export function eveningText(o: { sym: string; total: number; count: number; top: { category: string; total: number } | null; usualDay: number }, lang: Lang = 'ru') {
  if (lang === 'en') {
    if (!o.count) {
      return pick([
        '🌙 Not a single expense today! Track is proud of you 🌱\n\n<i>…or did you just forget to log it? 👀</i>',
        '🌙 A day without expenses — a small victory 🏆\n\nIf you did buy something, just write to me, for example: <code>coffee 250</code>',
      ]);
    }
    const sum = `<b>${fmt0(o.total)} ${o.sym}</b>`;
    let verdict = 'An ordinary day, all under control 😉';
    if (o.usualDay > 0 && o.total > o.usualDay * 1.5) verdict = `That's more than usual (~${fmt0(o.usualDay)} ${o.sym}). Easier tomorrow? 😅`;
    else if (o.usualDay > 0 && o.total < o.usualDay * 0.8) verdict = 'Less than usual. Keep it up! 🎉';
    return `🌙 <b>Track's recap of the day</b>

Spent ${sum} · ${o.count} ${o.count === 1 ? 'expense' : 'expenses'}${o.top ? `\nMost on — ${CAT_EMOJI[o.top.category] ?? '📦'} ${categoryLabel(o.top.category, lang)} (${fmt0(o.top.total)} ${o.sym})` : ''}

${verdict}`;
  }
  if (!o.count) {
    return pick([
      '🌙 Сегодня ни одной траты! Трэк гордится тобой 🌱\n\n<i>…или ты просто забыл записать? 👀</i>',
      '🌙 День без трат — маленькая победа 🏆\n\nЕсли что-то всё-таки купил, просто напиши мне, например: <code>кофе 250</code>',
    ]);
  }
  const sum = `<b>${fmt0(o.total)} ${o.sym}</b>`;
  let verdict = 'Обычный день, всё под контролем 😉';
  if (o.usualDay > 0 && o.total > o.usualDay * 1.5) verdict = `Это больше, чем обычно (~${fmt0(o.usualDay)} ${o.sym}). Завтра полегче? 😅`;
  else if (o.usualDay > 0 && o.total < o.usualDay * 0.8) verdict = 'Меньше, чем обычно. Так держать! 🎉';
  return `🌙 <b>Итоги дня от Трэка</b>

Потрачено ${sum} · ${o.count} ${plural(o.count, 'трата', 'траты', 'трат')}${o.top ? `\nБольше всего — ${CAT_EMOJI[o.top.category] ?? '📦'} ${o.top.category} (${fmt0(o.top.total)} ${o.sym})` : ''}

${verdict}`;
}

/** Итоги прошлой недели (понедельник утром) */
export function weeklyText(o: { sym: string; total: number; prevTotal: number; count: number; top: { category: string; total: number } | null }, lang: Lang = 'ru') {
  if (lang === 'en') {
    let cmp = '';
    if (o.prevTotal > 0) {
      const diff = Math.round(((o.total - o.prevTotal) / o.prevTotal) * 100);
      cmp = diff <= -5 ? `\nThat's ${-diff}% less than the week before 🎉` : diff >= 5 ? `\nThat's ${diff}% more than the week before 👀` : '\nAlmost the same as the week before — steady 👌';
    }
    return `📅 <b>The week is behind you!</b>

Spent <b>${fmt0(o.total)} ${o.sym}</b> · ${o.count} ${o.count === 1 ? 'expense' : 'expenses'}${cmp}${o.top ? `\nBiggest item — ${CAT_EMOJI[o.top.category] ?? '📦'} ${categoryLabel(o.top.category, lang)} (${fmt0(o.top.total)} ${o.sym})` : ''}

${pick(['A new week — new wins. Track is with you! 🌱', "Let's go on! 💪", 'Have a great week! Track is here 👋'])}`;
  }
  let compare = '';
  if (o.prevTotal > 0) {
    const diff = Math.round(((o.total - o.prevTotal) / o.prevTotal) * 100);
    compare =
      diff <= -5
        ? `\nЭто на ${-diff}% меньше, чем неделей раньше 🎉`
        : diff >= 5
          ? `\nЭто на ${diff}% больше, чем неделей раньше 👀`
          : '\nПочти как неделей раньше — стабильность 👌';
  }
  return `📅 <b>Неделя позади!</b>

Потрачено <b>${fmt0(o.total)} ${o.sym}</b> · ${o.count} ${plural(o.count, 'трата', 'траты', 'трат')}${compare}${o.top ? `\nГлавная статья — ${CAT_EMOJI[o.top.category] ?? '📦'} ${o.top.category} (${fmt0(o.top.total)} ${o.sym})` : ''}

${pick(['Новая неделя — новые победы. Трэк с тобой! 🌱', 'Погнали дальше! 💪', 'Хорошей недели! Трэк на связи 👋'])}`;
}

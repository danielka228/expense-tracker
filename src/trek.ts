// Характер Трэка в Telegram-боте: реплики к тратам и тексты вечерних/недельных итогов.
// Здесь только слова — отправкой занимается telegram.ts. Новые шутки можно просто дописывать в списки.

import { fmt0 } from './views';

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
export function quip(c: QuipContext): string {
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
export function eveningText(o: { sym: string; total: number; count: number; top: { category: string; total: number } | null; usualDay: number }) {
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
export function weeklyText(o: { sym: string; total: number; prevTotal: number; count: number; top: { category: string; total: number } | null }) {
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

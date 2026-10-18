// Разбор траты из свободной фразы: «кофе 250», «вчера такси 540», «полторы тысячи на продукты».
// Один и тот же код работает на сервере (Telegram-бот) и в браузере (голосовой ввод): в страницу
// parseExpense попадает исходным текстом через Function.toString (см. PARSE_JS в client.ts).
// Поэтому parseExpense не обращается ни к чему снаружи — только к своим аргументам,
// а в wrangler.jsonc выключен keep_names, чтобы сборщик не вставлял в функцию свои помощники.

export type CategoryRules = [string, string[]][];

// Порядок важен: «пачка сигарет в магазине» — это Табак, а не Еда
export const CATEGORY_RULES: CategoryRules = [
  ['Табак', ['сигарет', 'табак', 'вейп', 'стики', 'стиков', 'айкос', 'iqos', 'электронк', 'одноразк', 'жидкость для', 'пачк']],
  ['Еда', ['еда', 'еду', 'кофе', 'обед', 'ужин', 'завтрак', 'продукт', 'кафе', 'ресторан', 'пицц', 'бургер', 'шаурм', 'перекус', 'доставк', 'суши', 'ролл', 'чай', 'хлеб', 'молок', 'магазин', 'пятерочк', 'перекрест', 'магнит', 'вкусвилл', 'макдон', 'столов', 'фрукт', 'овощ', 'мясо', 'сладк', 'сок', 'напит']],
  ['Транспорт', ['такси', 'метро', 'автобус', 'бензин', 'заправк', 'транспорт', 'проезд', 'парковк', 'поезд', 'электричк', 'каршеринг', 'самокат', 'трамва', 'троллейбус', 'билет на', 'маршрутк']],
  ['Жильё', ['квартир', 'аренд', 'коммунал', 'жкх', 'ремонт', 'жиль', 'ипотек', 'свет за', 'газ за']],
  ['Развлечения', ['кино', 'игр', 'концерт', 'бар', 'клуб', 'развлеч', 'подписк', 'театр', 'боулинг', 'музей', 'кальян', 'стрим', 'нетфликс', 'спотифа']],
  ['Здоровье', ['аптек', 'лекарств', 'врач', 'здоров', 'стоматолог', 'зуб', 'анализ', 'спортзал', 'зал', 'таблет', 'клиник', 'витамин', 'массаж']],
  ['Одежда', ['одежд', 'кроссовк', 'футболк', 'джинс', 'куртк', 'обув', 'шопинг', 'плать', 'кофт', 'штан', 'носк', 'худи', 'рубашк', 'ботинк']],
];

export interface ParsedExpense {
  amount: number | null;
  category: string | null;
  note: string;
  date: string | null;
}

export function parseExpense(text: string, todayIso: string | null, rules: CategoryRules): ParsedExpense {
  const SP = '(^|\\s)';
  const END = '(?=\\s|$|[.,!?])';
  const word = (body: string, flags?: string) => new RegExp(SP + '(' + body + ')' + END, flags || '');

  let t = ' ' + String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"]/g, ' ') + ' ';
  // «1 500» → «1500»
  t = t.replace(/(\d)\s+(?=\d{3}(\D|$))/g, '$1');
  t = t.replace(word('полторы тысячи|полторы тыщи'), '$11500');
  t = t.replace(word('пол ?тысячи|пол ?тыщи'), '$1500');
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*(тысяч[аиу]?|тыщ[иау]?|тыс\.?|к)(?=\s|$|[.,!?])/g, (_, n: string) =>
    String(Math.round(parseFloat(n.replace(',', '.')) * 1000)),
  );
  t = t.replace(word('тысяча|тысячу|тыща|тыщу'), '$11000');

  let shift = 0;
  if (word('позавчера').test(t)) shift = -2;
  else if (word('вчера').test(t)) shift = -1;
  t = t.replace(word('позавчера|вчера|сегодня', 'g'), ' ');

  let amount: number | null = null;
  const m = t.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (m && m.index !== undefined) {
    amount = parseFloat(m[1].replace(',', '.'));
    t = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length);
  }
  t = t.replace(word('рубл\\S*|руб\\.?|р\\.?|тенге|доллар\\S*|бакс\\S*|евро|сом\\S*|сум\\S*|дирхам\\S*|копе\\S*', 'g'), ' ');
  t = t.replace(/[₽$€₸]/g, ' ');

  let category: string | null = null;
  for (const [name, stems] of rules) {
    if (stems.some((s) => t.indexOf(' ' + s) !== -1)) {
      category = name;
      break;
    }
  }

  let note = t.replace(/\s+/g, ' ').trim();
  let prev;
  do {
    prev = note;
    note = note.replace(/^(я|ну|короче|так|запиши|добавь|потратил[аи]?|заплатил[аи]?|купил[аи]?|отдал[аи]?|трата|расход)\s+/, '');
  } while (note !== prev);
  note = note.replace(/^(на|за)\s+/, '').replace(/\s+(на|за|в|и)$/, '').replace(/[.,!?]+$/, '').trim();
  if (note) note = note.charAt(0).toUpperCase() + note.slice(1);

  let date: string | null = null;
  if (shift && todayIso) {
    const d = new Date(todayIso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + shift);
    date = d.toISOString().slice(0, 10);
  }
  return { amount, category, note: note.slice(0, 255), date };
}

// Разбор траты из свободной фразы: «кофе 250», «вчера такси 540», «полторы тысячи на продукты»,
// а также по-английски: «coffee 250», «taxi 540 yesterday», «two hundred fifty for groceries».
// Один и тот же код работает на сервере (Telegram-бот) и в браузере (голосовой ввод): в страницу
// parseExpense попадает исходным текстом через Function.toString (см. PARSE_JS в client.ts).
// Поэтому parseExpense не обращается ни к чему снаружи — только к своим аргументам,
// а в wrangler.jsonc выключен keep_names, чтобы сборщик не вставлял в функцию свои помощники.

export type CategoryRules = [string, string[]][];

// Порядок важен: «пачка сигарет в магазине» — это Табак, а не Еда
export const CATEGORY_RULES: CategoryRules = [
  ['Табак', ['сигарет', 'табак', 'вейп', 'стики', 'стиков', 'айкос', 'iqos', 'электронк', 'одноразк', 'жидкость для', 'пачк', 'cigar', 'tobacco', 'vape', 'vaping', 'smokes', 'cigs', 'nicotine']],
  ['Еда', ['еда', 'еду', 'кофе', 'обед', 'ужин', 'завтрак', 'продукт', 'кафе', 'ресторан', 'пицц', 'бургер', 'шаурм', 'перекус', 'доставк', 'суши', 'ролл', 'чай', 'хлеб', 'молок', 'магазин', 'пятерочк', 'перекрест', 'магнит', 'вкусвилл', 'макдон', 'столов', 'фрукт', 'овощ', 'мясо', 'сладк', 'сок', 'напит', 'food', 'coffee', 'latte', 'cappuccino', 'lunch', 'dinner', 'breakfast', 'brunch', 'grocer', 'cafe', 'restaurant', 'pizza', 'burger', 'shawarma', 'snack', 'delivery', 'takeaway', 'takeout', 'sushi', 'tea', 'bread', 'milk', 'supermarket', 'fruit', 'veg', 'meat', 'sweets', 'candy', 'juice', 'drink', 'beer', 'wine', 'mcdonald', 'kfc', 'starbucks', 'subway sandwich', 'meal']],
  ['Транспорт', ['такси', 'метро', 'автобус', 'бензин', 'заправк', 'транспорт', 'проезд', 'парковк', 'поезд', 'электричк', 'каршеринг', 'самокат', 'трамва', 'троллейбус', 'билет на', 'маршрутк', 'taxi', 'uber', 'cab', 'metro', 'subway', 'bus', 'gasoline', 'petrol', 'fuel', 'gas station', 'transport', 'parking', 'train', 'tram', 'scooter', 'carshar', 'fare', 'ticket', 'flight', 'toll']],
  ['Жильё', ['квартир', 'аренд', 'коммунал', 'жкх', 'ремонт', 'жиль', 'ипотек', 'свет за', 'газ за', 'rent', 'utilit', 'apartment', 'mortgage', 'repair', 'electric', 'housing', 'gas bill', 'water bill', 'internet bill']],
  ['Развлечения', ['кино', 'игр', 'концерт', 'бар', 'клуб', 'развлеч', 'подписк', 'театр', 'боулинг', 'музей', 'кальян', 'стрим', 'нетфликс', 'спотифа', 'cinema', 'movie', 'game', 'concert', 'club', 'subscription', 'theater', 'theatre', 'bowling', 'museum', 'netflix', 'spotify', 'party', 'fun']],
  ['Здоровье', ['аптек', 'лекарств', 'врач', 'здоров', 'стоматолог', 'зуб', 'анализ', 'спортзал', 'зал', 'таблет', 'клиник', 'витамин', 'массаж', 'pharmac', 'medicine', 'medic', 'doctor', 'health', 'dentist', 'tooth', 'gym', 'clinic', 'vitamin', 'massage', 'pills']],
  ['Одежда', ['одежд', 'кроссовк', 'футболк', 'джинс', 'куртк', 'обув', 'шопинг', 'плать', 'кофт', 'штан', 'носк', 'худи', 'рубашк', 'ботинк', 'cloth', 'sneaker', 'shirt', 'jeans', 'jacket', 'shoes', 'shopping', 'dress', 'sweater', 'hoodie', 'socks', 'coat', 'pants']],
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
  // «1 500» и «1,500» → «1500»
  t = t.replace(/(\d)\s+(?=\d{3}(\D|$))/g, '$1');
  t = t.replace(/(\d),(?=\d{3}(\D|$))/g, '$1');
  t = t.replace(word('a hundred'), '$1one hundred').replace(word('a thousand'), '$1one thousand');
  t = t.replace(word('полторы тысячи|полторы тыщи'), '$11500');
  t = t.replace(word('пол ?тысячи|пол ?тыщи'), '$1500');
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*(тысяч[аиу]?|тыщ[иау]?|тыс\.?|к|k|thousand|grand)(?=\s|$|[.,!?])/g, (_, n: string) =>
    String(Math.round(parseFloat(n.replace(',', '.')) * 1000)),
  );
  t = t.replace(/(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)/g, '$1 $2');
  // Числа словами: «двести пятьдесят» → 250, «две тысячи пятьсот» → 2500 (так их иногда пишет распознавание речи)
  const NUM: Record<string, number> = {
    ноль: 0, один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
    десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16,
    семнадцать: 17, восемнадцать: 18, девятнадцать: 19, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50,
    шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90, сто: 100, двести: 200, триста: 300,
    четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900,
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
    forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  const out: string[] = [];
  let total = 0;
  let cur = 0;
  let inNum = false;
  for (const w of t.split(' ')) {
    const bare = w.replace(/[.,!?]+$/, '');
    if (Object.prototype.hasOwnProperty.call(NUM, bare)) {
      cur += NUM[bare];
      inNum = true;
    } else if (/^(тысяч[аиу]?|тыщ[аиу]?|thousand)$/.test(bare)) {
      total += (cur || 1) * 1000;
      cur = 0;
      inNum = true;
    } else if (bare === 'hundred') {
      cur = (cur || 1) * 100;
      inNum = true;
    } else {
      if (inNum) out.push(String(total + cur));
      total = cur = 0;
      inNum = false;
      out.push(w);
    }
  }
  if (inNum) out.push(String(total + cur));
  t = out.join(' ');

  let shift = 0;
  if (word('позавчера|day before yesterday').test(t)) shift = -2;
  else if (word('вчера|yesterday').test(t)) shift = -1;
  t = t.replace(word('позавчера|day before yesterday|вчера|yesterday|сегодня|today', 'g'), ' ');

  // Если чисел несколько («2 кофе 500»), сумма — то, что стоит перед «руб/₽», иначе самое большое
  let amount: number | null = null;
  const nums = [...t.matchAll(/\d+(?:[.,]\d{1,2})?/g)];
  const currency = /^\s*(?:(?:рубл\S*|руб\.?|р\.?|сом(?:ов|а)?|сум(?:ов|а)?|тенге|доллар\S*|бакс\S*|евро|дирхам\S*|dollars?|bucks?|euros?|dirhams?|rubles?|roubles?|som|tenge|usd|eur|aed|rub|kzt)(?=\s|$|[.,!?])|[₽₸$€])/;
  const withCurrency = nums.find((n) => currency.test(t.slice((n.index ?? 0) + n[0].length)));
  const value = (n: RegExpMatchArray) => parseFloat(n[0].replace(',', '.'));
  const m = withCurrency ?? nums.reduce<RegExpMatchArray | null>((best, n) => (!best || value(n) > value(best) ? n : best), null);
  if (m && m.index !== undefined) {
    amount = value(m);
    t = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length);
  }
  t = t.replace(word('рубл\\S*|руб\\.?|р\\.?|тенге|доллар\\S*|бакс\\S*|евро|сом(?:ов|а)?|сум(?:ов|а)?|дирхам\\S*|копе\\S*|dollars?|bucks?|euros?|dirhams?|rubles?|roubles?|som|tenge|usd|eur|aed|rub|kzt|cents?', 'g'), ' ');
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
    note = note.replace(/^(я|ну|короче|так|запиши|добавь|потратил[аи]?|заплатил[аи]?|купил[аи]?|отдал[аи]?|трата|расход|i|i've|i'm|just|so|well|um|uh|spent|paid|bought|got|add|log|record|expense|spend)\s+/, '');
  } while (note !== prev);
  note = note.replace(/^(на|за|on|for)\s+/, '').replace(/\s+(на|за|в|и|on|for|at|in|and|to)$/, '').replace(/[.,!?]+$/, '').trim();
  if (note) note = note.charAt(0).toUpperCase() + note.slice(1);

  let date: string | null = null;
  if (shift && todayIso) {
    const d = new Date(todayIso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + shift);
    date = d.toISOString().slice(0, 10);
  }
  return { amount, category, note: note.slice(0, 255), date };
}

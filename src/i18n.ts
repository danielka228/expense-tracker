// Язык интерфейса сайта: русский (по умолчанию) и английский.
// Строки собраны по экранам. Перевод подключается через tr(lang) → объект со всеми фразами.
// Бот (Telegram) пока только на русском — это отдельный пласт текста.

export type Lang = 'ru' | 'en';
export const LANGS: Lang[] = ['ru', 'en'];
export const LANG_LABEL: Record<Lang, string> = { ru: 'Русский', en: 'English' };
export const langOf = (v: unknown): Lang => (v === 'en' ? 'en' : 'ru');

// Отображение валют и категорий, которые в базе хранятся по-русски: показываем на нужном языке, значение не меняем.
const CURRENCY_LABELS_EN: Record<string, string> = {
  RUB: 'Russian ruble',
  KZT: 'Kazakhstani tenge',
  USD: 'US dollar',
  AED: 'UAE dirham',
  EUR: 'Euro',
  KGS: 'Kyrgyz som',
  UZS: 'Uzbek som',
};
const CATEGORY_LABELS_EN: Record<string, string> = {
  Еда: 'Food',
  Транспорт: 'Transport',
  Жильё: 'Housing',
  Развлечения: 'Fun',
  Здоровье: 'Health',
  Одежда: 'Clothes',
  Табак: 'Tobacco',
  Прочее: 'Other',
};

export interface Dict {
  brand: string;
  htmlLang: string;
  ogLocale: string;
  shareTitle: string;
  shareText: string;
  nav: { dashboard: string; friends: string; profile: string; settings: string };
  months: { in: string[]; nom: string[]; gen: string[]; short: string[] };
  weekdays: string[];
  today: string;
  yesterday: string;
  landing: {
    login: string;
    eyebrow: string;
    h1a: string;
    h1b: string;
    lead: string;
    ctaDemo: string;
    ctaCreate: string;
    ctaStart: string;
    ctaLoginArrow: string;
    spentInMonth: string; // «Потрачено в октябре» — %s подставляется
    today: string;
    thisWeek: string;
    scrub1: string;
    voiceH2a: string;
    voiceH2b: string;
    voiceP: string;
    voiceBubble: string;
    byVoice: string;
    byVoiceP: string;
    voiceRowNote: string;
    friendA: string;
    friendB: string;
    inListH: string;
    inListP: string;
    scanH2a: string;
    scanH2b: string;
    scanP: string;
    barcodeH: string;
    barcodeP: string;
    storeH: string;
    storeP: string;
    pricesLine: string; // с %b
    monthH2a: string;
    monthH2b: string;
    friendsScrub: string;
    you: string;
    ctaSecH: string;
    ctaSecP: string;
    sampleCats: Record<string, string>;
    sampleRows: [string, string][]; // [note, catlabel]
  };
  auth: {
    titleLogin: string;
    titleRegister: string;
    headLogin: string;
    headRegister: string;
    subLogin: string;
    subRegister: string;
    pendingLogin: string;
    pendingRegister: string;
    tgLogin: string;
    tgContinue: string;
    orLogin: string;
    login: string;
    password: string;
    btnLogin: string;
    btnRegister: string;
    demoBtn: string;
    forgot: string;
    noAccount: string;
    registerLink: string;
    haveAccount: string;
    loginLink: string;
  };
  forgot: {
    title: string;
    headAsk: string;
    headSent: string;
    sent1: string;
    sent2: string;
    ask: string;
    login: string;
    send: string;
    back: string;
  };
  reset: { title: string; head: string; forAccount: string; password: string; save: string; note: string };
  tgNew: { title: string; hi: string; text: string; create: string; have: string; note: string };
  tgApp: { signingIn: string; loginBtn: string; fromBot: string; notLinked: string; failed: string; noServer: string };
  fe: {
    fillAll: string;
    pwShort: string; // %d
    tooManyReg: string;
    userExists: string;
    regSuccess: string;
    tooManyLogin: string;
    badCreds: string;
    forgotTooMany: string;
    resetExpired: string;
    resetDone: string;
  };
}

const ru: Dict = {
  brand: 'СпендТрекер',
  htmlLang: 'ru',
  ogLocale: 'ru_RU',
  shareTitle: 'СпендТрекер — траты под контролем',
  shareText: 'Записывай траты за пару касаний: на сайте, в Telegram-боте или голосом. Сканер штрихкодов, друзья и сводки от Трэка.',
  nav: { dashboard: 'Траты', friends: 'Друзья', profile: 'Профиль', settings: 'Настройки' },
  months: {
    in: ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'],
    nom: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    gen: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    short: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  },
  weekdays: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  today: 'Сегодня',
  yesterday: 'Вчера',
  landing: {
    login: 'Войти',
    eyebrow: 'Новый СпендТрекер',
    h1a: 'Деньги.',
    h1b: 'Под контролем.',
    lead: 'Записывай траты голосом, сканируй покупки и смотри, куда уходят деньги. Красиво и без лишних шагов.',
    ctaDemo: 'Открыть демо',
    ctaCreate: 'Создать аккаунт ›',
    ctaStart: 'Начать бесплатно',
    ctaLoginArrow: 'Войти ›',
    spentInMonth: 'Потрачено в %s',
    today: 'Сегодня',
    thisWeek: 'Эта неделя',
    scrub1: 'Каждая трата — в два касания. Скажи её, отсканируй или впиши. СпендТрекер сам поймёт сумму, категорию и даже магазин.',
    voiceH2a: 'Скажи —',
    voiceH2b: 'и готово.',
    voiceP: '«Вчера такси 1 200» — и сумма, категория и дата заполнятся сами. Эквалайзер слышит твой голос.',
    voiceBubble: 'кофе с другом 350',
    byVoice: 'Голосом',
    byVoiceP: 'Понимает «тысячи», «полторы», «вчера» и сам подбирает категорию.',
    voiceRowNote: 'Кофе с другом',
    friendA: 'Аня',
    friendB: 'Макс',
    inListH: 'Сразу в списке',
    inListP: 'Без форм и лишних касаний. Проверил — нажал «Добавить».',
    scanH2a: 'Наведи камеру.',
    scanH2b: 'Остальное — наше.',
    scanP: 'Отсканируй штрих-код — СпендТрекер найдёт товар, поймёт, в каком ты магазине, и подскажет цену.',
    barcodeH: 'Штрих-код',
    barcodeP: 'Миллионы товаров из открытой базы Open Food Facts.',
    storeH: 'Магазин рядом',
    storeP: 'По геопозиции — только в момент сканирования. Цены — из настоящих покупок.',
    pricesLine: 'В «Пятёрочке» обычно <b>87 ₽</b> · Магнит <b>95 ₽</b>',
    monthH2a: 'Весь месяц.',
    monthH2b: 'Одним взглядом.',
    friendsScrub: 'С друзьями — веселее. Добавь их и смотри, кто в этом месяце потратил больше всех.',
    you: 'Ты',
    ctaSecH: 'Начни сегодня.',
    ctaSecP: 'Бесплатно. Без рекламы. Прямо в браузере — и на главном экране iPhone.',
    sampleCats: { Жильё: 'Жильё', Еда: 'Еда', Одежда: 'Одежда', Транспорт: 'Транспорт', Развлечения: 'Развлечения' },
    sampleRows: [
      ['Coca-Cola 0,5 л', 'Еда · Пятёрочка'],
      ['Такси до работы', 'Транспорт'],
      ['Кроссовки', 'Одежда'],
    ],
  },
  auth: {
    titleLogin: 'Вход',
    titleRegister: 'Регистрация',
    headLogin: 'С возвращением',
    headRegister: 'Новый аккаунт',
    subLogin: 'Войди, чтобы продолжить',
    subRegister: 'Пара секунд — и можно считать траты',
    pendingLogin: 'Войди в свой аккаунт — и Telegram сразу к нему привяжется',
    pendingRegister: 'Создай аккаунт — и Telegram сразу к нему привяжется',
    tgLogin: 'Войти через Telegram',
    tgContinue: 'Продолжить с Telegram',
    orLogin: 'или по логину',
    login: 'Логин',
    password: 'Пароль',
    btnLogin: 'Войти',
    btnRegister: 'Создать аккаунт',
    demoBtn: 'Войти в демо-аккаунт',
    forgot: 'Забыли пароль?',
    noAccount: 'Нет аккаунта?',
    registerLink: 'Зарегистрироваться',
    haveAccount: 'Уже есть аккаунт?',
    loginLink: 'Войти',
  },
  forgot: {
    title: 'Забыли пароль?',
    headAsk: 'Забыли пароль?',
    headSent: 'Проверь Telegram',
    sent1: 'Если к аккаунту привязан Telegram, бот уже прислал туда ссылку для нового пароля. Она действует 30 минут.',
    sent2: 'Сообщения нет? Значит, Telegram к аккаунту не привязан — тогда восстановить вход нельзя: другого способа проверить, что аккаунт твой, у сайта нет.',
    ask: 'Напиши логин — бот пришлёт в Telegram ссылку, по которой можно задать новый пароль.',
    login: 'Логин',
    send: 'Прислать ссылку',
    back: 'Вернуться ко входу',
  },
  reset: {
    title: 'Новый пароль',
    head: 'Новый пароль',
    forAccount: 'для аккаунта',
    password: 'Пароль',
    save: 'Сохранить и войти',
    note: 'После смены пароля все остальные устройства выйдут из аккаунта.',
  },
  tgNew: {
    title: 'Вход через Telegram',
    hi: 'Привет',
    text: 'Telegram подтвердил вход. Этот Telegram пока не привязан ни к одному аккаунту СпендТрекера.',
    create: 'Создать аккаунт через Telegram',
    have: 'У меня уже есть аккаунт',
    note: 'Войдёшь по логину и паролю — и Telegram привяжется к нему.',
  },
  tgApp: {
    signingIn: 'Входим в аккаунт…',
    loginBtn: 'Войти по логину и паролю',
    fromBot: 'Эта страница открывается из Telegram-бота.',
    notLinked: 'Этот Telegram ещё не подключён к аккаунту. Войди и нажми в профиле «Подключить Telegram».',
    failed: 'Не получилось войти автоматически.',
    noServer: 'Нет связи с сервером. Попробуй ещё раз.',
  },
  fe: {
    fillAll: 'Заполните все поля',
    pwShort: 'Пароль должен быть не короче %d символов',
    tooManyReg: 'Слишком много регистраций с этого адреса. Попробуй через час.',
    userExists: 'Такой пользователь уже существует',
    regSuccess: 'Регистрация прошла успешно!',
    tooManyLogin: 'Слишком много попыток входа. Подожди 10 минут.',
    badCreds: 'Неверный логин или пароль',
    forgotTooMany: 'Слишком много запросов. Попробуй через час.',
    resetExpired: 'Ссылка устарела или уже использована. Запроси новую.',
    resetDone: 'Пароль изменён — ты в аккаунте',
  },
};

const en: Dict = {
  brand: 'SpendTracker',
  htmlLang: 'en',
  ogLocale: 'en_US',
  shareTitle: 'SpendTracker — your money, under control',
  shareText: 'Log expenses in a couple of taps: on the web, in the Telegram bot or by voice. Barcode scanner, friends and recaps from Track.',
  nav: { dashboard: 'Expenses', friends: 'Friends', profile: 'Profile', settings: 'Settings' },
  months: {
    in: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    nom: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    gen: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  today: 'Today',
  yesterday: 'Yesterday',
  landing: {
    login: 'Log in',
    eyebrow: 'The new SpendTracker',
    h1a: 'Money.',
    h1b: 'Under control.',
    lead: 'Log expenses by voice, scan your purchases and see where the money goes. Beautiful, with no extra steps.',
    ctaDemo: 'Open the demo',
    ctaCreate: 'Create an account ›',
    ctaStart: 'Start for free',
    ctaLoginArrow: 'Log in ›',
    spentInMonth: 'Spent in %s',
    today: 'Today',
    thisWeek: 'This week',
    scrub1: 'Every expense in two taps. Say it, scan it or type it. SpendTracker figures out the amount, the category and even the store.',
    voiceH2a: 'Say it —',
    voiceH2b: "and it's done.",
    voiceP: '"Taxi 1,200 yesterday" — and the amount, category and date fill in by themselves. The equalizer hears your voice.',
    voiceBubble: 'coffee with a friend 350',
    byVoice: 'By voice',
    byVoiceP: 'Understands "thousands", "a dozen", "yesterday" and picks the category for you.',
    voiceRowNote: 'Coffee with a friend',
    friendA: 'Anya',
    friendB: 'Max',
    inListH: 'Straight to the list',
    inListP: 'No forms, no extra taps. Check it — tap "Add".',
    scanH2a: 'Point the camera.',
    scanH2b: "We'll do the rest.",
    scanP: 'Scan a barcode — SpendTracker finds the product, sees which store you are in, and suggests the price.',
    barcodeH: 'Barcode',
    barcodeP: 'Millions of products from the open Open Food Facts database.',
    storeH: 'Store nearby',
    storeP: 'By location — only at the moment you scan. Prices come from real purchases.',
    pricesLine: 'Usually <b>87 ₽</b> at Pyatyorochka · Magnit <b>95 ₽</b>',
    monthH2a: 'The whole month.',
    monthH2b: 'At a glance.',
    friendsScrub: "It's more fun with friends. Add them and see who spent the most this month.",
    you: 'You',
    ctaSecH: 'Start today.',
    ctaSecP: 'Free. No ads. Right in the browser — and on your iPhone home screen.',
    sampleCats: { Жильё: 'Housing', Еда: 'Food', Одежда: 'Clothes', Транспорт: 'Transport', Развлечения: 'Fun' },
    sampleRows: [
      ['Coca-Cola 0.5 L', 'Food · Pyatyorochka'],
      ['Taxi to work', 'Transport'],
      ['Sneakers', 'Clothes'],
    ],
  },
  auth: {
    titleLogin: 'Log in',
    titleRegister: 'Sign up',
    headLogin: 'Welcome back',
    headRegister: 'New account',
    subLogin: 'Log in to continue',
    subRegister: 'A couple of seconds and you can start tracking',
    pendingLogin: 'Log in to your account — and Telegram will link to it right away',
    pendingRegister: 'Create an account — and Telegram will link to it right away',
    tgLogin: 'Log in with Telegram',
    tgContinue: 'Continue with Telegram',
    orLogin: 'or with a username',
    login: 'Username',
    password: 'Password',
    btnLogin: 'Log in',
    btnRegister: 'Create account',
    demoBtn: 'Open the demo account',
    forgot: 'Forgot your password?',
    noAccount: 'No account?',
    registerLink: 'Sign up',
    haveAccount: 'Already have an account?',
    loginLink: 'Log in',
  },
  forgot: {
    title: 'Forgot your password?',
    headAsk: 'Forgot your password?',
    headSent: 'Check Telegram',
    sent1: 'If Telegram is linked to the account, the bot has already sent a link there to set a new password. It is valid for 30 minutes.',
    sent2: "No message? Then Telegram isn't linked to the account — and the password can't be recovered: the site has no other way to confirm the account is yours.",
    ask: 'Enter your username — the bot will send a link in Telegram to set a new password.',
    login: 'Username',
    send: 'Send the link',
    back: 'Back to log in',
  },
  reset: {
    title: 'New password',
    head: 'New password',
    forAccount: 'for account',
    password: 'Password',
    save: 'Save and log in',
    note: 'After the password changes, all other devices will be logged out.',
  },
  tgNew: {
    title: 'Log in with Telegram',
    hi: 'Hi',
    text: "Telegram confirmed the login. This Telegram isn't linked to any SpendTracker account yet.",
    create: 'Create an account with Telegram',
    have: 'I already have an account',
    note: 'Log in with a username and password — and Telegram will link to it.',
  },
  tgApp: {
    signingIn: 'Signing in…',
    loginBtn: 'Log in with username and password',
    fromBot: 'This page opens from the Telegram bot.',
    notLinked: 'This Telegram is not linked to an account yet. Log in and tap "Connect Telegram" in your profile.',
    failed: 'Could not sign in automatically.',
    noServer: 'No connection to the server. Try again.',
  },
  fe: {
    fillAll: 'Fill in all fields',
    pwShort: 'Password must be at least %d characters',
    tooManyReg: 'Too many sign-ups from this address. Try again in an hour.',
    userExists: 'This user already exists',
    regSuccess: 'Signed up successfully!',
    tooManyLogin: 'Too many login attempts. Wait 10 minutes.',
    badCreds: 'Wrong username or password',
    forgotTooMany: 'Too many requests. Try again in an hour.',
    resetExpired: 'The link has expired or was already used. Request a new one.',
    resetDone: "Password changed — you're in",
  },
};

export const tr = (lang: Lang): Dict => (lang === 'en' ? en : ru);
export const currencyLabel = (code: string, lang: Lang, ruLabel: string) => (lang === 'en' ? (CURRENCY_LABELS_EN[code] ?? ruLabel) : ruLabel);
export const categoryLabel = (cat: string, lang: Lang) => (lang === 'en' ? (CATEGORY_LABELS_EN[cat] ?? cat) : cat);

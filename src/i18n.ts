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
  cl: typeof CLIENT_RU;
  brand: string;
  mascotAlt: string;
  htmlLang: string;
  ogLocale: string;
  shareTitle: string;
  shareText: string;
  nav: { dashboard: string; subs: string; friends: string; profile: string; settings: string };
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
  srv: {
    tgOpenOnSite: string; // %s — адрес сайта
    tgCancelled: string;
    tgFailed: string;
    accountCreated: string; // %s — логин
    resetMsg(name: string): string;
    resetBtn: string;
    monthCaption(month: string, bot: string | null): string;
    apiTokenMissing: string;
    apiTokenLen(n: number): string;
    apiTokenUnknown(host: string): string;
    apiBadToken: string;
    apiBadAmount: string;
    apiAmountPositive: string;
  };
  fl: {
    sessionExpired: string;
    badAmount: string;
    expenseAdded: string;
    expenseDeleted: string;
    friendsOnly: string;
    friendRemoved: string;
    selfAdd: string;
    userNotFound: string;
    reqExists: string;
    reqSentTo: string; // %s
    reqAccepted: string;
    reqDeclined: string;
    botUnavailable: string;
    tgDisconnected: string;
    tgOtherAccount: string;
    tgConnected: string;
    tgLoginOff: string;
    tgNotConfirmed: string;
    tgLinked: string;
    choosePhoto: string;
    photoFail: string;
    photoUpdated: string;
    photoDeleted: string;
    tokenCreated: string;
    pwWrong: string;
    pwShort: string; // %d
    pwChanged: string;
    pwSet: string;
    loggedOutAll: string;
    currencyUpdated: string;
    langUpdated: string;
    accountDeleted: string;
    bioSaved: string;
    bioRemoved: string;
  };
  app: {
    demo: string;
    greeting: string; // «Привет, %s»
    spentIn: string; // «Потрачено в %s»
    today: string;
    thisWeek: string;
    voiceBtn: string;
    scanBtn: string;
    manualBtn: string;
    category: string;
    date: string;
    store: string;
    optional: string;
    note: string;
    noteEg: string;
    addBtn: string;
    recentH: string;
    emptyDash: string;
    listening: string;
    cancel: string;
    done: string;
    torch: string;
    enterCode: string;
    find: string;
    byPhoto: string;
    whatBought: string;
    writeOwn: string;
    name: string;
    storeNotFound: string;
    again: string;
    addExpense: string;
    friendsSub: string;
    pDay: string;
    pWeek: string;
    pMonth: string;
    you: string;
    noFriends: string;
    requestsH: string;
    accept: string;
    decline: string;
    addFriendH: string;
    friendNick: string;
    invite: string;
    friendsFoot: string;
    friendsBack: string;
    friendsSince: string; // «В друзьях с %s»
    stToday: string;
    stWeek: string;
    stMonth: string;
    recentExp: string;
    nothingYet: string;
    removeFriendQ: string;
    removeFriend: string;
    profileFallback: string;
    userFallback: string;
    changePhoto: string;
    profilePhoto: string;
    removePhoto: string;
    onboardSince: string; // «На борту с %s»
    spent: string;
    records: string;
    friendsLabel: string;
    aboutH: string;
    aboutPlaceholder: string;
    save: string;
    tgBotH: string;
    tgLinkedText: string;
    tgLinkedTo: string; // «Подключён к @%s»
    openBot: string; // «Открыть @%s»
    disconnect: string;
    disconnectQ: string;
    tgUnlinkedText: string;
    connectTg: string;
    quickH: string;
    tokenHint: string;
    copy: string;
    copied: string;
    addCmd: string;
    howWorks: string;
    newTokenBtn: string;
    newTokenQ: string;
    createToken: string;
    settingsRow: string;
    logoutRow: string;
    helpH: string;
    helpSub: string;
    steps: [string, string][];
    tip: string;
    gotIt: string;
    avatarErr: string;
    setLoginLabel: string; // «Логин: %s»
    currency: string;
    password: string;
    currentPw: string;
    newPwPlaceholder: string;
    pwPlaceholder: string;
    pwHintNoTg: string; // с %s = логин
    quickRow: string;
    logout: string;
    logoutAllQ: string;
    logoutAll: string;
    deleteAccQ: string;
    deleteAcc: string;
    deleteFoot: string;
    language: string;
    tgSection: string;
    linkTg: string;
    linkFootLogin: string;
    linkFootBot: string;
    linked: string;
    allowBot: string;
    unlinkTg: string;
    unlinkQ: string;
    saved: string;
    monthTitle: string;
    monthEmpty: string;
    addExpenseBtn: string;
    monthSub: string;
    share: string;
    sendTg: string;
    prepImg: string;
    holdSave: string;
    imgFail: string;
    sending: string;
    sentChat: string;
    sendFail: string;
    noConn: string;
    cardMy: string; // «Мой %s»
    cardForN: string; // «за %s» (готовая строка со словом «трат»)
    cardAllControl: string;
    cardSameAs: string; // «Как за те же дни %s»
    cardDiff: string; // «На %d%% %s, чем за те же дни %s»
    cardLess: string;
    cardMore: string;
    cardMostOften: string; // «Чаще всего: %s × %d»
    cardInTg: string; // «Считаю траты в Telegram · @%s»
    cardInApp: string;
  };
}


// Строки для браузерных скриптов (голос, сканер, магазины рядом). Приезжают в страницу как window.T.
// Английский описан через typeof русского: набор ключей не разойдётся.
const CLIENT_RU = {
  speechLang: 'ru-RU',
  dec: ',',
  m: 'м',
  km: 'км',
  noStores: 'Рядом ничего не нашлось',
  geoDenied: 'Нет доступа к геопозиции',
  geoFail: 'Не удалось определить место',
  speak: 'Говори…',
  done: 'Готово',
  voiceEg: 'Например: «кофе с другом 350» или «вчера такси 1200»',
  voiceOff: 'Голосовой ввод недоступен',
  voiceNoBrowser: 'Этот браузер не умеет распознавать речь. Открой сайт в Safari или Chrome.',
  listening: 'Слушаю…',
  errMic: 'Нет доступа к микрофону — разреши его в настройках браузера',
  errSvc: 'Распознавание речи выключено в настройках телефона',
  errNet: 'Нет связи с сервером распознавания',
  errCap: 'Микрофон не найден',
  errNone: 'Ничего не услышал — попробуй ещё раз',
  retryHint: 'Нажми «Ещё раз» и говори сразу',
  again: 'Ещё раз',
  doneTick: 'Готово ✓',
  noAmount: 'Сумму не расслышал — впиши её вручную',
  recognizing: 'Распознаю…',
  months: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  torchNo: 'Вспышка недоступна в этом браузере',
  pointCam: 'Наведи камеру на штрих-код',
  camNo: 'Камера недоступна',
  scanFail: 'Не удалось запустить сканер',
  camDenied: 'Нет доступа к камере — разреши её в настройках',
  searching: 'Ищу товар…',
  notFound: 'Товар не найден',
  typeName: 'Впиши название — запомню его для этого кода',
  nameEg: 'Например, Winston Blue',
  whatBought: 'Что купил',
  looking: 'Смотрю на фото…',
  looksLike: 'Похоже на «%s». Проверь название — оно запомнится для этого кода.',
  photoLimit: 'На сегодня фото закончились — впиши название сам.',
  photoUnknown: 'Не разобрал товар на фото. Попробуй ещё раз или впиши название.',
  photoSendFail: 'Не получилось отправить фото. Впиши название сам.',
  lastTime: 'В прошлый раз',
  usually: 'обычно',
  purchases: 'покупок',
  nearby: 'Рядом',
  mrp: 'МРЦ на упаковке',
  store: 'Магазин',
};
const CLIENT_EN: typeof CLIENT_RU = {
  speechLang: 'en-US',
  dec: '.',
  m: 'm',
  km: 'km',
  noStores: 'Nothing found nearby',
  geoDenied: 'Location access denied',
  geoFail: "Couldn't determine the place",
  speak: 'Speak…',
  done: 'Done',
  voiceEg: 'For example: "coffee with a friend 350" or "taxi 1200 yesterday"',
  voiceOff: 'Voice input is unavailable',
  voiceNoBrowser: "This browser can't recognize speech. Open the site in Safari or Chrome.",
  listening: 'Listening…',
  errMic: 'No microphone access — allow it in your browser settings',
  errSvc: 'Speech recognition is turned off in your phone settings',
  errNet: 'No connection to the recognition server',
  errCap: 'Microphone not found',
  errNone: "Didn't hear anything — try again",
  retryHint: 'Tap "Again" and start speaking right away',
  again: 'Again',
  doneTick: 'Done ✓',
  noAmount: "Couldn't catch the amount — type it in",
  recognizing: 'Recognizing…',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  torchNo: 'Flash is not available in this browser',
  pointCam: 'Point the camera at a barcode',
  camNo: 'Camera unavailable',
  scanFail: "Couldn't start the scanner",
  camDenied: 'No camera access — allow it in settings',
  searching: 'Looking for the product…',
  notFound: 'Product not found',
  typeName: "Enter a name — I'll remember it for this code",
  nameEg: 'For example, Winston Blue',
  whatBought: 'What you bought',
  looking: 'Looking at the photo…',
  looksLike: 'Looks like "%s". Check the name — it will be remembered for this code.',
  photoLimit: 'No more photos for today — enter the name yourself.',
  photoUnknown: "Couldn't recognize the product in the photo. Try again or enter the name.",
  photoSendFail: "Couldn't send the photo. Enter the name yourself.",
  lastTime: 'Last time',
  usually: 'usually',
  purchases: 'purchases',
  nearby: 'Nearby',
  mrp: 'Recommended price on the pack',
  store: 'Store',
};

const ru: Dict = {
  cl: CLIENT_RU,
  brand: 'СпендТрекер',
  mascotAlt: 'Трэк, персонаж СпендТрекера',
  htmlLang: 'ru',
  ogLocale: 'ru_RU',
  shareTitle: 'СпендТрекер — траты под контролем',
  shareText: 'Записывай траты за пару касаний: на сайте, в Telegram-боте или голосом. Сканер штрихкодов, друзья и сводки от Трэка.',
  nav: { dashboard: 'Траты', subs: 'Подписки', friends: 'Друзья', profile: 'Профиль', settings: 'Настройки' },
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
  srv: {
    tgOpenOnSite: 'Чтобы привязать Telegram, открой сайт на %s',
    tgCancelled: 'Вход через Telegram отменён',
    tgFailed: 'Не получилось войти через Telegram, попробуй ещё раз',
    accountCreated: 'Аккаунт создан! Твой логин — %s',
    resetMsg: (name) => `🔑 <b>Сброс пароля</b>\n\nКто-то попросил новый пароль для аккаунта <b>${name}</b> на сайте. Ссылка действует 30 минут.\n\nЕсли это был не ты — ничего не делай, пароль останется прежним.`,
    resetBtn: 'Задать новый пароль',
    monthCaption: (month, bot) => `📊 <b>Мой ${month}</b> в СпендТрекере\n\nСохрани картинку и выложи в сторис 👀${bot ? `\nСчитаю траты тут: @${bot}` : ''}`,
    apiTokenMissing: 'Токен не дошёл: проверь, что в заголовке X-Token выбрана переменная с токеном',
    apiTokenLen: (n) => `Пришло ${n} символов вместо 32: в действии «Текст» должен быть только токен`,
    apiTokenUnknown: (host) => `Такого токена нет на этом сайте: скопируй токен в Профиле на ${host}`,
    apiBadToken: 'Неверный токен',
    apiBadAmount: 'Некорректная сумма',
    apiAmountPositive: 'Сумма должна быть больше нуля',
  },
  fl: {
    sessionExpired: 'Сессия устарела, войдите заново',
    badAmount: 'Введите корректную сумму',
    expenseAdded: 'Трата добавлена',
    expenseDeleted: 'Запись удалена',
    friendsOnly: 'Профиль виден только друзьям',
    friendRemoved: 'Удалён из друзей',
    selfAdd: 'Нельзя добавить самого себя',
    userNotFound: 'Пользователь с таким ником не найден',
    reqExists: 'Заявка уже отправлена или вы уже друзья',
    reqSentTo: 'Заявка отправлена пользователю %s',
    reqAccepted: 'Заявка принята',
    reqDeclined: 'Заявка отклонена',
    botUnavailable: 'Telegram-бот сейчас недоступен',
    tgDisconnected: 'Telegram отключён',
    tgOtherAccount: 'Этот Telegram уже подключён к другому аккаунту',
    tgConnected: 'Telegram подключён — теперь можно входить в один тап',
    tgLoginOff: 'Вход через Telegram пока не настроен',
    tgNotConfirmed: 'Telegram не подтвердил вход, попробуй ещё раз',
    tgLinked: 'Telegram привязан — теперь можно входить на сайт через Telegram',
    choosePhoto: 'Выберите фото',
    photoFail: 'Не удалось обработать фото, попробуйте другое',
    photoUpdated: 'Фото обновлено',
    photoDeleted: 'Фото удалено',
    tokenCreated: 'Токен создан',
    pwWrong: 'Текущий пароль неверен',
    pwShort: 'Новый пароль должен быть не короче %d символов',
    pwChanged: 'Пароль изменён, другие устройства вышли из аккаунта',
    pwSet: 'Пароль задан — теперь можно входить и по логину',
    loggedOutAll: 'Готово: вышли на всех устройствах, кроме этого',
    currencyUpdated: 'Валюта обновлена',
    langUpdated: 'Язык обновлён',
    accountDeleted: 'Аккаунт удалён',
    bioSaved: 'Описание сохранено',
    bioRemoved: 'Описание убрано',
  },
  app: {
    demo: 'Демо',
    greeting: 'Привет, %s',
    spentIn: 'Потрачено в %s',
    today: 'Сегодня',
    thisWeek: 'Эта неделя',
    voiceBtn: 'Голосом',
    scanBtn: 'Сканировать',
    manualBtn: 'Вручную',
    category: 'Категория',
    date: 'Дата',
    store: 'Магазин',
    optional: 'Необязательно',
    note: 'Заметка',
    noteEg: 'Кофе с другом',
    addBtn: 'Добавить',
    recentH: 'Последние записи',
    emptyDash: 'Пока нет записей — скажи трату голосом или отсканируй покупку.',
    listening: 'Слушаю…',
    cancel: 'Отмена',
    done: 'Готово',
    torch: 'Вспышка',
    enterCode: 'Ввести код вручную',
    find: 'Найти',
    byPhoto: 'Определить по фото',
    whatBought: 'Что купил',
    writeOwn: 'Вписать свой',
    name: 'Название',
    storeNotFound: 'Нет нужного магазина или товара? Впиши название — сайт запомнит его здесь, и в следующий раз он найдётся сам.',
    again: 'Ещё раз',
    addExpense: 'Добавить трату',
    friendsSub: 'Кто сколько потратил',
    pDay: 'День',
    pWeek: 'Неделя',
    pMonth: 'Месяц',
    you: 'Ты',
    noFriends: 'Пока никого нет в списке.',
    requestsH: 'Заявки в друзья',
    accept: 'Принять',
    decline: 'Отклонить',
    addFriendH: 'Добавить друга',
    friendNick: 'Ник друга',
    invite: 'Позвать',
    friendsFoot: 'Друг получит заявку и появится в рейтинге, когда примет её.',
    friendsBack: 'Друзья',
    friendsSince: 'В друзьях с %s',
    stToday: 'Сегодня',
    stWeek: 'Неделя',
    stMonth: 'Месяц',
    recentExp: 'Последние траты',
    nothingYet: 'Пока ничего не записано.',
    removeFriendQ: 'Удалить из друзей?',
    removeFriend: 'Удалить из друзей',
    profileFallback: 'Профиль',
    userFallback: 'Пользователь',
    changePhoto: 'Сменить фото',
    profilePhoto: 'Фото профиля',
    removePhoto: 'Удалить фото',
    onboardSince: 'На борту с %s',
    spent: 'Потрачено',
    records: 'Записей',
    friendsLabel: 'Друзей',
    aboutH: 'О себе',
    aboutPlaceholder: 'Пара слов о себе — их увидят друзья',
    save: 'Сохранить',
    tgBotH: 'Telegram-бот',
    tgLinkedText: 'Пиши или надиктуй боту траты, например кофе 250, и они сразу появятся здесь.',
    tgLinkedTo: 'Подключён к @%s.',
    openBot: 'Открыть @%s',
    disconnect: 'Отключить',
    disconnectQ: 'Отключить Telegram-бота?',
    tgUnlinkedText: 'Записывай траты сообщением или голосовым в Telegram: кофе 250, вчера такси 540. Бот сам угадает категорию и пришлёт сводку по команде /stats.',
    connectTg: 'Подключить Telegram',
    quickH: 'Быстрая трата с iPhone',
    tokenHint: 'Добавляй траты в два касания через приложение «Команды». Токен никому не показывай: с ним можно добавлять траты от твоего имени.',
    copy: 'Скопировать',
    copied: 'Скопировано ✓',
    addCmd: 'Добавить команду',
    howWorks: 'Как это работает',
    newTokenBtn: 'Создать новый токен',
    newTokenQ: 'Старый токен перестанет работать, и команду придётся обновить. Продолжить?',
    createToken: 'Создать токен',
    settingsRow: 'Настройки',
    logoutRow: 'Выйти из аккаунта',
    helpH: 'Как добавить команду',
    helpSub: 'Это нужно сделать один раз, займёт минуту.',
    steps: [
      ['Создай токен', 'Нажми «Создать токен» в карточке «Быстрая трата». Если токен уже есть, переходи к шагу 2.'],
      ['Скопируй токен', 'Нажми «Скопировать». Кнопка на секунду покажет «Скопировано».'],
      ['Открой команду', 'Нажми «Добавить команду». Откроется приложение «Команды» с командой «Трата».'],
      ['Вставь токен', 'Телефон спросит токен. Нажми на поле, выбери «Вставить» и нажми «Добавить команду».'],
      ['Готово, пользуйся', 'Запусти команду «Трата»: выбери категорию, напиши заметку и введи сумму. Трата сразу появится в приложении.'],
    ],
    tip: 'Совет: чтобы запускать команду с главного экрана, открой её в «Командах», нажми «Поделиться» и выбери «На экран Домой».',
    gotIt: 'Понятно',
    avatarErr: 'Не удалось обработать фото, попробуйте другое',
    setLoginLabel: 'Логин: %s',
    currency: 'Валюта',
    password: 'Пароль',
    currentPw: 'Текущий пароль',
    newPwPlaceholder: 'Новый пароль',
    pwPlaceholder: 'Пароль',
    pwHintNoTg: 'Ты входишь через Telegram. Задай пароль, чтобы входить и по логину %s.',
    quickRow: 'Быстрая трата с iPhone',
    logout: 'Выйти',
    logoutAllQ: 'Выйти из аккаунта на всех других устройствах?',
    logoutAll: 'Выйти на всех устройствах',
    deleteAccQ: 'Точно удалить аккаунт? Это необратимо.',
    deleteAcc: 'Удалить аккаунт',
    deleteFoot: 'Удаление сотрёт все траты, друзей и фото без возможности восстановления.',
    language: 'Язык',
    tgSection: 'Telegram',
    linkTg: 'Привязать Telegram',
    linkFootLogin: 'После привязки можно входить на сайт кнопкой «Войти через Telegram». Бот писать не будет, пока сам не разрешишь.',
    linkFootBot: 'Откроется бот: нажми «Старт», и он привяжется к аккаунту.',
    linked: 'привязан',
    allowBot: 'Разрешить боту писать',
    unlinkTg: 'Отвязать Telegram',
    unlinkQ: 'Отвязать Telegram? Входить через Telegram и получать сообщения от бота больше не получится.',
    saved: 'Сохранить',
    monthTitle: 'Мой месяц',
    monthEmpty: 'В этом месяце трат пока нет. Запиши первую — и здесь появится картинка для сторис.',
    addExpenseBtn: 'Добавить трату',
    monthSub: 'Картинка для сторис',
    share: '📤 Поделиться',
    sendTg: '📩 Прислать картинку в Telegram',
    prepImg: 'Готовлю картинку…',
    holdSave: 'Нажми и удерживай картинку, чтобы сохранить, — и выложи в сторис.',
    imgFail: 'Не получилось сделать картинку — сделай скриншот карточки.',
    sending: 'Отправляю…',
    sentChat: 'Отправил в чат с ботом — оттуда легко переслать или выложить в сторис.',
    sendFail: 'Не получилось отправить. Сохрани картинку вручную.',
    noConn: 'Нет связи. Сохрани картинку вручную.',
    cardMy: 'Мой %s',
    cardForN: 'за %s',
    cardAllControl: 'Все траты под контролем',
    cardSameAs: 'Как за те же дни %s',
    cardDiff: 'На %d%% %s, чем за те же дни %s',
    cardLess: 'меньше',
    cardMore: 'больше',
    cardMostOften: 'Чаще всего: %s × %d',
    cardInTg: 'Считаю траты в Telegram · @%s',
    cardInApp: 'Считаю траты в СпендТрекере',
  },
};

const en: Dict = {
  cl: CLIENT_EN,
  brand: 'SpendTracker',
  mascotAlt: 'Track, the SpendTracker mascot',
  htmlLang: 'en',
  ogLocale: 'en_US',
  shareTitle: 'SpendTracker — your money, under control',
  shareText: 'Log expenses in a couple of taps: on the web, in the Telegram bot or by voice. Barcode scanner, friends and recaps from Track.',
  nav: { dashboard: 'Expenses', subs: 'Subs', friends: 'Friends', profile: 'Profile', settings: 'Settings' },
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
  srv: {
    tgOpenOnSite: 'To link Telegram, open the site at %s',
    tgCancelled: 'Telegram login was cancelled',
    tgFailed: "Couldn't log in with Telegram, try again",
    accountCreated: 'Account created! Your username is %s',
    resetMsg: (name) => `🔑 <b>Password reset</b>\n\nSomeone asked for a new password for the account <b>${name}</b> on the site. The link is valid for 30 minutes.\n\nIf it wasn't you — do nothing, the password stays the same.`,
    resetBtn: 'Set a new password',
    monthCaption: (month, bot) => `📊 <b>My ${month}</b> in SpendTracker\n\nSave the picture and post it to your story 👀${bot ? `\nI track expenses here: @${bot}` : ''}`,
    apiTokenMissing: 'The token did not arrive: check that the X-Token header uses the variable with the token',
    apiTokenLen: (n) => `Got ${n} characters instead of 32: the "Text" action should contain only the token`,
    apiTokenUnknown: (host) => `There is no such token on this site: copy the token from your Profile on ${host}`,
    apiBadToken: 'Invalid token',
    apiBadAmount: 'Invalid amount',
    apiAmountPositive: 'The amount must be greater than zero',
  },
  fl: {
    sessionExpired: 'Session expired, please log in again',
    badAmount: 'Enter a valid amount',
    expenseAdded: 'Expense added',
    expenseDeleted: 'Entry deleted',
    friendsOnly: 'The profile is visible to friends only',
    friendRemoved: 'Removed from friends',
    selfAdd: "You can't add yourself",
    userNotFound: 'No user with that username',
    reqExists: 'A request is already sent or you are already friends',
    reqSentTo: 'Request sent to %s',
    reqAccepted: 'Request accepted',
    reqDeclined: 'Request declined',
    botUnavailable: 'The Telegram bot is unavailable right now',
    tgDisconnected: 'Telegram disconnected',
    tgOtherAccount: 'This Telegram is already connected to another account',
    tgConnected: 'Telegram connected — now you can log in in one tap',
    tgLoginOff: 'Telegram login is not set up yet',
    tgNotConfirmed: "Telegram didn't confirm the login, try again",
    tgLinked: 'Telegram linked — now you can sign in with Telegram',
    choosePhoto: 'Choose a photo',
    photoFail: 'Could not process the photo, try another one',
    photoUpdated: 'Photo updated',
    photoDeleted: 'Photo deleted',
    tokenCreated: 'Token created',
    pwWrong: 'Current password is wrong',
    pwShort: 'New password must be at least %d characters',
    pwChanged: 'Password changed, other devices were logged out',
    pwSet: 'Password set — now you can log in with your username too',
    loggedOutAll: 'Done: logged out everywhere except this device',
    currencyUpdated: 'Currency updated',
    langUpdated: 'Language updated',
    accountDeleted: 'Account deleted',
    bioSaved: 'About saved',
    bioRemoved: 'About cleared',
  },
  app: {
    demo: 'Demo',
    greeting: 'Hi, %s',
    spentIn: 'Spent in %s',
    today: 'Today',
    thisWeek: 'This week',
    voiceBtn: 'Voice',
    scanBtn: 'Scan',
    manualBtn: 'Manual',
    category: 'Category',
    date: 'Date',
    store: 'Store',
    optional: 'Optional',
    note: 'Note',
    noteEg: 'Coffee with a friend',
    addBtn: 'Add',
    recentH: 'Recent entries',
    emptyDash: 'No entries yet — say an expense by voice or scan a purchase.',
    listening: 'Listening…',
    cancel: 'Cancel',
    done: 'Done',
    torch: 'Flash',
    enterCode: 'Enter the code manually',
    find: 'Find',
    byPhoto: 'Recognize from a photo',
    whatBought: 'What you bought',
    writeOwn: 'Enter your own',
    name: 'Name',
    storeNotFound: "Can't find the store or product? Type a name — the site remembers it here, and next time it will be found automatically.",
    again: 'Again',
    addExpense: 'Add expense',
    friendsSub: 'Who spent how much',
    pDay: 'Day',
    pWeek: 'Week',
    pMonth: 'Month',
    you: 'You',
    noFriends: 'No one on the list yet.',
    requestsH: 'Friend requests',
    accept: 'Accept',
    decline: 'Decline',
    addFriendH: 'Add a friend',
    friendNick: "Friend's username",
    invite: 'Invite',
    friendsFoot: 'Your friend gets a request and shows up in the ranking once they accept it.',
    friendsBack: 'Friends',
    friendsSince: 'Friends since %s',
    stToday: 'Today',
    stWeek: 'Week',
    stMonth: 'Month',
    recentExp: 'Recent expenses',
    nothingYet: 'Nothing recorded yet.',
    removeFriendQ: 'Remove from friends?',
    removeFriend: 'Remove from friends',
    profileFallback: 'Profile',
    userFallback: 'User',
    changePhoto: 'Change photo',
    profilePhoto: 'Profile photo',
    removePhoto: 'Remove photo',
    onboardSince: 'On board since %s',
    spent: 'Spent',
    records: 'Entries',
    friendsLabel: 'Friends',
    aboutH: 'About',
    aboutPlaceholder: 'A few words about you — your friends will see them',
    save: 'Save',
    tgBotH: 'Telegram bot',
    tgLinkedText: 'Message or dictate expenses to the bot, like coffee 250, and they show up here right away.',
    tgLinkedTo: 'Connected to @%s.',
    openBot: 'Open @%s',
    disconnect: 'Disconnect',
    disconnectQ: 'Disconnect the Telegram bot?',
    tgUnlinkedText: 'Log expenses by message or voice in Telegram: coffee 250, taxi 540 yesterday. The bot guesses the category and sends a recap with /stats.',
    connectTg: 'Connect Telegram',
    quickH: 'Quick expense from iPhone',
    tokenHint: "Add expenses in two taps via the Shortcuts app. Don't show the token to anyone: it can add expenses on your behalf.",
    copy: 'Copy',
    copied: 'Copied ✓',
    addCmd: 'Add the shortcut',
    howWorks: 'How it works',
    newTokenBtn: 'Create a new token',
    newTokenQ: 'The old token will stop working and the shortcut will need updating. Continue?',
    createToken: 'Create a token',
    settingsRow: 'Settings',
    logoutRow: 'Log out',
    helpH: 'How to add the shortcut',
    helpSub: 'You only do this once, it takes a minute.',
    steps: [
      ['Create a token', 'Tap "Create a token" in the "Quick expense" card. If you already have a token, go to step 2.'],
      ['Copy the token', 'Tap "Copy". The button briefly shows "Copied".'],
      ['Open the shortcut', 'Tap "Add the shortcut". The Shortcuts app opens with the "Expense" shortcut.'],
      ['Paste the token', 'The phone asks for the token. Tap the field, choose "Paste" and tap "Add Shortcut".'],
      ['Done, go ahead', 'Run the "Expense" shortcut: pick a category, write a note and enter the amount. The expense shows up in the app right away.'],
    ],
    tip: 'Tip: to run the shortcut from the home screen, open it in Shortcuts, tap "Share" and choose "Add to Home Screen".',
    gotIt: 'Got it',
    avatarErr: 'Could not process the photo, try another one',
    setLoginLabel: 'Username: %s',
    currency: 'Currency',
    password: 'Password',
    currentPw: 'Current password',
    newPwPlaceholder: 'New password',
    pwPlaceholder: 'Password',
    pwHintNoTg: 'You log in with Telegram. Set a password to also log in with the username %s.',
    quickRow: 'Quick expense from iPhone',
    logout: 'Log out',
    logoutAllQ: 'Log out of the account on all other devices?',
    logoutAll: 'Log out everywhere',
    deleteAccQ: 'Really delete the account? This cannot be undone.',
    deleteAcc: 'Delete account',
    deleteFoot: 'Deleting erases all expenses, friends and photos with no way to recover them.',
    language: 'Language',
    tgSection: 'Telegram',
    linkTg: 'Link Telegram',
    linkFootLogin: 'Once linked, you can sign in with the "Log in with Telegram" button. The bot stays silent until you allow it.',
    linkFootBot: 'The bot opens: tap "Start", and it links to your account.',
    linked: 'linked',
    allowBot: 'Allow the bot to message',
    unlinkTg: 'Unlink Telegram',
    unlinkQ: "Unlink Telegram? You won't be able to log in with Telegram or get bot messages anymore.",
    saved: 'Save',
    monthTitle: 'My month',
    monthEmpty: 'No expenses this month yet. Record the first one — and a story image appears here.',
    addExpenseBtn: 'Add expense',
    monthSub: 'A story image',
    share: '📤 Share',
    sendTg: '📩 Send the image to Telegram',
    prepImg: 'Preparing the image…',
    holdSave: 'Press and hold the image to save it — and post it to your story.',
    imgFail: 'Could not make the image — take a screenshot of the card.',
    sending: 'Sending…',
    sentChat: 'Sent to the bot chat — easy to forward or post to your story from there.',
    sendFail: 'Could not send it. Save the image manually.',
    noConn: 'No connection. Save the image manually.',
    cardMy: 'My %s',
    cardForN: 'across %s',
    cardAllControl: 'Everything under control',
    cardSameAs: 'Same as the same days in %s',
    cardDiff: '%d%% %s than the same days in %s',
    cardLess: 'less',
    cardMore: 'more',
    cardMostOften: 'Most often: %s × %d',
    cardInTg: 'I track expenses in Telegram · @%s',
    cardInApp: 'I track expenses in SpendTracker',
  },
};

export const tr = (lang: Lang): Dict => (lang === 'en' ? en : ru);
// Символы, которые у нас записаны кириллицей («сом», «сум»), в английском интерфейсе пишем латиницей
const CURRENCY_SYMBOLS_EN: Record<string, string> = { KGS: 'som', UZS: "so'm" };
export const currencySymbol = (code: string, lang: Lang, base: string) => (lang === 'en' ? (CURRENCY_SYMBOLS_EN[code] ?? base) : base);
export const currencyLabel = (code: string, lang: Lang, ruLabel: string) => (lang === 'en' ? (CURRENCY_LABELS_EN[code] ?? ruLabel) : ruLabel);
// Обратное к categoryLabel: «Food» → «Еда». «Быстрая команда» и другие внешние источники могут прислать английское название
export const categoryId = (label: string) =>
  Object.entries(CATEGORY_LABELS_EN).find(([, en]) => en.toLowerCase() === label.trim().toLowerCase())?.[0] ?? label;
export const categoryLabel = (cat: string, lang: Lang) => (lang === 'en' ? (CATEGORY_LABELS_EN[cat] ?? cat) : cat);

/** <script>-текст, который кладёт словарь в window.T (< экранируем, чтобы строка не закрыла тег script) */
export const clientScript = (lang: Lang) =>
  `window.T=${JSON.stringify(tr(lang).cl).replace(/</g, '\\u003c')};window.LANG=${JSON.stringify(lang)};`;

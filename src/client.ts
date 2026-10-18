// Скрипты, которые выполняются в браузере. Хранятся строками и вставляются в страницу.
// Внутри строк нельзя использовать обратные кавычки и подстановки, а обратные слэши удваиваются.

// Общее: шторки, появление при прокрутке, сворачивающийся заголовок, уведомления, «докручивание» чисел
export const COMMON_JS = `
(function () {
  document.documentElement.classList.remove('no-js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fmt(n) { return Math.round(n).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '\\u202f'); }

  // Уведомления-капсулы сами уезжают через 3 секунды
  document.querySelectorAll('.flash').forEach(function (el, i) {
    setTimeout(function () {
      el.classList.add('hide');
      setTimeout(function () { el.remove(); }, 450);
    }, 3000 + i * 400);
  });

  // Числа плавно растут от нуля, когда появляются на экране
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    if (reduce || target === 0 || el.dataset.done) return;
    el.dataset.done = '1';
    var t0 = null, dur = 1100;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(step); else el.textContent = el.getAttribute('data-final');
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  // Блоки проявляются при прокрутке (как на страницах Apple)
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-count]').forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;
  window.observeReveal = function (root) {
    (root || document).querySelectorAll('.reveal:not(.in)').forEach(function (el) {
      if (io) io.observe(el); else { el.classList.add('in'); el.querySelectorAll('[data-count]').forEach(countUp); }
    });
  };
  window.observeReveal();

  // Большой заголовок прячется — в панели сверху появляется маленький
  var nav = document.querySelector('.nav'), big = document.querySelector('.large-title');
  if (nav && big && io) {
    new IntersectionObserver(function (e) { nav.classList.toggle('compact', !e[0].isIntersecting); },
      { rootMargin: '-' + (nav.offsetHeight - 6) + 'px 0px 0px 0px' }).observe(big);
  }

  // Главная карточка чуть уменьшается и тускнеет при прокрутке
  var hero = document.querySelector('.wrap .hero');
  if (hero && !reduce) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        hero.style.setProperty('--sp', Math.min(1, Math.max(0, (scrollY - 40) / 420)).toFixed(3));
        ticking = false;
      });
    }, { passive: true });
  }

  // Переключатель «День / Неделя / Месяц»: ползунок доезжает, потом переход
  document.querySelectorAll('.seg a').forEach(function (a, i) {
    a.addEventListener('click', function (ev) {
      var seg = a.parentNode;
      if (seg.style.getPropertyValue('--i') == i) return;
      ev.preventDefault();
      seg.style.setProperty('--i', i);
      setTimeout(function () { location.href = a.href; }, 230);
    });
  });

  // Шторки снизу: открываются пружиной, закрываются тапом по фону или смахиванием вниз
  function back(id) { return typeof id === 'string' ? document.getElementById(id) : id; }
  window.Sheet = {
    open: function (id) {
      var b = back(id); b.classList.add('open');
      document.body.style.overflow = 'hidden';
      b.dispatchEvent(new Event('sheetopen'));
    },
    close: function (id) {
      var b = back(id); if (!b.classList.contains('open')) return;
      b.classList.remove('open'); b.style.removeProperty('--drag');
      document.body.style.overflow = '';
      b.dispatchEvent(new Event('sheetclose'));
    }
  };
  document.querySelectorAll('.sheet-back').forEach(function (b) {
    var sheet = b.querySelector('.sheet'), y0 = 0, dy = 0, t0 = 0, dragging = false;
    b.addEventListener('click', function (e) { if (e.target === b) window.Sheet.close(b); });
    sheet.addEventListener('touchstart', function (e) {
      if (sheet.scrollTop > 0 || e.target.closest('input, select, textarea, video, .store-chips')) return;
      dragging = true; y0 = e.touches[0].clientY; dy = 0; t0 = Date.now();
    }, { passive: true });
    sheet.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      if (dy > 4) { sheet.classList.add('dragging'); b.style.setProperty('--drag', dy + 'px'); }
    }, { passive: true });
    sheet.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false; sheet.classList.remove('dragging');
      var fast = dy / Math.max(1, Date.now() - t0) > 0.6;
      if (dy > 120 || (fast && dy > 40)) window.Sheet.close(b); else b.style.removeProperty('--drag');
    });
  });

  // Крупная сумма подстраивает ширину под цифры
  document.querySelectorAll('.amount-input').forEach(function (inp) {
    function fit() { inp.style.width = Math.max(1.4, (inp.value || inp.placeholder || '0').length * 0.98 + 0.3) + 'ch'; }
    inp.addEventListener('input', fit); fit();
    inp.fit = fit;
  });

  // Геопозиция и магазины рядом (общие для формы и сканера)
  window.Geo = {
    pending: null,
    stores: function () {
      if (this.pending) return this.pending;
      var self = this;
      this.pending = new Promise(function (res, rej) {
        if (!navigator.geolocation) return rej('unsupported');
        navigator.geolocation.getCurrentPosition(function (p) { res(p.coords); },
          function (e) { rej(e.code === 1 ? 'denied' : 'unavailable'); },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 });
      }).then(function (c) {
        self.coords = { lat: c.latitude.toFixed(5), lon: c.longitude.toFixed(5) };
        return fetch('/api/stores?lat=' + c.latitude.toFixed(5) + '&lon=' + c.longitude.toFixed(5), { credentials: 'same-origin' })
          .then(function (r) { return r.json(); }).then(function (j) { return j.stores || []; });
      });
      this.pending.catch(function () { self.pending = null; });
      return this.pending;
    }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  window.esc = esc;
  window.renderStoreChips = function (box, stores, selected, onPick) {
    box.innerHTML = stores.map(function (s, i) {
      var d = s.distance < 1000 ? s.distance + ' м' : (s.distance / 1000).toFixed(1).replace('.', ',') + ' км';
      return '<button type="button" class="schip' + (s.name === selected ? ' on' : '') + '" style="--d:' + (i * 0.05) + 's" data-i="' + i + '">' +
        '<span class="logo" style="background:' + esc(s.color) + '">' + esc(s.name.charAt(0).toUpperCase()) + '</span>' +
        esc(s.name) + ' <small>' + d + '</small></button>';
    }).join('');
    box.querySelectorAll('.schip').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = stores[+b.getAttribute('data-i')];
        var on = !b.classList.contains('on');
        box.querySelectorAll('.schip').forEach(function (x) { x.classList.remove('on'); });
        if (on) b.classList.add('on');
        if (navigator.vibrate) navigator.vibrate(8);
        onPick(on ? s : null);
      });
    });
  };
  window.markFilled = function (el) { el.classList.remove('filled'); void el.offsetWidth; el.classList.add('filled'); };
})();
`;


// Разбор фразы: «кофе с другом 350», «вчера такси 1 200 рублей», «2 тысячи на продукты»
export const PARSE_JS = `
var VOICE_RULES = [
  ['Табак', ['сигарет', 'табак', 'вейп', 'стики', 'стиков', 'айкос', 'iqos', 'электронк', 'одноразк', 'жидкость для', 'пачк']],
  ['Еда', ['еда', 'еду', 'кофе', 'обед', 'ужин', 'завтрак', 'продукт', 'кафе', 'ресторан', 'пицц', 'бургер', 'шаурм', 'перекус', 'доставк', 'суши', 'ролл', 'чай', 'хлеб', 'молок', 'магазин', 'пятерочк', 'перекрест', 'магнит', 'вкусвилл', 'макдон', 'столов', 'фрукт', 'овощ', 'мясо', 'сладк', 'сок', 'напит']],
  ['Транспорт', ['такси', 'метро', 'автобус', 'бензин', 'заправк', 'транспорт', 'проезд', 'парковк', 'поезд', 'электричк', 'каршеринг', 'самокат', 'трамва', 'троллейбус', 'билет на', 'маршрутк']],
  ['Жильё', ['квартир', 'аренд', 'коммунал', 'жкх', 'ремонт', 'жиль', 'ипотек', 'свет за', 'газ за']],
  ['Развлечения', ['кино', 'игр', 'концерт', 'бар', 'клуб', 'развлеч', 'подписк', 'театр', 'боулинг', 'музей', 'кальян', 'стрим', 'нетфликс', 'спотифа']],
  ['Здоровье', ['аптек', 'лекарств', 'врач', 'здоров', 'стоматолог', 'зуб', 'анализ', 'спортзал', 'зал', 'таблет', 'клиник', 'витамин', 'массаж']],
  ['Одежда', ['одежд', 'кроссовк', 'футболк', 'джинс', 'куртк', 'обув', 'шопинг', 'плать', 'кофт', 'штан', 'носк', 'худи', 'рубашк', 'ботинк']]
];
var SP = '(^|\\\\s)', END = '(?=\\\\s|$|[.,!?])';
function voiceRe(body, flags) { return new RegExp(SP + '(' + body + ')' + END, flags || ''); }

function parseVoice(text, todayIso) {
  var t = ' ' + String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"]/g, ' ') + ' ';
  t = t.replace(/(\\d)\\s+(?=\\d{3}(\\D|$))/g, '$1');
  t = t.replace(voiceRe('полторы тысячи|полторы тыщи'), '$11500');
  t = t.replace(voiceRe('пол ?тысячи|пол ?тыщи'), '$1500');
  t = t.replace(/(\\d+(?:[.,]\\d+)?)\\s*(тысяч[аиу]?|тыщ[иау]?|тыс\\.?|к)(?=\\s|$|[.,!?])/g, function (_, n) {
    return String(Math.round(parseFloat(n.replace(',', '.')) * 1000));
  });
  t = t.replace(voiceRe('тысяча|тысячу|тыща|тыщу'), '$11000');

  var shift = 0;
  if (voiceRe('позавчера').test(t)) shift = -2; else if (voiceRe('вчера').test(t)) shift = -1;
  t = t.replace(voiceRe('позавчера|вчера|сегодня', 'g'), ' ');

  var amount = null;
  var m = t.match(/(\\d+(?:[.,]\\d{1,2})?)/);
  if (m) {
    amount = parseFloat(m[1].replace(',', '.'));
    t = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length);
  }
  t = t.replace(voiceRe('рубл\\\\S*|руб\\\\.?|р\\\\.?|тенге|доллар\\\\S*|бакс\\\\S*|евро|сом\\\\S*|сум\\\\S*|дирхам\\\\S*|копе\\\\S*', 'g'), ' ');
  t = t.replace(/[₽$€₸]/g, ' ');

  var category = null;
  for (var i = 0; i < VOICE_RULES.length && !category; i++) {
    for (var j = 0; j < VOICE_RULES[i][1].length; j++) {
      if (t.indexOf(' ' + VOICE_RULES[i][1][j]) !== -1) { category = VOICE_RULES[i][0]; break; }
    }
  }

  var note = t.replace(/\\s+/g, ' ').trim();
  var prev;
  do {
    prev = note;
    note = note.replace(/^(я|ну|короче|так|запиши|добавь|потратил[аи]?|заплатил[аи]?|купил[аи]?|отдал[аи]?|трата|расход)\\s+/, '');
  } while (note !== prev);
  note = note.replace(/^(на|за)\\s+/, '').replace(/\\s+(на|за|в|и)$/, '').replace(/[.,!?]+$/, '').trim();
  if (note) note = note.charAt(0).toUpperCase() + note.slice(1);

  var date = null;
  if (shift && todayIso) {
    var d = new Date(todayIso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + shift);
    date = d.toISOString().slice(0, 10);
  }
  return { amount: amount, category: category, note: note.slice(0, 255), date: date };
}
`;

// Форма на главной: быстрые действия и магазины рядом
export const DASH_JS = `
(function () {
  var form = document.getElementById('add-form');
  if (!form) return;
  var amount = form.elements['amount'];
  var manual = document.getElementById('act-manual');
  if (manual) manual.addEventListener('click', function () {
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { amount.focus(); }, 350);
  });

  var loc = document.getElementById('loc-btn'), box = document.getElementById('store-chips');
  var storeInp = form.elements['store'];
  // Вписанный вручную магазин сервер запомнит в этом месте; выбранный из подсказок — нет
  storeInp.addEventListener('input', function () { form.elements['store_src'].value = storeInp.value.trim() ? 'typed' : ''; });
  form.addEventListener('submit', function () {
    var c = window.Geo.coords;
    if (c) { form.elements['lat'].value = c.lat; form.elements['lon'].value = c.lon; }
  });
  if (loc) loc.addEventListener('click', function () {
    box.innerHTML = '<span class="schip skeleton"></span><span class="schip skeleton"></span><span class="schip skeleton"></span>';
    window.Geo.stores().then(function (stores) {
      if (!stores.length) { box.innerHTML = ''; storeInp.placeholder = 'Рядом ничего не нашлось'; return; }
      window.renderStoreChips(box, stores, storeInp.value, function (s) {
        storeInp.value = s ? s.name : '';
        form.elements['store_src'].value = s ? 'chip' : '';
        window.markFilled(storeInp);
        if (s && s.category) { form.elements['category'].value = s.category; window.markFilled(form.elements['category']); }
      });
    }).catch(function (e) {
      box.innerHTML = '';
      storeInp.placeholder = e === 'denied' ? 'Нет доступа к геопозиции' : 'Не удалось определить место';
    });
  });
})();
`;

// Голосовой ввод + эквалайзер по реальному звуку с микрофона
export const VOICE_JS = `
(function () {
  var btn = document.getElementById('act-voice');
  if (!btn) return;
  var back = document.getElementById('voice');
  var canvas = document.getElementById('eq');
  var textEl = document.getElementById('voice-text');
  var statusEl = document.getElementById('voice-status');
  var hintEl = document.getElementById('voice-hint');
  var stopBtn = document.getElementById('voice-stop');
  var stopLabel = stopBtn.querySelector('span');
  var cancelBtn = document.getElementById('voice-cancel');
  var form = document.getElementById('add-form');
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  var rec = null, stream = null, actx = null, analyser = null, freq = null, raf = 0;
  var finalText = '', interim = '', errorCode = '', listening = false, retried = false, retry = false;
  var speaking = 0, bars = [], N = 15;
  for (var i = 0; i < N; i++) bars.push(0);
  var esc = window.esc;

  function setStatus(txt, recDot) { statusEl.innerHTML = (recDot ? '<span class="rec"></span>' : '') + esc(txt); }
  function renderText() {
    if (!finalText && !interim) { textEl.innerHTML = '<span class="interim">Говори…</span>'; return; }
    textEl.innerHTML = esc(finalText) + '<span class="interim">' + esc(interim) + '</span>';
  }
  function setStop(label, isRetry) { stopLabel.textContent = label; retry = isRetry; }

  function stopStream() {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null; analyser = null;
  }
  function cleanup() {
    listening = false;
    stopStream();
    if (actx && actx.state !== 'closed') { try { actx.close(); } catch (e) {} }
    actx = null;
  }

  function startMeter() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try { actx = new AC(); if (actx.resume) actx.resume(); } catch (e) { return; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (s) {
      if (!listening) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      var src = actx.createMediaStreamSource(s);
      analyser = actx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.75;
      src.connect(analyser);
      freq = new Uint8Array(analyser.frequencyBinCount);
    }).catch(function () {});
  }

  function startRecognition() {
    var r = new SR();
    rec = r;
    r.lang = 'ru-RU';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = function (e) {
      if (rec !== r) return;
      interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += tr; else interim += tr;
      }
      speaking = 1;
      renderText();
    };
    r.onspeechstart = r.onsoundstart = function () { speaking = 1; };
    r.onerror = function (e) {
      if (rec !== r) return;
      // Некоторые браузеры не дают одновременно слушать микрофон и распознавать речь
      if (e.error === 'audio-capture' && stream && !retried) {
        retried = true; stopStream();
        startRecognition();
        return;
      }
      errorCode = e.error;
    };
    r.onend = function () { if (rec === r) finish(); };
    try { r.start(); } catch (e) { errorCode = 'start'; finish(); }
  }

  function start() {
    finalText = ''; interim = ''; errorCode = ''; retried = false; speaking = 0;
    renderText();
    setStop('Готово', false);
    stopBtn.style.display = '';
    hintEl.textContent = 'Например: «кофе с другом 350» или «вчера такси 1200»';
    window.Sheet.open(back);
    if (!SR) {
      setStatus('Голосовой ввод недоступен');
      textEl.innerHTML = '<span class="interim">Этот браузер не умеет распознавать речь. Открой сайт в Safari или Chrome.</span>';
      stopBtn.style.display = 'none';
      return;
    }
    listening = true;
    setStatus('Слушаю…', true);
    startRecognition();
    startMeter();
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function finish() {
    var text = (finalText + ' ' + interim).trim();
    cleanup();
    rec = null;
    if (!back.classList.contains('open')) return;
    if (!text) {
      var msg = {
        'not-allowed': 'Нет доступа к микрофону — разреши его в настройках браузера',
        'service-not-allowed': 'Распознавание речи выключено в настройках телефона',
        'network': 'Нет связи с сервером распознавания',
        'audio-capture': 'Микрофон не найден'
      }[errorCode] || 'Ничего не услышал — попробуй ещё раз';
      setStatus(msg);
      textEl.innerHTML = '<span class="interim">Нажми «Ещё раз» и говори сразу</span>';
      setStop('Ещё раз', true);
      return;
    }
    var p = parseVoice(text, form.getAttribute('data-today'));
    var amountEl = form.elements['amount'], catEl = form.elements['category'];
    var noteEl = form.elements['note'], dateEl = form.elements['expense_date'];
    if (p.amount !== null) { amountEl.value = String(p.amount).replace('.', ','); if (amountEl.fit) amountEl.fit(); window.markFilled(amountEl); }
    if (p.category) { catEl.value = p.category; window.markFilled(catEl); }
    if (p.note) { noteEl.value = p.note; window.markFilled(noteEl); }
    if (p.date) { dateEl.value = p.date; window.markFilled(dateEl); }
    setStatus(p.amount !== null ? 'Готово ✓' : 'Сумму не расслышал — впиши её вручную');
    setTimeout(function () {
      window.Sheet.close(back);
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, p.amount !== null ? 650 : 1600);
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    if (!back.classList.contains('open')) { cancelAnimationFrame(raf); raf = 0; return; }
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    var now = performance.now() / 1000;
    var targets = [];
    if (analyser && freq) {
      analyser.getByteFrequencyData(freq);
      var binHz = actx.sampleRate / analyser.fftSize;
      for (var i = 0; i < N; i++) {
        // Полосы по логарифмической шкале от 90 Гц до 5 кГц — там живёт голос
        var f0 = 90 * Math.pow(5000 / 90, i / N), f1 = 90 * Math.pow(5000 / 90, (i + 1) / N);
        var b0 = Math.max(1, Math.floor(f0 / binHz)), b1 = Math.max(b0 + 1, Math.ceil(f1 / binHz));
        var sum = 0;
        for (var b = b0; b < b1 && b < freq.length; b++) sum += freq[b];
        targets.push(Math.min(1, Math.pow(sum / (b1 - b0) / 255, 1.4) * 1.5));
      }
    } else {
      // Без доступа к звуку — мягкая анимация по событиям распознавания
      speaking *= 0.97;
      for (var k = 0; k < N; k++) {
        var wob = 0.5 + 0.5 * Math.sin(now * (5 + k * 0.7) + k * 1.3) * Math.sin(now * 2.3 + k);
        targets.push(listening ? 0.06 + speaking * (0.25 + 0.6 * wob * (1 - k / N * 0.6)) : 0);
      }
    }
    for (var n = 0; n < N; n++) {
      var tv = targets[n] || 0;
      bars[n] = tv > bars[n] ? bars[n] + (tv - bars[n]) * 0.55 : bars[n] * 0.9 + tv * 0.1;
    }

    // Симметричный эквалайзер: низкие частоты в центре, высокие по краям
    var total = N * 2, gap = Math.max(3, w / total * 0.38), bw = (w - gap * (total - 1)) / total;
    var mid = h / 2;
    var grad = c.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#4fd6c7'); grad.addColorStop(0.5, '#a194ff'); grad.addColorStop(1, '#4fd6c7');
    c.fillStyle = grad;
    c.shadowColor = 'rgba(142,129,255,0.5)';
    c.shadowBlur = 14;
    for (var s = 0; s < total; s++) {
      var idx = s < N ? N - 1 - s : s - N;
      var bh = Math.max(4, bars[idx] * (h - 10));
      var x = s * (bw + gap), y = mid - bh / 2, r = Math.min(bw / 2, bh / 2);
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + bw, y, x + bw, y + bh, r);
      c.arcTo(x + bw, y + bh, x, y + bh, r);
      c.arcTo(x, y + bh, x, y, r);
      c.arcTo(x, y, x + bw, y, r);
      c.closePath();
      c.fill();
    }
  }

  btn.addEventListener('click', start);
  stopBtn.addEventListener('click', function () {
    if (retry) { start(); return; }
    if (rec) { setStatus('Распознаю…'); try { rec.stop(); } catch (e) { finish(); } }
    else window.Sheet.close(back);
  });
  cancelBtn.addEventListener('click', function () { window.Sheet.close(back); });
  // Закрыли шторку любым способом — останавливаем распознавание и микрофон
  back.addEventListener('sheetclose', function () {
    var r = rec; rec = null;
    if (r) { try { r.abort(); } catch (e) {} }
    cleanup();
  });
})();
`;

// Сканер штрих-кодов: камера → товар из базы → магазин рядом по геопозиции → цена из истории покупок
export const SCAN_JS = `
(function () {
  var openBtn = document.getElementById('act-scan');
  if (!openBtn) return;
  var back = document.getElementById('scan');
  var vf = document.getElementById('vf'), video = document.getElementById('scan-video'), msg = document.getElementById('vf-msg');
  var snap = document.getElementById('scan-snap');
  var result = document.getElementById('scan-result'), prodEl = document.getElementById('scan-product'), pricesEl = document.getElementById('scan-prices');
  var amountEl = document.getElementById('scan-amount'), catEl = document.getElementById('scan-cat'), nameEl = document.getElementById('scan-name');
  var storeEl = document.getElementById('scan-store'), storesBox = document.getElementById('scan-stores');
  var addBtn = document.getElementById('scan-add'), againBtn = document.getElementById('scan-again');
  var manualToggle = document.getElementById('scan-manual-toggle'), manualBox = document.getElementById('scan-manual');
  var codeInp = document.getElementById('scan-code'), codeGo = document.getElementById('scan-code-go');
  var form = document.getElementById('add-form');
  var sym = form.getAttribute('data-sym');
  var esc = window.esc;
  var FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'data_matrix'];
  var torchBtn = document.getElementById('scan-torch'), torchOn = false;
  // Код → штрих-код товара. В DataMatrix «Честного знака» (сигареты, пиво) после 01 идёт GTIN-14 с EAN-13 внутри
  function toCode(raw) {
    var s = String(raw).replace(/[\\x1d\\s]/g, '');
    if (/^\\d{8,14}$/.test(s)) return s;
    var m = s.match(/^\\(?01\\)?(\\d{14})/);
    if (!m) return null;
    return m[1].charAt(0) === '0' ? m[1].slice(1) : m[1];
  }
  var BOX_SVG = '<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>';

  var stream = null, detector = null, timer = 0, busy = false, code = null;
  var product = null, prices = { mine: [], stores: [] }, stores = [], selStore = null, amountTouched = false;

  function setMsg(t) { msg.textContent = t || ''; }
  function money(n) { return Math.round(n).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '\\u202f') + ' ' + sym; }
  function shortDate(iso) {
    var m = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return (+iso.slice(8, 10)) + ' ' + m[+iso.slice(5, 7) - 1];
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  // Встроенный распознаватель есть в Chrome на Android; для iPhone подгружаем свой (ZXing, WebAssembly)
  function getDetector() {
    if (detector) return Promise.resolve(detector);
    var nativeP = 'BarcodeDetector' in window
      ? window.BarcodeDetector.getSupportedFormats().then(function (f) {
          return f.indexOf('ean_13') !== -1 ? new window.BarcodeDetector({ formats: FORMATS.filter(function (x) { return f.indexOf(x) !== -1; }) }) : null;
        }).catch(function () { return null; })
      : Promise.resolve(null);
    return nativeP.then(function (d) {
      if (d) return d;
      return loadScript('/vendor/barcode-detector.js').then(function () {
        var api = window.BarcodeDetectionAPI;
        api.prepareZXingModule({ overrides: { locateFile: function (p, prefix) { return /\\.wasm$/.test(p) ? '/vendor/' + p : prefix + p; } } });
        return new api.BarcodeDetector({ formats: FORMATS });
      });
    }).then(function (d) { detector = d; return d; });
  }

  function setTorch(on) { torchOn = on; torchBtn.classList.toggle('on', on); }
  // Вспышка включается только кнопкой. Safari и Chrome поддерживают её не на всех телефонах
  torchBtn.addEventListener('click', function () {
    var track = stream && stream.getVideoTracks()[0];
    if (!track || !track.applyConstraints) return;
    var want = !torchOn;
    track.applyConstraints({ advanced: [{ torch: want }] }).then(function () {
      var st = track.getSettings ? track.getSettings() : {};
      if (want && st.torch === false) throw new Error('no torch');
      setTorch(want);
      if (navigator.vibrate) navigator.vibrate(10);
    }).catch(function () {
      setTorch(false);
      setMsg('Вспышка недоступна в этом браузере');
      setTimeout(function () { setMsg(code || 'Наведи камеру на штрих-код'); }, 2000);
    });
  });

  function stopCamera() {
    setTorch(false);
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null; video.srcObject = null; busy = false;
  }
  function startCamera() {
    setMsg('Наведи камеру на штрих-код');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMsg('Камера недоступна'); manualBox.hidden = false; return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(function (s) {
        if (!back.classList.contains('open') || code) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; video.srcObject = s;
        var pl = video.play(); if (pl && pl.catch) pl.catch(function () {});
        return getDetector().then(loop).catch(function () { setMsg('Не удалось запустить сканер'); manualBox.hidden = false; });
      })
      .catch(function (e) {
        setMsg(e && e.name === 'NotAllowedError' ? 'Нет доступа к камере — разреши её в настройках' : 'Камера недоступна');
        manualBox.hidden = false;
      });
  }
  function loop() {
    timer = setTimeout(function () {
      if (!stream || code) return;
      if (video.readyState < 2 || busy) return loop();
      busy = true;
      detector.detect(video).then(function (codes) {
        busy = false;
        var hit = null;
        for (var i = 0; i < codes.length && !hit; i++) hit = toCode(codes[i].rawValue);
        if (hit) onCode(hit); else loop();
      }).catch(function () { busy = false; loop(); });
    }, 140);
  }

  function onCode(c) {
    if (code) return;
    code = c;
    if (navigator.vibrate) navigator.vibrate(35);
    vf.classList.add('hit');
    setMsg(c);
    if (video.videoWidth) {
      snap.width = video.videoWidth; snap.height = video.videoHeight;
      snap.getContext('2d').drawImage(video, 0, 0);
      snap.hidden = false;
    }
    setTimeout(function () { stopCamera(); vf.classList.add('done'); }, 420);
    manualBox.hidden = true; manualToggle.hidden = true;
    result.hidden = false;
    prodEl.innerHTML = '<div class="pic none">' + BOX_SVG + '</div><div><div class="pn">Ищу товар…</div><div class="pb">' + esc(c) + '</div></div>';
    fetch('/api/product/' + c, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      product = j.product; prices = j.prices || prices;
    }).catch(function () {
      product = { barcode: c, found: false };
    }).then(function () { renderProduct(); updatePrice(); });
  }

  function renderProduct() {
    var p = product;
    var title = p.found ? (p.name || p.brand) : 'Товар не найден';
    var sub = p.found ? [p.name && p.brand ? p.brand : null, p.quantity].filter(Boolean).join(' · ') : 'Впиши название — запомню его для этого кода';
    var pic = p.image ? '<div class="pic" style="background-image:url(&quot;' + esc(p.image) + '&quot;)"></div>' : '<div class="pic none">' + BOX_SVG + '</div>';
    prodEl.innerHTML = pic + '<div style="min-width:0"><div class="pn">' + esc(title) + '</div><div class="pb">' + esc(sub || p.barcode) + '</div></div>';
    nameEl.value = p.found ? [p.name || p.brand, p.quantity].filter(Boolean).join(' ') : '';
    if (p.category) catEl.value = p.category;
    if (!p.found) setTimeout(function () { nameEl.focus(); }, 300);
  }

  function updatePrice() {
    var lines = [], suggest = null;
    var mine = prices.mine || [], all = prices.stores || [];
    var here = selStore ? all.filter(function (s) { return s.store === selStore.name; })[0] : null;
    var mineHere = selStore ? mine.filter(function (m) { return m.store === selStore.name; })[0] : null;
    if (mine[0]) lines.push('В прошлый раз — <b>' + money(mine[0].amount) + '</b> · ' + (mine[0].store ? esc(mine[0].store) + ', ' : '') + shortDate(mine[0].date));
    if (here) lines.push(esc(here.store) + ': обычно <b>' + money(here.avg) + '</b>' + (here.n > 1 ? ' · покупок: ' + here.n : ''));
    var others = all.filter(function (s) { return s.store && (!selStore || s.store !== selStore.name); }).slice(0, 3);
    if (others.length) lines.push('Рядом: ' + others.map(function (s) { return esc(s.store) + ' <b>' + money(s.avg) + '</b>'; }).join(' · '));
    pricesEl.innerHTML = lines.join('<br>');
    pricesEl.hidden = !lines.length;
    suggest = mineHere ? mineHere.amount : here ? here.avg : mine[0] ? mine[0].amount : null;
    if (suggest !== null && !amountTouched) {
      amountEl.value = String(Math.round(suggest * 100) / 100).replace('.', ',');
      if (amountEl.fit) amountEl.fit();
      window.markFilled(amountEl);
    }
  }

  function loadStores() {
    storesBox.innerHTML = '<span class="schip skeleton"></span><span class="schip skeleton"></span>';
    window.Geo.stores().then(function (list) {
      stores = list;
      if (!list.length) { storesBox.innerHTML = ''; return; }
      // Ближайший магазин в пределах 150 м выбираем сразу: скорее всего, покупка оттуда
      if (!selStore && list[0].distance <= 150) { selStore = list[0]; storeEl.value = selStore.name; }
      window.renderStoreChips(storesBox, list, selStore && selStore.name, function (s) {
        selStore = s; storeEl.value = s ? s.name : '';
        if (s && s.category && !(product && product.category)) catEl.value = s.category;
        if (product) updatePrice();
      });
      if (product) updatePrice();
    }).catch(function (e) {
      storesBox.innerHTML = '';
      storeEl.placeholder = e === 'denied' ? 'Нет доступа к геопозиции' : 'Магазин';
    });
  }

  function reset() {
    stopCamera();
    code = null; product = null; prices = { mine: [], stores: [] }; amountTouched = false;
    vf.classList.remove('hit', 'done');
    snap.hidden = true;
    result.hidden = true; manualBox.hidden = true; manualToggle.hidden = false;
    amountEl.value = ''; if (amountEl.fit) amountEl.fit();
    nameEl.value = ''; pricesEl.innerHTML = '';
  }

  openBtn.addEventListener('click', function () {
    reset();
    selStore = null; storeEl.value = ''; catEl.value = 'Еда';
    window.Sheet.open(back);
    startCamera();
    loadStores();
  });
  againBtn.addEventListener('click', function () { reset(); startCamera(); });
  back.addEventListener('sheetclose', stopCamera);
  amountEl.addEventListener('input', function () { amountTouched = true; });
  manualToggle.addEventListener('click', function () { manualBox.hidden = false; codeInp.focus(); });
  codeGo.addEventListener('click', function () {
    var v = codeInp.value.replace(/\\D/g, '');
    if (/^\\d{8,14}$/.test(v)) onCode(v); else window.markFilled(codeInp);
  });

  addBtn.addEventListener('click', function () {
    if (!amountEl.value.trim()) { amountEl.focus(); window.markFilled(amountEl); return; }
    form.elements['amount'].value = amountEl.value;
    form.elements['category'].value = catEl.value;
    form.elements['note'].value = nameEl.value.trim();
    form.elements['store'].value = storeEl.value.trim();
    form.elements['store_src'].value = storeEl.value.trim() && !(selStore && selStore.name === storeEl.value.trim()) ? 'typed' : 'chip';
    var c = window.Geo.coords;
    if (c) { form.elements['lat'].value = c.lat; form.elements['lon'].value = c.lon; }
    form.elements['barcode'].value = code || '';
    form.elements['expense_date'].value = form.getAttribute('data-today');
    addBtn.disabled = true;
    form.submit();
  });
})();
`;

// Страница-презентация: текст «проявляется» по мере прокрутки, телефон выпрямляется
export const LANDING_JS = `
(function () {
  var scrubs = [].slice.call(document.querySelectorAll('.scrub'));
  var device = document.querySelector('.device');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame() {
    var vh = window.innerHeight;
    scrubs.forEach(function (el) {
      var words = el.children, r = el.getBoundingClientRect();
      var p = reduce ? 1 : Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      var lit = Math.round(p * words.length);
      for (var i = 0; i < words.length; i++) words[i].classList.toggle('lit', i < lit);
    });
    if (device) {
      var d = device.getBoundingClientRect();
      device.style.setProperty('--p', reduce ? 1 : Math.min(1, Math.max(0, 1 - (d.top - vh * 0.2) / (vh * 0.55))).toFixed(3));
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { frame(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', frame);
  frame();
})();
`;

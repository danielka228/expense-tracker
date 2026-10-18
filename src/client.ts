// Скрипты, которые выполняются в браузере. Хранятся строками и вставляются в страницу.

// Общие эффекты: исчезающие уведомления и «докручивание» чисел
export const COMMON_JS = `
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.flash').forEach(function (el) {
    setTimeout(function () { el.classList.add('hide'); }, 3500);
  });
  function fmt(n) { return Math.round(n).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '\\u202f'); }
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    if (reduce || target === 0) return;
    var t0 = null, dur = 900;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(step); else el.textContent = el.getAttribute('data-final');
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  });
})();
`;

// Разбор фразы: «кофе с другом 350», «вчера такси 1 200 рублей», «2 тысячи на продукты»
export const PARSE_JS = `
var VOICE_RULES = [
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

// Голосовой ввод + эквалайзер по реальному звуку с микрофона
export const VOICE_JS = `
(function () {
  var btn = document.getElementById('mic-btn');
  if (!btn) return;
  var back = document.getElementById('voice');
  var canvas = document.getElementById('eq');
  var textEl = document.getElementById('voice-text');
  var statusEl = document.getElementById('voice-status');
  var hintEl = document.getElementById('voice-hint');
  var stopBtn = document.getElementById('voice-stop');
  var cancelBtn = document.getElementById('voice-cancel');
  var form = document.getElementById('add-form');
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  var rec = null, stream = null, actx = null, analyser = null, freq = null, raf = 0;
  var finalText = '', interim = '', errorCode = '', listening = false, simulated = false, retried = false;
  var speaking = 0, bars = [], N = 15;
  for (var i = 0; i < N; i++) bars.push(0);

  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function setStatus(txt, rec) {
    statusEl.innerHTML = (rec ? '<span class="rec"></span>' : '') + esc(txt);
  }
  function renderText() {
    if (!finalText && !interim) { textEl.innerHTML = '<span class="interim">Говори…</span>'; return; }
    textEl.innerHTML = esc(finalText) + '<span class="interim">' + esc(interim) + '</span>';
  }
  function openSheet() { back.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeSheet() { back.classList.remove('open'); document.body.style.overflow = ''; }

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
    if (!AC || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { simulated = true; return; }
    try { actx = new AC(); actx.resume && actx.resume(); } catch (e) { simulated = true; return; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (s) {
      if (!listening) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      var src = actx.createMediaStreamSource(s);
      analyser = actx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.75;
      src.connect(analyser);
      freq = new Uint8Array(analyser.frequencyBinCount);
    }).catch(function () { simulated = true; });
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
        retried = true; stopStream(); simulated = true;
        startRecognition();
        return;
      }
      errorCode = e.error;
    };
    r.onend = function () { if (rec === r) finish(); };
    try { r.start(); } catch (e) { errorCode = 'start'; finish(); }
  }

  function start() {
    finalText = ''; interim = ''; errorCode = ''; simulated = false; retried = false; speaking = 0;
    renderText();
    stopBtn.style.display = '';
    hintEl.textContent = 'Например: «кофе с другом 350» или «вчера такси 1200»';
    openSheet();
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
    if (!text) {
      var msg = {
        'not-allowed': 'Нет доступа к микрофону — разреши его в настройках браузера',
        'service-not-allowed': 'Распознавание речи выключено в настройках телефона',
        'network': 'Не получилось распознать: нет связи с сервером распознавания',
        'audio-capture': 'Микрофон не найден'
      }[errorCode] || 'Ничего не услышал — попробуй ещё раз';
      setStatus(msg);
      textEl.innerHTML = '<span class="interim">Нажми «Ещё раз» и говори сразу после сигнала</span>';
      stopBtn.style.display = '';
      stopBtn.lastChild.textContent = 'Ещё раз';
      stopBtn.dataset.mode = 'retry';
      return;
    }
    var p = parseVoice(text, form.getAttribute('data-today'));
    var amountEl = form.elements['amount'], catEl = form.elements['category'];
    var noteEl = form.elements['note'], dateEl = form.elements['expense_date'];
    function mark(el) { el.classList.remove('filled'); void el.offsetWidth; el.classList.add('filled'); }
    if (p.amount !== null) { amountEl.value = String(p.amount).replace('.', ','); mark(amountEl); }
    if (p.category) { catEl.value = p.category; mark(catEl); }
    if (p.note) { noteEl.value = p.note; mark(noteEl); }
    if (p.date) { dateEl.value = p.date; mark(dateEl); }
    setStatus(p.amount !== null ? 'Готово ✓' : 'Сумму не расслышал — впиши её вручную');
    setTimeout(function () {
      closeSheet();
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, p.amount !== null ? 700 : 1600);
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
        var v = sum / (b1 - b0) / 255;
        targets.push(Math.min(1, Math.pow(v, 1.4) * 1.5));
      }
    } else {
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
    var mid = h / 2, minH = 4;
    var grad = c.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#45d4c4'); grad.addColorStop(0.5, '#8b7bff'); grad.addColorStop(1, '#45d4c4');
    c.fillStyle = grad;
    c.shadowColor = 'rgba(139,123,255,0.55)';
    c.shadowBlur = 16;
    for (var s = 0; s < total; s++) {
      var idx = s < N ? N - 1 - s : s - N;
      var bh = Math.max(minH, bars[idx] * (h - 10));
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
    if (stopBtn.dataset.mode === 'retry') {
      stopBtn.dataset.mode = '';
      stopBtn.lastChild.textContent = 'Готово';
      start();
      return;
    }
    if (rec) { setStatus('Распознаю…'); try { rec.stop(); } catch (e) { finish(); } }
    else closeSheet();
  });
  function cancel() {
    var r = rec; rec = null;
    if (r) { try { r.abort(); } catch (e) {} }
    cleanup();
    stopBtn.dataset.mode = '';
    stopBtn.lastChild.textContent = 'Готово';
    closeSheet();
  }
  cancelBtn.addEventListener('click', cancel);
  back.addEventListener('click', function (e) { if (e.target === back) cancel(); });
})();
`;

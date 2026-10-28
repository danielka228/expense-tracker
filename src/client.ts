import { CATEGORY_RULES, parseExpense } from './parse';

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
      var d = s.distance < 1000 ? s.distance + ' ' + T.m : (s.distance / 1000).toFixed(1).replace('.', T.dec) + ' ' + T.km;
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
// Тот же разбор, что у Telegram-бота (src/parse.ts), — исходным текстом функции
export const PARSE_JS = `
var VOICE_RULES = ${JSON.stringify(CATEGORY_RULES)};
var parseExpense = ${parseExpense.toString()};
function parseVoice(text, todayIso) { return parseExpense(text, todayIso, VOICE_RULES); }
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
      if (!stores.length) { box.innerHTML = ''; storeInp.placeholder = T.noStores; return; }
      window.renderStoreChips(box, stores, storeInp.value, function (s) {
        storeInp.value = s ? s.name : '';
        form.elements['store_src'].value = s ? 'chip' : '';
        window.markFilled(storeInp);
        if (s && s.category) { form.elements['category'].value = s.category; window.markFilled(form.elements['category']); }
      });
    }).catch(function (e) {
      box.innerHTML = '';
      storeInp.placeholder = e === 'denied' ? T.geoDenied : T.geoFail;
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
    if (!finalText && !interim) { textEl.innerHTML = '<span class="interim">' + esc(T.speak) + '</span>'; return; }
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
    r.lang = T.speechLang;
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
    setStop(T.done, false);
    stopBtn.style.display = '';
    hintEl.textContent = T.voiceEg;
    window.Sheet.open(back);
    if (!SR) {
      setStatus(T.voiceOff);
      textEl.innerHTML = '<span class="interim">' + esc(T.voiceNoBrowser) + '</span>';
      stopBtn.style.display = 'none';
      return;
    }
    listening = true;
    setStatus(T.listening, true);
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
        'not-allowed': T.errMic,
        'service-not-allowed': T.errSvc,
        'network': T.errNet,
        'audio-capture': T.errCap
      }[errorCode] || T.errNone;
      setStatus(msg);
      textEl.innerHTML = '<span class="interim">' + esc(T.retryHint) + '</span>';
      setStop(T.again, true);
      return;
    }
    var p = parseVoice(text, form.getAttribute('data-today'));
    var amountEl = form.elements['amount'], catEl = form.elements['category'];
    var noteEl = form.elements['note'], dateEl = form.elements['expense_date'];
    if (p.amount !== null) { amountEl.value = String(p.amount).replace('.', ','); if (amountEl.fit) amountEl.fit(); window.markFilled(amountEl); }
    if (p.category) { catEl.value = p.category; window.markFilled(catEl); }
    if (p.note) { noteEl.value = p.note; window.markFilled(noteEl); }
    if (p.date) { dateEl.value = p.date; window.markFilled(dateEl); }
    setStatus(p.amount !== null ? T.doneTick : T.noAmount);
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
    if (rec) { setStatus(T.recognizing); try { rec.stop(); } catch (e) { finish(); } }
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
  var photoBox = document.getElementById('scan-photo-box'), photoBtn = document.getElementById('scan-photo');
  var photoFile = document.getElementById('scan-photo-file'), photoMsg = document.getElementById('scan-photo-msg');
  var aiOn = false;
  var form = document.getElementById('add-form');
  var sym = form.getAttribute('data-sym');
  var esc = window.esc;
  var FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'data_matrix'];
  var torchBtn = document.getElementById('scan-torch'), torchOn = false;
  // Код со сканера → штрих-код товара. Понимает обычные штрих-коды и DataMatrix «Честного знака»:
  //  • пачка сигарет — 29 символов: 14 цифр GTIN, серийный номер, код цены, проверка;
  //  • блок, пиво, вода — GS1: 01 + GTIN-14, у табака ещё 8005 + МРЦ в копейках
  function gtinToEan(g) {
    if (/^0{6}/.test(g)) return g.slice(6);
    return g.charAt(0) === '0' ? g.slice(1) : g;
  }
  function toCode(raw) {
    var s = String(raw).replace(/[\\x1d\\s]/g, '');
    var gs = String(raw);
    if (/^\\d{8,14}$/.test(s)) return { code: s.length === 14 ? gtinToEan(s) : s };
    if (s.length === 29 && /^\\d{14}/.test(s) && !/^\\d{29}$/.test(s)) return { code: gtinToEan(s.slice(0, 14)), tobacco: true };
    var m = s.match(/^\\(?01\\)?(\\d{14})/);
    if (!m) return null;
    var res = { code: gtinToEan(m[1]) };
    // МРЦ ищем после серийного номера (AI 21), он отделён символом GS
    var mrp = gs.match(/(?:\\x1d|\\()8005\\)?(\\d{6})/);
    if (mrp) { res.tobacco = true; res.mrp = parseInt(mrp[1], 10) / 100; }
    return res;
  }
  var BOX_SVG = '<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>';

  var stream = null, detector = null, timer = 0, busy = false, code = null, meta = {};
  var product = null, prices = { mine: [], stores: [] }, stores = [], selStore = null, amountTouched = false;

  function setMsg(t) { msg.textContent = t || ''; }
  function money(n) { return Math.round(n).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '\\u202f') + ' ' + sym; }
  function shortDate(iso) {
    var mon = T.months[+iso.slice(5, 7) - 1], day = +iso.slice(8, 10);
    return LANG === 'en' ? mon + ' ' + day : day + ' ' + mon;
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
      setMsg(T.torchNo);
      setTimeout(function () { setMsg(code || T.pointCam); }, 2000);
    });
  });

  function stopCamera() {
    setTorch(false);
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null; video.srcObject = null; busy = false;
  }
  function startCamera() {
    setMsg(T.pointCam);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMsg(T.camNo); manualBox.hidden = false; return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(function (s) {
        if (!back.classList.contains('open') || code) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; video.srcObject = s;
        var pl = video.play(); if (pl && pl.catch) pl.catch(function () {});
        return getDetector().then(loop).catch(function () { setMsg(T.scanFail); manualBox.hidden = false; });
      })
      .catch(function (e) {
        setMsg(e && e.name === 'NotAllowedError' ? T.camDenied : T.camNo);
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
        if (hit) onCode(hit.code, hit); else loop();
      }).catch(function () { busy = false; loop(); });
    }, 140);
  }

  function onCode(c, m) {
    if (code) return;
    code = c;
    meta = m || {};
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
    prodEl.innerHTML = '<div class="pic none">' + BOX_SVG + '</div><div><div class="pn">' + esc(T.searching) + '</div><div class="pb">' + esc(c) + '</div></div>';
    fetch('/api/product/' + c, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      product = j.product; prices = j.prices || prices; aiOn = !!j.ai;
    }).catch(function () {
      product = { barcode: c, found: false };
    }).then(function () { renderProduct(); updatePrice(); });
  }

  function renderProduct() {
    var p = product;
    var title = p.found ? (p.name || p.brand) : T.notFound;
    var sub = p.found ? [p.name && p.brand ? p.brand : null, p.quantity].filter(Boolean).join(' · ') : T.typeName;
    var pic = p.image ? '<div class="pic" style="background-image:url(&quot;' + esc(p.image) + '&quot;)"></div>' : '<div class="pic none">' + BOX_SVG + '</div>';
    prodEl.innerHTML = pic + '<div style="min-width:0"><div class="pn">' + esc(title) + '</div><div class="pb">' + esc(sub || p.barcode) + '</div></div>';
    nameEl.value = p.found ? [p.name || p.brand, p.quantity].filter(Boolean).join(' ') : '';
    nameEl.placeholder = meta.tobacco ? T.nameEg : T.whatBought;
    // Код с пачки однозначно говорит, что это табак — категорию ставим сами
    if (p.category) catEl.value = p.category; else if (meta.tobacco) catEl.value = 'Табак';
    // Нет ни в одной базе — можно сфотографировать упаковку, ИИ подскажет название
    photoBox.hidden = p.found || !aiOn;
    photoMsg.hidden = true;
    photoBtn.disabled = false;
    if (!p.found && !aiOn) setTimeout(function () { nameEl.focus(); }, 300);
  }

  // Фото уменьшаем до 800 px по длинной стороне: так быстрее уходит и дешевле разбирается
  function shrinkPhoto(file) {
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 800 / Math.max(img.width, img.height));
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? ok(b) : no(); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(); };
      img.src = url;
    });
  }

  function say(text, bad) { photoMsg.textContent = text; photoMsg.hidden = false; photoMsg.classList.toggle('bad', !!bad); }

  photoBtn.addEventListener('click', function () { photoFile.value = ''; photoFile.click(); });
  photoFile.addEventListener('change', function () {
    var f = photoFile.files && photoFile.files[0];
    if (!f || !code) return;
    photoBtn.disabled = true; say(T.looking);
    var mine = code;
    shrinkPhoto(f).then(function (blob) {
      return fetch('/api/product/' + mine + '/photo', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, credentials: 'same-origin' });
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (mine !== code) return;
      photoBtn.disabled = false;
      if (j.ok) {
        nameEl.value = j.name; catEl.value = j.category;
        say(T.looksLike.replace('%s', j.name));
      } else if (j.error === 'limit') {
        say(T.photoLimit, true);
      } else {
        say(T.photoUnknown, true);
      }
      if (!j.ok) nameEl.focus();
    }).catch(function () {
      photoBtn.disabled = false; say(T.photoSendFail, true); nameEl.focus();
    });
  });

  function updatePrice() {
    var lines = [], suggest = null;
    var mine = prices.mine || [], all = prices.stores || [];
    var here = selStore ? all.filter(function (s) { return s.store === selStore.name; })[0] : null;
    var mineHere = selStore ? mine.filter(function (m) { return m.store === selStore.name; })[0] : null;
    if (mine[0]) lines.push(esc(T.lastTime) + ' — <b>' + money(mine[0].amount) + '</b> · ' + (mine[0].store ? esc(mine[0].store) + ', ' : '') + shortDate(mine[0].date));
    if (here) lines.push(esc(here.store) + ': ' + esc(T.usually) + ' <b>' + money(here.avg) + '</b>' + (here.n > 1 ? ' · ' + esc(T.purchases) + ': ' + here.n : ''));
    var others = all.filter(function (s) { return s.store && (!selStore || s.store !== selStore.name); }).slice(0, 3);
    if (others.length) lines.push(esc(T.nearby) + ': ' + others.map(function (s) { return esc(s.store) + ' <b>' + money(s.avg) + '</b>'; }).join(' · '));
    if (meta.mrp) lines.push(esc(T.mrp) + ' — <b>' + money(meta.mrp) + '</b>');
    pricesEl.innerHTML = lines.join('<br>');
    pricesEl.hidden = !lines.length;
    suggest = mineHere ? mineHere.amount : here ? here.avg : mine[0] ? mine[0].amount : meta.mrp || null;
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
      storeEl.placeholder = e === 'denied' ? T.geoDenied : T.store;
    });
  }

  function reset() {
    stopCamera();
    code = null; meta = {}; product = null; prices = { mine: [], stores: [] }; amountTouched = false;
    vf.classList.remove('hit', 'done');
    snap.hidden = true;
    result.hidden = true; manualBox.hidden = true; manualToggle.hidden = false;
    amountEl.value = ''; if (amountEl.fit) amountEl.fit();
    nameEl.value = ''; pricesEl.innerHTML = '';
    photoBox.hidden = true; photoMsg.hidden = true;
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

// Подписки: знак валюты рядом с суммой следует за выбором, а нажатие на популярный сервис
// заполняет название и категорию
export const SUBS_JS = `
(function () {
  document.querySelectorAll('.cur-pick select').forEach(function (s) {
    s.addEventListener('change', function () { s.parentNode.querySelector('.amount-cur').textContent = s.options[s.selectedIndex].text; });
  });
  var box = document.getElementById('sub-add');
  if (!box) return;
  var f = box.querySelector('form');
  box.querySelectorAll('.schip').forEach(function (b) {
    b.addEventListener('click', function () {
      box.querySelectorAll('.schip.on').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      f.elements.namedItem('name').value = b.getAttribute('data-name');
      f.elements.namedItem('category').value = b.getAttribute('data-cat');
      f.elements.namedItem('amount').focus();
      if (navigator.vibrate) navigator.vibrate(8);
    });
  });
})();
`;

// Дашборд владельца: подсказка над столбиком и поиск по таблице пользователей
export const ADMIN_JS = `
(function () {
  document.querySelectorAll('.adm-bars').forEach(function (bars) {
    var tip = document.createElement('div'); tip.className = 'adm-tip'; tip.hidden = true; bars.appendChild(tip);
    function show(col) {
      tip.textContent = col.getAttribute('data-tip'); tip.hidden = false;
      // Подсказка не вылезает за края графика у крайних столбиков
      var half = tip.offsetWidth / 2, x = col.offsetLeft + col.offsetWidth / 2;
      tip.style.left = Math.min(Math.max(x, half), bars.clientWidth - half) + 'px';
    }
    bars.querySelectorAll('.adm-col').forEach(function (col) {
      col.addEventListener('pointerenter', function () { show(col); });
      col.addEventListener('focus', function () { show(col); });
      col.addEventListener('click', function () { show(col); });
    });
    bars.addEventListener('pointerleave', function () { tip.hidden = true; });
  });
  var q = document.getElementById('adm-q');
  if (q) q.addEventListener('input', function () {
    var s = q.value.trim().toLowerCase();
    document.querySelectorAll('.adm-table tbody tr').forEach(function (tr) { tr.hidden = s && tr.getAttribute('data-name').indexOf(s) === -1; });
  });
})();
`;

// «Итоги месяца»: слайды листаются сами, касание справа — дальше, слева — назад; цифры докручиваются;
// на последнем слайде картинка для сторис: поделиться или отправить в чат с ботом
export const WRAPPED_JS = `
(function () {
  var root = document.getElementById('wr');
  if (!root) return;
  var slides = [].slice.call(root.querySelectorAll('.wr-slide'));
  var bars = [].slice.call(root.querySelectorAll('.wr-bars i'));
  var t = JSON.parse(root.getAttribute('data-t'));
  var i = 0, timer = null, DUR = 6500;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fmt(n, suf) { return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ') + suf; }
  function count(sl) {
    sl.querySelectorAll('.wr-num').forEach(function (el) {
      var to = Number(el.getAttribute('data-to')), suf = el.getAttribute('data-suffix') || '';
      if (reduce) { el.textContent = fmt(to, suf); return; }
      var start = performance.now() + 300;
      el.textContent = fmt(0, suf);
      (function step(now) {
        var p = Math.max(0, Math.min(1, (now - start) / 1300)); p = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(to * p, suf);
        if (p < 1) requestAnimationFrame(step);
      })(performance.now());
    });
  }
  function go(n) {
    if (n < 0 || n >= slides.length) return;
    i = n;
    slides.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    bars.forEach(function (b, k) { b.className = k < i ? 'done' : ''; });
    void bars[i].offsetWidth;
    var last = i === slides.length - 1;
    bars[i].className = last ? 'done' : 'cur';
    bars[i].style.setProperty('--dur', DUR + 'ms');
    root.classList.toggle('last', last);
    count(slides[i]);
    clearTimeout(timer);
    if (!last) timer = setTimeout(function () { go(i + 1); }, DUR);
  }
  function tap(n) { if (navigator.vibrate) navigator.vibrate(6); go(n); }
  root.querySelector('.wr-tap-prev').addEventListener('click', function () { tap(i - 1); });
  root.querySelector('.wr-tap-next').addEventListener('click', function () { tap(i + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
    else if (e.key === 'Escape') location.href = '/dashboard';
  });
  var again = document.getElementById('wr-again');
  if (again) again.addEventListener('click', function () { go(0); });
  setTimeout(function () { var h = root.querySelector('.wr-hint'); if (h) h.classList.add('gone'); }, 4000);
  go(0);

  // Картинка для сторис из SVG через canvas
  var frame = document.getElementById('wr-card'), hint = document.getElementById('wr-hint');
  var shareBtn = document.getElementById('wr-share'), sendBtn = document.getElementById('wr-send');
  if (!frame) return;
  var svg = frame.querySelector('svg'), blob = null, im = new Image();
  function fail() { hint.textContent = t.imgFail; }
  im.onload = function () {
    var c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    try {
      c.getContext('2d').drawImage(im, 0, 0, 1080, 1920);
      c.toBlob(function (b) {
        if (!b) return fail();
        blob = b;
        var img = document.createElement('img'); img.src = URL.createObjectURL(b); img.alt = '';
        frame.replaceChild(img, svg);
        var file = new File([b], 'spendtracker-wrapped.jpg', { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          shareBtn.hidden = false;
          shareBtn.onclick = function () { navigator.share({ files: [file] }).catch(function () {}); };
        }
        if (sendBtn) sendBtn.disabled = false;
        hint.textContent = t.holdSave;
      }, 'image/jpeg', 0.9);
    } catch (e) { fail(); }
  };
  im.onerror = fail;
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  if (sendBtn) sendBtn.onclick = function () {
    if (!blob) return;
    sendBtn.disabled = true; hint.textContent = t.sending;
    fetch('/month/send?m=' + root.getAttribute('data-month'), { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) { hint.textContent = j.ok ? t.sent : t.sendFail; })
      .catch(function () { hint.textContent = t.sendFail; })
      .then(function () { sendBtn.disabled = false; });
  };
})();
`;

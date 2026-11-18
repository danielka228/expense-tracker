(() => {
  const en = document.documentElement.lang.startsWith('en');
  const t = (ru, eng) => en ? eng : ru;
  const form = document.getElementById('food-form');
  if (!form) return;
  const field = n => form.elements.namedItem(n);
  const status = document.getElementById('food-status');
  const photo = document.getElementById('food-photo');
  const result = document.getElementById('food-ai-result');
  const analyze = document.getElementById('food-analyze');
  const cancel = document.getElementById('food-cancel');
  const preview = document.getElementById('food-preview');
  const questionsBox = document.getElementById('food-questions');
  const matchesBox = document.getElementById('food-matches');
  const matchList = document.getElementById('food-match-list');
  const save = document.getElementById('food-save');
  let jpeg = null, version = 0, controller = null, previewUrl;
  let questions = [], history = [], autoValues = {}, productMatches = [], busy = false, saving = false, dirty = false;
  const show = text => { status.textContent = text; };
  function calculation() {
    const grams = Number(field('grams').value), kcal = Number(field('kcal_per_100').value);
    const buying = field('kind').value === 'purchase';
    document.getElementById('food-grams-label').textContent = buying ? t('Вес покупки, г','Purchased weight, g') : t('Вес порции, г','Portion weight, g');
    document.getElementById('food-calculation').textContent = field('grams').value && field('kcal_per_100').value && grams > 0 && kcal >= 0
      ? `${Math.round(grams * kcal / 10) / 10} ${t('ккал', 'kcal')} · ${buying ? t('во всей покупке','in the full purchase') : t('в этой порции', 'in this portion')}` : t('Укажи вес и калорийность.', 'Enter weight and calories.');
    const pack = Number(field('package_grams').value), packageTotal = document.getElementById('food-package-total'), usePackage = document.getElementById('food-use-package');
    const hasPackage = field('package_grams').value && pack > 0 && pack <= 100000 && field('kcal_per_100').value && kcal >= 0;
    packageTotal.hidden = !hasPackage; usePackage.hidden = !hasPackage;
    if (hasPackage) {
      const total = Math.round(pack * kcal / 100 * 10) / 10;
      packageTotal.textContent = t(`Во всей упаковке: ${total} ккал (${pack} г).`, `Whole package: ${total} kcal (${pack} g).`);
      usePackage.textContent = t(`Внести ${pack} г как съеденную порцию`, `Use ${pack} g as the eaten portion`);
    }
    document.getElementById('food-price').hidden = field('kind').value !== 'purchase';
    field('amount').disabled = document.getElementById('food-price').hidden;
    const source = document.getElementById('food-source');
    source.hidden = field('source').value === 'manual';
    source.textContent = field('source').value === 'catalog' ? t('Калорийность из Open Food Facts — проверь совпадение товара.', 'Calories from Open Food Facts — verify the product match.') : field('source').value === 'label' ? t('Калорийность с этикетки — проверь цифры.', 'Calories from the label — check the numbers.') : t('≈ Оценка ИИ. Проверь состав и вес порции.', '≈ AI estimate. Check ingredients and portion weight.');
  }
  function setBusy(value) {
    busy = value;
    save.disabled = busy || saving;
    if (photo) {
      analyze.disabled = busy || !jpeg;
      cancel.hidden = !busy;
      document.querySelector('.food-photo').setAttribute('aria-busy', String(busy));
    }
  }
  form.addEventListener('input', ev => {
    dirty = true;
    if (ev.target === field('kcal_per_100')) field('source').value = 'manual';
    calculation();
  });
  form.addEventListener('change', calculation);
  window.addEventListener('beforeunload', ev => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } });
  const errors = {
    limit: t('Лимит ИИ на сегодня исчерпан. Введи данные вручную.', 'AI daily limit reached. Enter values manually.'),
    ai_off: t('ИИ сейчас недоступен. Введи данные вручную.', 'AI is unavailable. Enter values manually.'),
    unknown: t('Не удалось разобрать фото. Попробуй другой снимок или введи данные вручную.', 'Could not read the photo. Try another image or enter values manually.'),
    not_food: t('Похоже, на фото не еда. Сфотографируй блюдо или этикетку пищевого продукта.', 'This does not appear to be food. Photograph a meal or a food nutrition label.'),
    invalid: t('Проверь название, дату, вес, калории и цену.', 'Check the name, date, weight, calories and price.'),
    already_saved: t('Эта запись уже сохранена. Открой дневник и измени её там.', 'This entry is already saved. Open the diary and edit it there.'),
    not_found: t('Запись уже удалена. Обнови страницу.', 'This entry has been deleted. Reload the page.'),
    bad_image: t('Не удалось открыть фото. Попробуй JPEG или снимок экрана.', 'Could not open the photo. Try JPEG or a screenshot.'),
    too_large: t('Фото слишком большое. Выбери снимок поменьше.', 'Image is too large. Choose a smaller photo.'),
  };
  async function request(url, body, signal) {
    let res;
    try { res = await fetch(url, { method: 'POST', body, signal: signal || AbortSignal.timeout(20000) }); }
    catch (e) {
      if (signal?.aborted) throw e;
      throw new Error(t('Нет ответа от сервера. Данные остаются в форме; попробуй ещё раз.', 'No response from the server. Your values remain in the form; try again.'));
    }
    if (res.redirected) throw new Error(t('Войди в аккаунт заново. Несохранённые данные пока остаются в форме.', 'Sign in again. Unsaved values are still in the form.'));
    let data;
    try { data = await res.json(); } catch { throw new Error(t('Ошибка сервера. Попробуй ещё раз.', 'Server error. Try again.')); }
    if (!res.ok || data.error) throw new Error(errors[data.error] || t('Не удалось выполнить действие.', 'Action failed.'));
    return data;
  }
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (busy || saving) return;
    if (field('expense_id').value && (field('kind').value !== 'purchase' || !field('amount').value.trim()) &&
        !confirm(t('Связанный расход тоже будет удалён. Продолжить?', 'The linked expense will also be deleted. Continue?'))) return;
    saving = true; save.disabled = true;
    // Keep the same request key after a network failure, even if the server already saved it.
    const body = new FormData(form), day = field('entry_date').value;
    const enabled = [...form.elements].filter(el => !el.disabled);
    enabled.forEach(el => { el.disabled = true; });
    try {
      await request('/nutrition/save', body);
      dirty = false; location.assign('/nutrition?date=' + encodeURIComponent(day));
    } catch (e) { show(e.message); saving = false; enabled.forEach(el => { el.disabled = false; }); calculation(); setBusy(false); }
  });
  function stop() { version++; controller?.abort(); controller = null; setBusy(false); }
  function clearPhoto() {
    stop(); jpeg = null; questions = []; history = []; autoValues = {}; productMatches = [];
    if (photo) {
      photo.value = ''; result.textContent = ''; questionsBox.replaceChildren(); matchList.replaceChildren(); matchesBox.hidden = true;
      document.getElementById('food-context').value = ''; preview.hidden = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setBusy(false);
    }
  }
  const discard = () => !dirty || confirm(t('Отменить несохранённые изменения?', 'Discard unsaved changes?'));
  function reset() {
    form.reset(); field('id').value = ''; field('expense_id').value = ''; field('source').value = 'manual'; field('request_key').value = crypto.randomUUID();
    clearPhoto(); dirty = false; show(''); calculation();
    document.getElementById('food-form-title').textContent = t('Добавить запись','Add entry');
  }
  document.getElementById('food-reset').addEventListener('click', () => { if (!saving && discard()) reset(); });
  for (const button of document.querySelectorAll('[data-edit], [data-eat]')) button.addEventListener('click', () => {
    if (saving || !discard()) return;
    reset();
    const eat = button.hasAttribute('data-eat');
    const entry = JSON.parse(eat ? button.dataset.eat : button.dataset.edit);
    for (const key of ['name','grams','kcal_per_100','meal','entry_date','kind']) field(key).value = entry[key];
    field('expense_id').value = eat ? '' : (entry.expense_id || '');
    field('amount').value = entry.price == null ? '' : entry.price;
    field('source').value = entry.source || 'manual';
    field('id').value = eat ? '' : entry.id;
    if (eat) { field('kind').value = 'meal'; field('grams').value = ''; field('entry_date').value = document.getElementById('food-day').value; }
    document.getElementById('food-form-title').textContent = eat ? t('Сколько ты съел?', 'How much did you eat?') : t('Изменить запись','Edit entry');
    calculation(); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); field(eat ? 'grams' : 'name').focus();
  });
  for (const button of document.querySelectorAll('[data-delete]')) button.addEventListener('click', async () => {
    if (saving || !discard() || !confirm(t('Удалить запись питания? Связанная трата также будет удалена.', 'Delete this food entry? Its linked expense will also be deleted.'))) return;
    button.disabled = true;
    try { await request('/nutrition/delete/' + button.dataset.delete); dirty = false; location.reload(); }
    catch (e) { show(e.message); button.disabled = false; }
  });
  if (photo) {
    cancel.addEventListener('click', () => { stop(); result.textContent = t('Распознавание отменено. Можно повторить или заполнить вручную.', 'Analysis canceled. Retry or fill in manually.'); });
    photo.addEventListener('change', async () => {
      stop(); const current = version;
      jpeg = null; questions = []; history = []; productMatches = []; result.textContent = ''; questionsBox.replaceChildren(); matchList.replaceChildren(); matchesBox.hidden = true; preview.hidden = true;
      // Remove old AI suggestions; preserve values explicitly entered by the person.
      for (const [key, value] of Object.entries(autoValues)) if (field(key).value === value) field(key).value = '';
      autoValues = {}; field('source').value = 'manual'; calculation();
      const file = photo.files[0];
      if (!file) { setBusy(false); return; }
      setBusy(true); result.textContent = t('Подготавливаю фото…', 'Preparing photo…');
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error(errors.too_large);
        const url = URL.createObjectURL(file), img = new Image();
        try { img.src = url; await img.decode(); } finally { URL.revokeObjectURL(url); }
        if (current !== version) return;
        const ratio = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
        if (current !== version) return;
        if (!blob || blob.size > 3 * 1024 * 1024) throw new Error(errors.too_large);
        jpeg = blob; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(blob); preview.src = previewUrl; preview.hidden = false;
        await analyzePhoto();
      } catch (e) { if (current === version) result.textContent = e.message || errors.bad_image; }
      finally { if (current === version) setBusy(false); }
    });
    async function analyzePhoto() {
      if (!jpeg || saving) return;
      controller?.abort(); const current = ++version;
      const active = new AbortController(); controller = active;
      const timer = setTimeout(() => active.abort(), 55000);
      const snapshot = Object.fromEntries(['name','grams','package_grams','kcal_per_100'].map(key => [key, field(key).value]));
      const answers = questions.map((q,i) => ({ question:q, answer:questionsBox.querySelectorAll('input')[i]?.value || '' })).filter(q=>q.answer.trim());
      const context = JSON.stringify({ previousAnswers:history, answers, details:document.getElementById('food-context').value,
        grams: snapshot.grams !== autoValues.grams ? snapshot.grams : '', packageGrams: snapshot.package_grams !== autoValues.package_grams ? snapshot.package_grams : '', entryType:field('kind').value });
      const body = new FormData(); body.set('photo', jpeg, 'food.jpg'); body.set('context', context);
      setBusy(true); result.textContent = t('Распознаю еду и оцениваю порцию…','Identifying food and estimating the portion…');
      try {
        const { guess, matches = [], visualMatch = null } = await request('/nutrition/analyze', body, active.signal);
        if (current !== version) return;
        history = [...history, ...answers].slice(-4);
        const packageGrams = guess.package_grams === null ? '' : String(Math.round(guess.package_grams*10)/10);
        const suggested = { name:guess.name || '', grams:guess.grams === null ? (field('kind').value === 'purchase' ? packageGrams : '') : String(Math.round(guess.grams*10)/10), package_grams:packageGrams, kcal_per_100:guess.kcal_per_100 === null ? '' : String(Math.round(guess.kcal_per_100*10)/10) };
        for (const key of Object.keys(suggested)) {
          // Never overwrite an edit made during the request, or a deliberately supplied weight.
          if (field(key).value !== snapshot[key]) continue;
          if (key === 'grams' && snapshot[key] && snapshot[key] !== autoValues[key]) continue;
          if (key === 'package_grams' && snapshot[key] && snapshot[key] !== autoValues[key]) continue;
          field(key).value = suggested[key]; autoValues[key] = suggested[key];
          if (key === 'kcal_per_100') field('source').value = guess.source === 'label' ? 'label' : 'estimate';
        }
        questions = guess.questions; questionsBox.replaceChildren();
        for (const q of questions) {
          const label = document.createElement('label'); label.append(document.createTextNode(q));
          const input = document.createElement('input'); input.type = 'text'; input.maxLength = 250; input.placeholder = t('Твой ответ', 'Your answer'); label.append(input); questionsBox.append(label);
        }
        productMatches = Array.isArray(matches) ? matches : [];
        drawFoodMatches(productMatches, visualMatch);
        result.textContent = [t('Проверь результат перед сохранением.', 'Review the result before saving.'),guess.note,questions.length ? t('Ответь на вопросы выше и нажми «Распознать / уточнить».', 'Answer the questions above and click “Analyze / refine”.') : ''].filter(Boolean).join('\n\n');
        dirty = true; calculation();
      } catch (e) {
        if (current === version) result.textContent = active.signal.aborted ? t('ИИ не ответил вовремя. Попробуй ещё раз или введи данные вручную.', 'AI did not respond in time. Retry or enter values manually.') : e.message;
      } finally { clearTimeout(timer); if (current === version) { controller = null; setBusy(false); } }
    }
    function drawFoodMatches(matches, visualMatch) {
      matchList.replaceChildren();
      if (!Array.isArray(matches) || !matches.length) { matchesBox.hidden = true; return; }
      matchesBox.hidden = false;
      for (const match of matches) {
        const article = document.createElement('article'); article.className = 'food-match';
        if (match.image) { const img = document.createElement('img'); img.src = match.image; img.alt = ''; img.loading = 'lazy'; article.append(img); }
        else { const spacer = document.createElement('span'); article.append(spacer); }
        const body = document.createElement('div'); body.className = 'food-match-body';
        const name = document.createElement('div'); name.className = 'food-match-name'; name.textContent = match.name || t('Без названия','Unnamed product'); body.append(name);
        const meta = document.createElement('div'); meta.className = 'food-match-meta';
        const packageKcal = match.package_grams && match.kcal_per_100 !== null ? `${Math.round(match.package_grams * match.kcal_per_100 / 10) / 10} ${t('ккал в упаковке','kcal per pack')}` : '';
        meta.textContent = [match.brand, match.quantity, match.kcal_per_100 !== null ? `${match.kcal_per_100} ${t('ккал / 100 г','kcal / 100 g')}` : '', packageKcal].filter(Boolean).join(' · ');
        body.append(meta);
        const actions = document.createElement('div'); actions.className = 'food-match-actions';
        const use = document.createElement('button'); use.type = 'button'; use.className = 'food-match-use'; use.dataset.code = match.code;
        use.textContent = t('Использовать данные','Use product data'); actions.append(use);
        const link = document.createElement('a'); link.href = match.source_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open Food Facts'; actions.append(link);
        if (visualMatch?.code === match.code) { const badge = document.createElement('span'); badge.className = 'food-badge'; badge.textContent = t(`Визуально похоже · ${visualMatch.confidence === 'high' ? 'высокая' : visualMatch.confidence === 'medium' ? 'средняя' : 'низкая'} уверенность`, `Visual match · ${visualMatch.confidence} confidence`); actions.append(badge); }
        body.append(actions); article.append(body); matchList.append(article);
      }
    }
    matchList.addEventListener('click', ev => {
      const button = ev.target.closest('.food-match-use');
      if (!button) return;
      const match = productMatches.find(item => item.code === button.dataset.code);
      if (!match) return;
      field('name').value = match.name;
      autoValues.name = match.name;
      field('package_grams').value = match.package_grams == null ? '' : String(match.package_grams);
      autoValues.package_grams = field('package_grams').value;
      if (field('kind').value === 'purchase' && match.package_grams && (!field('grams').value || field('grams').value === autoValues.grams)) { field('grams').value = String(match.package_grams); autoValues.grams = field('grams').value; }
      if (match.kcal_per_100 !== null) { field('kcal_per_100').value = match.kcal_per_100; autoValues.kcal_per_100 = String(match.kcal_per_100); field('source').value = 'catalog'; }
      dirty = true; calculation();
      result.textContent = t(`Выбран кандидат из Open Food Facts: ${match.name}. Калорийность и название можно изменить перед сохранением. Порцию в граммах укажи отдельно.`, `Selected Open Food Facts candidate: ${match.name}. Review the name and calories before saving. Enter the eaten portion separately.`);
    });
    analyze.addEventListener('click', () => { if (!busy) analyzePhoto(); });
    document.getElementById('food-use-package').addEventListener('click', () => {
      if (!field('package_grams').value) return;
      field('grams').value = field('package_grams').value; dirty = true; calculation(); field('grams').focus();
    });
  }
  calculation(); setBusy(false);
})();

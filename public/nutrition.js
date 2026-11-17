(() => {
  const en = document.documentElement.lang.startsWith('en');
  const t = (ru, eng) => en ? eng : ru;
  const form = document.getElementById('food-form');
  if (!form) return;
  const field = n => form.elements.namedItem(n);
  const status = document.getElementById('food-status');
  const show = text => { status.textContent = text; };
  const calculation = () => {
    const grams = Number(field('grams').value), kcal = Number(field('kcal_per_100').value);
    document.getElementById('food-calculation').textContent = field('grams').value && field('kcal_per_100').value && grams > 0 && kcal >= 0
      ? `${Math.round(grams * kcal / 10) / 10} ${t('ккал', 'kcal')} · ${t('в указанном весе', 'in this weight')}` : t('Укажи вес и калорийность.', 'Enter weight and calories.');
    document.getElementById('food-price').hidden = field('kind').value !== 'purchase' || !!field('id').value;
    field('amount').disabled = document.getElementById('food-price').hidden;
  };
  form.addEventListener('input', calculation);
  form.addEventListener('change', calculation);
  const errors = {
    limit: t('Лимит ИИ на сегодня исчерпан. Введи данные вручную.', 'AI daily limit reached. Enter values manually.'),
    ai_off: t('ИИ сейчас недоступен. Введи данные вручную.', 'AI is unavailable. Enter values manually.'),
    unknown: t('Не удалось разобрать фото. Попробуй другой снимок или введи данные вручную.', 'Could not read the photo. Try another image or enter values manually.'),
    invalid: t('Проверь название, дату, вес, калории и цену.', 'Check the name, date, weight, calories and price.'),
    bad_image: t('Нужна фотография JPEG. Выбери другой снимок.', 'A JPEG photo is needed. Choose another image.'),
    too_large: t('Фото слишком большое. Выбери снимок поменьше.', 'Image is too large. Choose a smaller photo.'),
  };
  async function request(url, body) {
    const res = await fetch(url, { method: 'POST', body });
    if (res.redirected) throw new Error(t('Войди в аккаунт заново. Несохранённые данные пока остаются в форме.', 'Sign in again. Unsaved values are still in the form.'));
    let data;
    try { data = await res.json(); } catch { throw new Error(t('Ошибка сервера. Попробуй ещё раз.', 'Server error. Try again.')); }
    if (!res.ok || data.error) throw new Error(errors[data.error] || t('Не удалось выполнить действие.', 'Action failed.'));
    return data;
  }
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const button = document.getElementById('food-save');
    button.disabled = true;
    try {
      const day = field('entry_date').value;
      await request('/nutrition/save', new FormData(form));
      location.assign('/nutrition?date=' + encodeURIComponent(day));
    } catch (e) { show(e.message); button.disabled = false; }
  });
  let jpeg = null, imageVersion = 0, questions = [];
  const photo = document.getElementById('food-photo');
  const result = document.getElementById('food-ai-result');
  const analyze = document.getElementById('food-analyze');
  const preview = document.getElementById('food-preview');
  let previewUrl;
  function clearPhoto() {
    imageVersion++; jpeg = null; questions = [];
    if (photo) { photo.value = ''; result.textContent = ''; document.getElementById('food-context').value = ''; preview.hidden = true; if (previewUrl) URL.revokeObjectURL(previewUrl); }
  }
  function reset() { form.reset(); field('id').value = ''; clearPhoto(); calculation(); document.getElementById('food-form-title').textContent = t('Добавить запись','Add entry'); }
  document.getElementById('food-reset').addEventListener('click', reset);
  for (const button of document.querySelectorAll('[data-edit], [data-eat]')) button.addEventListener('click', () => {
    reset();
    const eat = button.hasAttribute('data-eat');
    const entry = JSON.parse(eat ? button.dataset.eat : button.dataset.edit);
    for (const key of ['name','grams','kcal_per_100','meal','entry_date','kind']) field(key).value = entry[key];
    field('id').value = eat ? '' : entry.id;
    if (eat) { field('kind').value = 'meal'; field('grams').value = ''; field('entry_date').value = document.getElementById('food-day').value; }
    document.getElementById('food-form-title').textContent = eat ? t('Сколько ты съел?', 'How much did you eat?') : t('Изменить запись','Edit entry');
    calculation(); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); field(eat ? 'grams' : 'name').focus();
  });
  for (const button of document.querySelectorAll('[data-delete]')) button.addEventListener('click', async () => {
    if (!confirm(t('Удалить запись питания? Связанная трата останется в расходах.', 'Delete food entry? Any linked expense stays in expenses.'))) return;
    button.disabled = true;
    try { await request('/nutrition/delete/' + button.dataset.delete); location.reload(); }
    catch (e) { show(e.message); button.disabled = false; }
  });
  if (photo) {
    photo.addEventListener('change', async () => {
      const version = ++imageVersion; jpeg = null; questions = []; result.textContent = ''; preview.hidden = true;
      const file = photo.files[0];
      if (!file) return;
      analyze.disabled = true;
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error(errors.too_large);
        const url = URL.createObjectURL(file);
        const img = new Image();
        try { img.src = url; await img.decode(); } finally { URL.revokeObjectURL(url); }
        if (version !== imageVersion) return;
        const ratio = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
        if (version !== imageVersion) return;
        if (!blob || blob.size > 3 * 1024 * 1024) throw new Error(errors.too_large);
        jpeg = blob; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(blob); preview.src = previewUrl; preview.hidden = false;
        await analyzePhoto();
      } catch (e) { show(e.message || errors.bad_image); }
      finally { analyze.disabled = false; }
    });
    async function analyzePhoto() {
      if (!jpeg) { show(t('Сначала выбери фото. Если HEIC не открывается, используй JPEG или снимок экрана.', 'Choose a photo first. If HEIC cannot open, use JPEG or a screenshot.')); return; }
      const version = imageVersion;
      const body = new FormData(); body.set('photo', jpeg, 'food.jpg');
      body.set('context', (questions.join('\n') + '\n' + document.getElementById('food-context').value + '\n' + t('Указанный вес: ', 'Entered weight: ') + field('grams').value + ' g').slice(0,3000));
      analyze.disabled = true; photo.disabled = true; result.textContent = t('Изучаю фото…','Analyzing photo…');
      try {
        const { guess } = await request('/nutrition/analyze', body);
        if (version !== imageVersion) return;
        if (guess.name) field('name').value = guess.name;
        // Unknown values must never silently reuse numbers from a previous analysis.
        field('kcal_per_100').value = guess.kcal_per_100 === null ? '' : Math.round(guess.kcal_per_100 * 10) / 10;
        if (!field('grams').value && guess.grams !== null) field('grams').value = Math.round(guess.grams * 10) / 10;
        questions = guess.questions;
        result.textContent = [t('Оценка ИИ — проверь перед сохранением.', 'AI estimate — review before saving.'), guess.note, ...questions.map(q => '• ' + q), questions.length ? t('Напиши ответы выше и нажми «Распознать / уточнить» ещё раз.', 'Write your answers above and click “Analyze / refine” again.') : ''].filter(Boolean).join('\n\n');
        calculation();
      } catch (e) { result.textContent = e.message; }
      finally { analyze.disabled = false; photo.disabled = false; }
    }
    analyze.addEventListener('click', analyzePhoto);
  }
  calculation();
})();

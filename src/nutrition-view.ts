import { html } from 'hono/html';
import { layout } from './views';
import { calories, MEALS, type Food } from './nutrition-data';
import type { Lang } from './i18n';

export function nutritionPage(d: { entries: Food[]; date: string; lang: Lang; ai: boolean; currency: string }) {
  const t = (ru: string, en: string) => d.lang === 'en' ? en : ru;
  const names = d.lang === 'en' ? ['Breakfast','Lunch','Dinner','Snack'] : ['Завтрак','Обед','Ужин','Перекус'];
  const eaten = d.entries.filter(e => e.kind === 'meal');
  const bought = d.entries.filter(e => e.kind === 'purchase');
  const total = eaten.reduce((sum, e) => sum + calories(e.grams, e.kcal_per_100), 0);
  const adjacent = (delta: number) => new Date(Date.parse(d.date + 'T12:00:00Z') + delta * 86400000).toISOString().slice(0,10);
  const row = (e: Food) => html`<article class="food-row">
    <div><strong>${e.name}</strong>${e.source === 'estimate' ? html`<span class="food-badge">${t('≈ оценка ИИ','≈ AI estimate')}</span>` : e.source === 'label' ? html`<span class="food-badge">${t('С этикетки','From label')}</span>` : e.source === 'catalog' ? html`<span class="food-badge">${t('Из каталога Open Food Facts','From Open Food Facts catalog')}</span>` : ''}<p>${e.kind === 'purchase' ? t('Упаковка','Package') : t('Порция','Portion')}: ${e.grams} ${t('г','g')} · ${e.kcal_per_100} ${t('ккал / 100 г','kcal / 100 g')}${e.kind === 'purchase' && e.price !== null && e.price !== undefined ? html` · ${e.price} ${d.currency} ${t('в расходах','in expenses')}` : ''}</p>
      <b>${calories(e.grams, e.kcal_per_100)} ${e.kind === 'purchase' ? t('ккал во всей покупке','kcal in the whole package') : t('ккал в порции','kcal in portion')}</b></div>
    <div class="food-actions">
      ${e.kind === 'purchase' ? html`<button type="button" class="btn-plain" data-eat="${JSON.stringify(e)}">${t('Записать порцию','Log a portion')}</button>` : ''}
      <button type="button" class="btn-plain" data-edit="${JSON.stringify(e)}">${t('Изменить','Edit')}</button>
      <button type="button" class="btn-plain" data-delete="${e.id}">${t('Удалить','Delete')}</button>
    </div></article>`;
  return layout({ title: t('Питание','Nutrition'), flashes: [], lang: d.lang, loggedIn: true, activeTab: 'dashboard', nutrition: true, extraCss: CSS }, html`
<header class="nav"><div class="nav-title">${t('Питание','Nutrition')}</div><div class="nav-side right"><a href="/settings">${t('Настройки','Settings')}</a></div></header>
<h1 class="large-title">${t('Мой дневник','My food diary')}</h1>
<p class="large-sub">${t('Еда, порции и покупки — в одном месте.','Meals, portions and purchases in one place.')}</p>
<div class="food-links"><a href="/dashboard?view=expenses">${t('Мои расходы','My expenses')}</a><a href="/settings">${t('Сменить режим','Change mode')}</a></div>
<div class="food-days"><a href="/nutrition?date=${adjacent(-1)}" aria-label="${t('Предыдущий день','Previous day')}">←</a><a href="/nutrition">${t('Сегодня','Today')}</a><a href="/nutrition?date=${adjacent(1)}" aria-label="${t('Следующий день','Next day')}">→</a></div>
<form method="GET" class="food-date"><label for="food-day">${t('Дата дневника','Diary date')}</label><input id="food-day" name="date" type="date" value="${d.date}" required><button>${t('Показать','Show')}</button></form>
<section class="food-summary"><span>${t('За выбранный день','Selected day')}</span><div><strong>${Math.round(total)}</strong> ${t('ккал','kcal')}</div><p>${t('Считаем съеденное. Покупки не входят в итог.','Only consumed portions count. Purchases are excluded.')}</p></section>
<div id="food-status" role="status" aria-live="polite"></div>
<div class="food-columns"><section class="food-panel">
<h2 id="food-form-title">${t('Добавить запись','Add entry')}</h2>
<form id="food-form">
<input type="hidden" name="id" value=""><input type="hidden" name="expense_id" value=""><input type="hidden" name="request_key" value="${crypto.randomUUID()}"><input type="hidden" name="source" value="manual">
<label>${t('Тип записи','Entry type')}<select name="kind"><option value="meal">${t('Приём пищи','Meal')}</option><option value="purchase">${t('Покупка продукта','Food purchase')}</option></select></label>
<details class="food-photo" open><summary>${t('Заполнить по фото с ИИ','Fill from a photo with AI')}</summary>
<p>${t('Выбери фото — ИИ сам распознает еду или этикетку и предложит калории и вес. Проверь примерную оценку перед сохранением.','Choose a photo — AI automatically recognizes food or a nutrition label and suggests calories and weight. Review the approximate estimate before saving.')}</p>
${d.ai ? html`
<label class="food-upload"><span>${t('＋ Сфотографировать или выбрать фото','＋ Take or choose a photo')}</span><input id="food-photo" type="file" accept="image/*" aria-label="${t('Фото еды или этикетки','Food or label photo')}"></label>
<img id="food-preview" alt="${t('Выбранное фото','Selected photo')}" hidden>
<div id="food-questions"></div>
<section id="food-matches" hidden><h3>${t('Похожие товары в каталоге','Similar catalog products')}</h3><p>${t('AI сравнил фото с изображениями найденных упаковок. Проверь совпадение перед использованием данных.','AI compared your photo with catalog package images. Check the match before using its data.')}</p><div id="food-match-list"></div></section>
<label>${t('Дополнительные детали','Additional details')}<textarea id="food-context" maxlength="1000" rows="3" placeholder="${t('Например: 150 г риса, курица, чайная ложка масла','For example: 150 g rice, chicken, one teaspoon of oil')}"></textarea></label>
<button type="button" id="food-analyze" disabled>${t('Распознать / уточнить','Analyze / refine')}</button>
<button type="button" class="btn-plain" id="food-cancel" hidden>${t('Отменить распознавание','Cancel analysis')}</button>
<div id="food-ai-result" role="status" aria-live="polite"></div>` : html`<p>${t('Распознавание сейчас недоступно. Можно заполнить данные вручную.','Photo analysis is unavailable. You can enter the values manually.')}</p>`}
</details>
<label>${t('Продукт или блюдо','Food or dish')}<input name="name" required maxlength="120" autocomplete="off"></label>
<div class="food-grid"><label><span id="food-grams-label">${t('Вес съеденной порции, г','Eaten portion weight, g')}</span><input name="grams" type="number" min="0.1" max="100000" step="0.1" required inputmode="decimal"></label>
<label>${t('Ккал на 100 г','Kcal per 100 g')}<input name="kcal_per_100" type="number" min="0" max="1000" step="0.1" required inputmode="decimal"></label></div>
<label>${t('Вес всей упаковки, г (если известен)','Whole package weight, g (if known)')}<input name="package_grams" type="number" min="0.1" max="100000" step="0.1" inputmode="decimal"></label>
<p id="food-package-total" class="food-badge" role="status" aria-live="polite" hidden></p>
<button type="button" class="btn-plain" id="food-use-package" hidden>${t('Внести вес всей упаковки как съеденную порцию','Use the whole package as the eaten portion')}</button>
<p id="food-source" class="food-badge" hidden></p>
<p id="food-calculation" aria-live="polite">${t('Укажи вес и калорийность.','Enter weight and calories.')}</p>
<label>${t('Приём пищи','Meal')}<select name="meal">${MEALS.map((m,i) => html`<option value="${m}">${names[i]}</option>`)}</select></label>
<label>${t('Дата записи','Entry date')}<input name="entry_date" type="date" value="${d.date}" required></label>
<label id="food-price" hidden>${t('Цена покупки (необязательно)','Purchase price (optional)')} · ${d.currency}<input name="amount" type="number" min="0.01" max="9999999" step="0.01" inputmode="decimal"><small>${t('Цена и дата синхронизируются с расходами. Если очистить цену при редактировании, связанный расход удалится.','Price and date sync with expenses. Clearing the price while editing also deletes its linked expense.')}</small></label>
<button type="submit" id="food-save">${t('Сохранить запись','Save entry')}</button><button type="button" class="btn-plain" id="food-reset">${t('Очистить / отменить','Clear / cancel')}</button>
</form></section>
<section class="food-diary"><h2>${t('Приёмы пищи','Meals')}</h2>
${!eaten.length ? html`<div class="food-panel"><h3>${t('Пока нет записей','No meals yet')}</h3><p>${t('Добавь первый приём пищи вручную или по фото.','Add your first meal manually or from a photo.')}</p></div>` : ''}
${MEALS.map((m,i) => { const list = eaten.filter(e => e.meal === m); return list.length ? html`<section class="food-panel"><h3>${names[i]} <small>· ${Math.round(list.reduce((s,e) => s + calories(e.grams,e.kcal_per_100),0))} ${t('ккал','kcal')}</small></h3>${list.map(row)}</section>` : ''; })}
<h2>${t('Покупки продуктов','Food purchases')}</h2><div class="food-panel"><p>${t('Цена покупки связана с расходами. Купленный вес хранится отдельно от съеденного: нажми «Записать порцию» и укажи, сколько съел.','Purchase price links to expenses. Purchased weight is separate from eaten weight: choose “Log a portion” and enter how much you ate.')}</p>${bought.length ? bought.map(row) : html`<p>${t('На эту дату покупок нет.','No purchases on this date.')}</p>`}</div>
</section></div><script src="/nutrition.js" defer></script>`);
}
const CSS = `
.food-upload{position:relative;background:var(--accent-soft);color:var(--accent);padding:20px 14px;border:1px dashed var(--accent);border-radius:14px;text-align:center;font-size:15px;cursor:pointer}.food-upload input{position:absolute;inset:0;opacity:0;cursor:pointer;margin:0!important}.food-upload:focus-within{outline:2px solid var(--accent);outline-offset:3px}.wrap{max-width:960px}.food-columns{align-items:start}.food-days{display:flex;gap:18px;align-items:center}.food-days a{padding:10px 16px;border-radius:12px;background:var(--fill)}.food-badge{display:inline-block;font-size:12px;color:var(--text-2);margin:6px 0 6px 8px}.food-photo[aria-busy=true]{border-color:#8e81ff}.food-photo[aria-busy=true] summary::after{content:' …'}#food-questions label{padding:12px;background:var(--fill);border-radius:12px}#food-questions input{background:var(--bg)}.food-date label{margin:0}.food-date input{min-width:0;flex:1}.food-date button{min-height:44px}.food-actions button{min-height:44px}.food-panel button{white-space:normal}

.food-links,.food-date{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:18px 0}.food-date input{width:auto}.food-date button{width:auto}
.food-summary{padding:24px;border-radius:22px;background:var(--card,#1c1c1e);border:1px solid #30d15855;margin:24px 0}.food-summary strong{font-size:56px;letter-spacing:-2px}.food-summary p,.food-panel p,.food-row p,small{color:var(--text-2,#888)}
.food-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}.food-panel{background:var(--card,#1c1c1e);border-radius:20px;padding:20px;margin-bottom:18px;min-width:0}.food-panel h2,.food-panel h3{margin-top:0}.food-panel label{display:block;margin:14px 0}.food-panel input,.food-panel select,.food-panel textarea{width:100%;box-sizing:border-box;margin-top:6px}.food-panel label small{display:block;margin-top:8px}.food-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.food-photo{border-block:1px solid #8884;padding:16px 0;margin:18px 0}.food-photo summary{cursor:pointer;font-weight:600}.food-photo img{max-width:100%;max-height:220px;object-fit:contain;border-radius:12px;margin-top:12px}.food-row{border-top:1px solid #8884;padding:16px 0;overflow-wrap:anywhere}.food-row p{font-size:14px;margin:6px 0}.food-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.food-actions button{width:auto;font-size:13px;padding:8px}.food-panel [hidden]{display:none!important}#food-status:not(:empty){padding:16px;border:1px solid #8885;border-radius:12px;margin-bottom:16px}#food-ai-result{white-space:pre-wrap;margin-top:14px}#food-calculation{font-weight:600}button:disabled{opacity:.5;cursor:wait}@media(max-width:720px){.food-columns{grid-template-columns:1fr}.food-summary strong{font-size:48px}}
.food-matches{margin:14px 0;padding:14px;border:1px solid #8885;border-radius:14px}.food-match{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;align-items:center;padding:12px 0;border-top:1px solid #8884}.food-match img{width:72px;height:72px;object-fit:contain;background:#fff;border-radius:8px}.food-match-body{min-width:0}.food-match-name{font-weight:600;overflow-wrap:anywhere}.food-match-meta{font-size:13px;color:var(--text-2);margin:4px 0}.food-match-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.food-match-actions button{width:auto;padding:8px 12px;font-size:13px}.food-match a{font-size:13px}
`;

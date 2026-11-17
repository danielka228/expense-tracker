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
  const row = (e: Food) => html`<article class="food-row">
    <div><strong>${e.name}</strong><p>${e.grams} ${t('г','g')} · ${e.kcal_per_100} ${t('ккал / 100 г','kcal / 100 g')}</p>
      ${e.kind === 'meal' ? html`<b>${calories(e.grams, e.kcal_per_100)} ${t('ккал','kcal')}</b>` : ''}</div>
    <div class="food-actions">
      ${e.kind === 'purchase' ? html`<button type="button" class="btn-plain" data-eat="${JSON.stringify(e)}">${t('Записать порцию','Log a portion')}</button>` : ''}
      <button type="button" class="btn-plain" data-edit="${JSON.stringify(e)}">${t('Изменить','Edit')}</button>
      <button type="button" class="btn-plain" data-delete="${e.id}">${t('Удалить','Delete')}</button>
    </div></article>`;
  return layout({ title: t('Питание','Nutrition'), flashes: [], lang: d.lang, loggedIn: true, activeTab: 'dashboard', nutrition: true, extraCss: CSS }, html`
<header class="nav"><div class="nav-title">${t('Питание','Nutrition')}</div><a href="/settings">${t('Настройки','Settings')}</a></header>
<h1 class="large-title">${t('Мой дневник','My food diary')}</h1>
<p class="large-sub">${t('Еда, порции и покупки — в одном месте.','Meals, portions and purchases in one place.')}</p>
<div class="food-links"><a href="/dashboard?view=expenses">${t('Мои расходы','My expenses')}</a><a href="/settings">${t('Сменить режим','Change mode')}</a></div>
<form method="GET" class="food-date"><label for="food-day">${t('Дата дневника','Diary date')}</label><input id="food-day" name="date" type="date" value="${d.date}" required><button>${t('Показать','Show')}</button></form>
<section class="food-summary"><span>${t('За выбранный день','Selected day')}</span><div><strong>${Math.round(total)}</strong> ${t('ккал','kcal')}</div><p>${t('Считаем съеденное. Покупки не входят в итог.','Only consumed portions count. Purchases are excluded.')}</p></section>
<div id="food-status" role="status" aria-live="polite"></div>
<div class="food-columns"><section class="food-panel">
<h2 id="food-form-title">${t('Добавить запись','Add entry')}</h2>
<form id="food-form">
<input type="hidden" name="id" value="">
<label>${t('Тип записи','Entry type')}<select name="kind"><option value="meal">${t('Приём пищи','Meal')}</option><option value="purchase">${t('Покупка продукта','Food purchase')}</option></select></label>
<details class="food-photo"><summary>${t('Заполнить по фото с ИИ','Fill from a photo with AI')}</summary>
<p>${t('Сфотографируй еду или таблицу пищевой ценности. ИИ может ошибаться: проверь оценку и вес перед сохранением.','Photograph food or its nutrition label. AI can make mistakes: check the estimate and weight before saving.')}</p>
${d.ai ? html`
<label>${t('Что на фото','Photo type')}<select id="food-photo-kind"><option value="food">${t('Еда на тарелке','Food on a plate')}</option><option value="label">${t('Этикетка: ккал на 100 г','Label: kcal per 100 g')}</option></select></label>
<label>${t('Фото еды или этикетки','Food or label photo')}<input id="food-photo" type="file" accept="image/*"></label>
<img id="food-preview" alt="${t('Выбранное фото','Selected photo')}" hidden>
<label>${t('Состав, вес и ответы на вопросы ИИ','Ingredients, weight and answers to AI questions')}<textarea id="food-context" maxlength="2200" rows="3" placeholder="${t('Например: 150 г риса, курица, чайная ложка масла','For example: 150 g rice, chicken, one teaspoon of oil')}"></textarea></label>
<button type="button" id="food-analyze">${t('Распознать / уточнить','Analyze / refine')}</button>
<div id="food-ai-result" role="status" aria-live="polite"></div>` : html`<p>${t('Распознавание сейчас недоступно. Можно заполнить данные вручную.','Photo analysis is unavailable. You can enter the values manually.')}</p>`}
</details>
<label>${t('Продукт или блюдо','Food or dish')}<input name="name" required maxlength="120" autocomplete="off"></label>
<div class="food-grid"><label>${t('Вес, г','Weight, g')}<input name="grams" type="number" min="0.1" max="100000" step="0.1" required inputmode="decimal"></label>
<label>${t('Ккал на 100 г','Kcal per 100 g')}<input name="kcal_per_100" type="number" min="0" max="1000" step="0.1" required inputmode="decimal"></label></div>
<p id="food-calculation" aria-live="polite">${t('Укажи вес и калорийность.','Enter weight and calories.')}</p>
<label>${t('Приём пищи','Meal')}<select name="meal">${MEALS.map((m,i) => html`<option value="${m}">${names[i]}</option>`)}</select></label>
<label>${t('Дата записи','Entry date')}<input name="entry_date" type="date" value="${d.date}" required></label>
<label id="food-price" hidden>${t('Цена покупки (необязательно)','Purchase price (optional)')} · ${d.currency}<input name="amount" type="number" min="0.01" max="9999999" step="0.01" inputmode="decimal"><small>${t('Создаст также трату в категории «Еда». Удаление записи питания не удаляет трату.','Also creates a Food expense. Deleting the food entry does not delete that expense.')}</small></label>
<button type="submit" id="food-save">${t('Сохранить запись','Save entry')}</button><button type="button" class="btn-plain" id="food-reset">${t('Очистить / отменить','Clear / cancel')}</button>
</form></section>
<section class="food-diary"><h2>${t('Приёмы пищи','Meals')}</h2>
${!eaten.length ? html`<div class="food-panel"><h3>${t('Пока нет записей','No meals yet')}</h3><p>${t('Добавь первый приём пищи вручную или по фото.','Add your first meal manually or from a photo.')}</p></div>` : ''}
${MEALS.map((m,i) => { const list = eaten.filter(e => e.meal === m); return list.length ? html`<section class="food-panel"><h3>${names[i]} <small>· ${Math.round(list.reduce((s,e) => s + calories(e.grams,e.kcal_per_100),0))} ${t('ккал','kcal')}</small></h3>${list.map(row)}</section>` : ''; })}
<h2>${t('Покупки продуктов','Food purchases')}</h2><div class="food-panel"><p>${t('Купленный вес хранится отдельно. Нажми «Записать порцию» и укажи, сколько съел.','Purchased weight is separate. Choose “Log a portion” and enter how much you ate.')}</p>${bought.length ? bought.map(row) : html`<p>${t('На эту дату покупок нет.','No purchases on this date.')}</p>`}</div>
</section></div><script src="/nutrition.js" defer></script>`);
}
const CSS = `
.food-links,.food-date{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:18px 0}.food-date input{width:auto}.food-date button{width:auto}
.food-summary{padding:24px;border-radius:22px;background:var(--card,#1c1c1e);border:1px solid #30d15855;margin:24px 0}.food-summary strong{font-size:56px;letter-spacing:-2px}.food-summary p,.food-panel p,.food-row p,small{color:var(--text-2,#888)}
.food-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}.food-panel{background:var(--card,#1c1c1e);border-radius:20px;padding:20px;margin-bottom:18px;min-width:0}.food-panel h2,.food-panel h3{margin-top:0}.food-panel label{display:block;margin:14px 0}.food-panel input,.food-panel select,.food-panel textarea{width:100%;box-sizing:border-box;margin-top:6px}.food-panel small{display:block;margin-top:8px}.food-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.food-photo{border-block:1px solid #8884;padding:16px 0;margin:18px 0}.food-photo summary{cursor:pointer;font-weight:600}.food-photo img{max-width:100%;max-height:220px;object-fit:contain;border-radius:12px;margin-top:12px}.food-row{border-top:1px solid #8884;padding:16px 0;overflow-wrap:anywhere}.food-row p{font-size:14px;margin:6px 0}.food-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.food-actions button{width:auto;font-size:13px;padding:8px}.food-panel [hidden]{display:none!important}#food-status:not(:empty){padding:16px;border:1px solid #8885;border-radius:12px;margin-bottom:16px}#food-ai-result{white-space:pre-wrap;margin-top:14px}#food-calculation{font-weight:600}button:disabled{opacity:.5;cursor:wait}@media(max-width:720px){.food-columns{grid-template-columns:1fr}.food-summary strong{font-size:48px}}
`;

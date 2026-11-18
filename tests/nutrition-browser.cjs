// Chromium UI regression tests with deterministic AI responses, never calling cloud AI.
const { chromium } = require('playwright-core');
const { build } = require('esbuild');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'nutrition-ui-'));
  const bundle = path.join(temp,'view.cjs');
  await build({stdin:{contents:"export { nutritionPage } from './src/nutrition-view';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:bundle});
  const { nutritionPage } = require(bundle);
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];page.on('pageerror', e=>errors.push(e.message));
    page.on('dialog', dialog=>dialog.accept());
    let calls=0, response, delay=0, lastContext, apiError=null;
    const sample = {id:1,name:'Рис с курицей',grams:250,kcal_per_100:160,meal:'lunch',entry_date:'2026-11-17',kind:'meal',expense_id:null,source:'estimate'};
    await page.route('http://localhost:8799/**',async route=>{
      const url = new URL(route.request().url());
      if(url.pathname==='/nutrition/analyze') {
        calls++; const chosen=response, wait=delay;lastContext=route.request().postData();
        if(wait) await new Promise(resolve=>setTimeout(resolve,wait));
        await route.fulfill(apiError ? {status:422,json:{error:apiError}} : {json:{ok:true,guess:chosen}}).catch(()=>{});
      } else if(url.pathname==='/nutrition.js') {
        await route.fulfill({contentType:'text/javascript',body:fs.readFileSync('public/nutrition.js','utf8')});
      } else {
        await route.fulfill({contentType:'text/html',body:String(await nutritionPage({entries:[sample],date:'2026-11-17',lang:url.searchParams.get('lang') || 'ru',ai:true,currency:'RUB'}))});
      }
    });
    await page.goto('http://localhost:8799/nutrition');
    const photo = {name:'food.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVxkAAAAASUVORK5CYII=','base64')};
    response={is_food:true,name:'Рис',grams:250,kcal_per_100:160,questions:['Сколько масла?'],note:'Примерная оценка',source:'estimate'};
    await page.locator('#food-photo').setInputFiles(photo);
    await page.waitForFunction(()=>document.querySelector('[name=name]').value==='Рис');
    assert.equal(calls,1);
    assert.match(await page.locator('#food-calculation').textContent(),/400/);
    await page.locator('#food-questions input').fill('Без масла, 200 граммов');
    response={...response,grams:200,kcal_per_100:130,questions:[]};
    await page.locator('#food-analyze').click();
    await page.waitForFunction(()=>!document.getElementById('food-save').disabled);
    assert.equal(await page.locator('[name=grams]').inputValue(),'200');
    assert.match(lastContext,/Без масла/);
    assert.match(await page.locator('#food-calculation').textContent(),/260/);
    // Preserve an explicit weight while refining the AI estimate.
    await page.locator('[name=grams]').fill('180');
    response={...response,grams:300};
    await page.locator('#food-analyze').click();
    await page.waitForFunction(()=>!document.getElementById('food-save').disabled);
    assert.equal(await page.locator('[name=grams]').inputValue(),'180');
    // A photo rejected as non-food must not become a made-up diary entry.
    apiError='not_food';
    await page.locator('#food-photo').setInputFiles(photo);
    await page.waitForFunction(()=>document.getElementById('food-ai-result').textContent.includes('не еда'));
    assert.equal(await page.locator('[name=name]').inputValue(),'');
    assert.equal(await page.locator('#food-questions').locator('input').count(),0);
    apiError=null;
    // Replacement photos must not reuse old calories if the new image is unreadable.
    response={is_food:true,name:'',grams:null,kcal_per_100:null,questions:['Пришли более чёткое фото'],note:'',source:'estimate'};
    await page.locator('#food-photo').setInputFiles(photo);
    await page.waitForFunction(()=>document.querySelector('#food-questions').textContent.includes('Пришли'));
    assert.equal(await page.locator('[name=kcal_per_100]').inputValue(),'');
    assert.equal(await page.locator('[name=name]').inputValue(),'');
    // A late response cannot overwrite edits made while the request is running.
    response={is_food:true,name:'Поздний ответ',grams:350,kcal_per_100:200,questions:[],note:'',source:'estimate'};delay=400;
    await page.locator('#food-analyze').click();
    await page.locator('[name=name]').fill('Моё название');
    await page.waitForFunction(()=>!document.getElementById('food-save').disabled);
    assert.equal(await page.locator('[name=name]').inputValue(),'Моё название');
    // Cancellation unlocks manual entry and ignores the old result.
    await page.locator('#food-analyze').click();
    await page.locator('#food-cancel').click();
    assert.equal(await page.locator('#food-save').isDisabled(),false);
    await page.waitForTimeout(500);
    assert.match(await page.locator('#food-ai-result').textContent(),/отменено/);
    // Reset clears provenance and starts a fresh retry key.
    const oldKey=await page.locator('[name=request_key]').inputValue();
    await page.locator('#food-reset').click();
    assert.notEqual(await page.locator('[name=request_key]').inputValue(),oldKey);
    assert.equal(await page.locator('[name=source]').inputValue(),'manual');
    assert.equal(await page.locator('#food-analyze').isDisabled(),true);
    // Readable two-column desktop and mobile layouts.
    assert.ok(await page.locator('.wrap').evaluate(el=>el.getBoundingClientRect().width)>900);
    await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(350);
    if(process.env.SCREENSHOT_DIR) {fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'nutrition-desktop.png'),fullPage:true});}
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    if(process.env.SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'nutrition-mobile.png'),fullPage:true});
    await page.goto('http://localhost:8799/nutrition?lang=en');
    assert.match(await page.locator('h1').textContent(),/My food diary/);
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS: automatic photo analysis, clarification, weight correction, manual edits, photo replacement, cancellation, reset, RU/EN and desktop/mobile layouts. AI responses are mocked.');
  } finally {await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1)});

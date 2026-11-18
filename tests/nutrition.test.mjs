import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { calories, readFood, parseFoodGuess, validDate, foodNumber } from '../src/nutrition-data.ts';
import { parseFoodSearchResults, searchFoodProducts } from '../src/nutrition-search.ts';
const aiBundle = await build({
  stdin: { contents: "export { recognizeFood, compareFoodCandidates } from './src/nutrition-ai';", resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', outfile: 'nutrition-ai-test.mjs', write: false,
});
const { recognizeFood, compareFoodCandidates } = await import(`data:text/javascript;base64,${Buffer.from(aiBundle.outputFiles[0].contents).toString('base64')}`);

test('scales calories by consumed grams including zero-calorie foods', () => {
  assert.equal(calories(250, 50), 125);
  assert.equal(calories(125, 83), 103.8);
  assert.equal(calories(250, 0), 0);
});
test('validates real calendar dates and bounded numeric inputs', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2024-02-29'), true);
  for (const value of ['', null, true, -1, 'NaN', Infinity, 1001]) assert.equal(foodNumber(value,1000,true), null);
  assert.equal(foodNumber('50,5',1000),50.5);
});
test('rejects malformed entries but allows zero calorie meals', () => {
  const entry = { name:'Water', grams:'250', kcal_per_100:'0', meal:'snack', kind:'meal', entry_date:'2026-11-17' };
  assert.ok(readFood(entry));
  for (const change of [{ grams:'0' },{ name:'' },{ kcal_per_100:'' },{ meal:'invalid' },{ kind:'invalid' },{ entry_date:'2026-02-30' }]) assert.equal(readFood({...entry,...change}),null);
});
test('untrusted AI answers preserve missing values and clarification questions', () => {
  const guess = parseFoodGuess('```json\n{"is_food":true,"name":"Rice", "grams":null, "kcal_per_100":null, "questions":["How much oil?"],"note":"Estimate"}\n```');
  assert.equal(guess.grams,null); assert.equal(guess.kcal_per_100,null); assert.deepEqual(guess.questions,['How much oil?']);
  assert.equal(parseFoodGuess('not json'),null);
  assert.equal(parseFoodGuess('{"name":null}'),null);
  assert.equal(parseFoodGuess('{"is_food":true,"name":"Water","kcal_per_100":0}').kcal_per_100,0);
  assert.equal(parseFoodGuess('{"is_food":true,"name":"Oil","kcal_per_100":9999}').kcal_per_100,null);
});

test('AI provenance is conservative and saved entries preserve it', () => {
  assert.equal(parseFoodGuess('{"is_food":true,"name":"Rice","source":"invented"}').source, 'estimate');
  assert.equal(parseFoodGuess('{"is_food":true,"name":"Milk","source":"label"}').source, 'label');
  const entry = {name:'Rice', grams:'100', kcal_per_100:'130', meal:'lunch',kind:'meal',entry_date:'2026-11-17',source:'estimate'};
  assert.equal(readFood(entry).source,'estimate');
  assert.equal(readFood({...entry, source:'unknown'}).source,'manual');
});

test('rejects non-food classification and fails closed when classification is missing', () => {
  const guess = parseFoodGuess('{"is_food":false,"note":"Косметика"}');
  assert.equal(guess.is_food, false);
  assert.equal(guess.name, '');
  assert.deepEqual(guess.questions, []);
  assert.equal(parseFoodGuess('{"name":"Карточка","questions":["Сколько граммов?"]}'), null);
});

test('nutrition image analysis stops before estimation when the photo is not food', async () => {
  let calls = 0;
  const result = await recognizeFood({ run: async () => { calls++; return { response: '{"is_food":false}' }; } }, new Uint8Array([1,2,3]), '', 'ru');
  assert.equal(calls, 1);
  assert.equal(result.is_food, false);
  assert.equal(result.name, '');
});

test('confirmed food gets a separate calorie analysis', async () => {
  let calls = 0;
  const prompts = [];
  const result = await recognizeFood({ run: async (_model, input) => {
    calls++;
    prompts.push(input.messages[0].content[0].text);
    return { response: calls === 1 ? '{"is_food":true}' : '{"is_food":true,"name":"Йогурт","grams":150,"kcal_per_100":62,"questions":[],"note":"С этикетки","source":"label"}' };
  } }, new Uint8Array([1,2,3]), '', 'ru');
  assert.equal(calls, 2);
  assert.match(prompts[0], /sealed packaging/);
  assert.match(prompts[1], /do not misread it as "Карточка"/);
  assert.match(prompts[1], /Never ask the user to tell you the calorie value/);
  assert.equal(result.is_food, true);
  assert.equal(result.kcal_per_100, 62);
});

test('catalog results keep nutrition data and only allow trusted product-image URLs', () => {
  const products = parseFoodSearchResults({products:[
    {code:'4660043858806',product_name:'Картошка',brands:'Ростагрокомплекс',quantity:'50 г',image_front_url:'https://images.openfoodfacts.net/a.jpg',nutriments:{'energy-kcal_100g':413}},
    {code:'4660043858806',product_name:'Duplicate',nutriments:{'energy-kcal_100g':1}},
    {code:'bad-code',product_name:'Fake',image_front_url:'https://example.com/a.jpg',nutriments:{'energy-kcal_100g':99}},
  ]});
  assert.equal(products.length,1);
  assert.equal(products[0].kcal_per_100,413);
  assert.equal(products[0].image,'https://images.openfoodfacts.net/a.jpg');
});

test('catalog text search retries the key product word and boosts a near-matching brand', async () => {
  const originalFetch = globalThis.fetch;
  const target = {code:'4660043858806',product_name:'Сырок творожный глазированный Картошка',brands:'Ростагрокомплекс',nutriments:{'energy-kcal_100g':413}};
  const unrelated = {code:'4600000000001',product_name:'Картошка Пирожное',brands:'Вкусвилл',nutriments:{'energy-kcal_100g':390}};
  const queries=[];
  globalThis.fetch = async url => {
    const term = new URL(url).searchParams.get('search_terms'); queries.push(term);
    const products = term === 'картошка' ? [unrelated,target] : [];
    return new Response(JSON.stringify({products}),{headers:{'content-type':'application/json'}});
  };
  try {
    const matches = await searchFoodProducts('Пирожное Картошка','Росагрокомплекс');
    assert.ok(queries.includes('картошка'));
    assert.equal(matches[0].code,'4660043858806');
    assert.equal(matches[0].kcal_per_100,413);
  } finally { globalThis.fetch=originalFetch; }
});

test('visual catalog matching compares the original photo with candidate package photos', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}});
  try {
    let input;
    const result = await compareFoodCandidates({run:async (_model, value) => { input=value; return {response:'{"code":"4660043858806","confidence":"high"}'}; }},new Uint8Array([4,5,6]),[
      {code:'4660043858806',name:'Пирожное Картошка',brand:'Ростагрокомплекс',quantity:'50 г',kcal_per_100:413,image:'https://images.openfoodfacts.net/product.jpg',source_url:'https://world.openfoodfacts.net/product/4660043858806'},
    ]);
    assert.equal(result.code,'4660043858806');
    assert.equal(result.confidence,'high');
    assert.equal(input.messages[0].content.filter(part=>part.type==='image_url').length,2);
  } finally { globalThis.fetch=originalFetch; }
});

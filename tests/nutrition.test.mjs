import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { calories, readFood, parseFoodGuess, validDate, foodNumber } from '../src/nutrition-data.ts';
const aiBundle = await build({
  stdin: { contents: "export { recognizeFood } from './src/nutrition-ai';", resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', outfile: 'nutrition-ai-test.mjs', write: false,
});
const { recognizeFood } = await import(`data:text/javascript;base64,${Buffer.from(aiBundle.outputFiles[0].contents).toString('base64')}`);

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
  const result = await recognizeFood({ run: async (_model, input) => {
    calls++;
    return { response: calls === 1 ? '{"is_food":true}' : '{"is_food":true,"name":"Йогурт","grams":150,"kcal_per_100":62,"questions":[],"note":"С этикетки","source":"label"}' };
  } }, new Uint8Array([1,2,3]), '', 'ru');
  assert.equal(calls, 2);
  assert.equal(result.is_food, true);
  assert.equal(result.kcal_per_100, 62);
});

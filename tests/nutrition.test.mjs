import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calories, readFood, parseFoodGuess, validDate, foodNumber } from '../src/nutrition-data.ts';

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
  const guess = parseFoodGuess('```json\n{"name":"Rice", "grams":null, "kcal_per_100":null, "questions":["How much oil?"],"note":"Estimate"}\n```');
  assert.equal(guess.grams,null); assert.equal(guess.kcal_per_100,null); assert.deepEqual(guess.questions,['How much oil?']);
  assert.equal(parseFoodGuess('not json'),null);
  assert.equal(parseFoodGuess('{"name":null}'),null);
  assert.equal(parseFoodGuess('{"name":"Water","kcal_per_100":0}').kcal_per_100,0);
  assert.equal(parseFoodGuess('{"name":"Oil","kcal_per_100":9999}').kcal_per_100,null);
});

test('AI provenance is conservative and saved entries preserve it', () => {
  assert.equal(parseFoodGuess('{"name":"Rice","source":"invented"}').source, 'estimate');
  assert.equal(parseFoodGuess('{"name":"Milk","source":"label"}').source, 'label');
  const entry = {name:'Rice', grams:'100', kcal_per_100:'130', meal:'lunch',kind:'meal',entry_date:'2026-11-17',source:'estimate'};
  assert.equal(readFood(entry).source,'estimate');
  assert.equal(readFood({...entry, source:'unknown'}).source,'manual');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const built = await build({ entryPoints: ['src/client.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { COMMON_JS } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const swift = readFileSync('ios/SpendTracker/ContentView.swift', 'utf8');
const bridge = swift.match(/private static let authBridge = #"""([\s\S]*?)"""#/)[1];

function page(native) {
  const timers = [], listeners = {}, classes = [];
  const link = { href: '/friends?period=week', parentNode: { style: { getPropertyValue: () => '-1', setProperty() {} } }, addEventListener(name, fn) { listeners[name] = fn; } };
  const reveal = { classList: { add(value) { classes.push(value); } }, querySelectorAll: () => [] };
  const context = { __spendTrackerNative: native, location: { href: '' },
    matchMedia: () => ({ matches: false }),
    document: { documentElement: { classList: { remove() {} } },
      querySelector: () => null,
      querySelectorAll: selector => selector === '.seg a' ? [link] : selector.includes('.reveal') ? [reveal] : [] },
    IntersectionObserver: class { observe() {} },
    setTimeout(fn, delay) { timers.push({ fn, delay }); },
  };
  context.window = context;
  vm.runInNewContext(COMMON_JS, context);
  return { context, timers, listeners, classes };
}

test('iOS renders reveal content immediately and navigates segments without a timer', () => {
  const p = page(true);
  assert.ok(p.classes.includes('in'));
  p.listeners.click({ preventDefault() {} });
  assert.equal(p.context.location.href, '/friends?period=week');
  assert.equal(p.timers.length, 0);
});

test('browser segment animation retains its existing delay', () => {
  const p = page(false);
  p.listeners.click({ preventDefault() {} });
  assert.equal(p.context.location.href, '');
  assert.equal(p.timers[0].delay, 230);
  p.timers[0].fn();
  assert.equal(p.context.location.href, '/friends?period=week');
});

test('native bridge invalidates page reuse before and after mutations, including failures', async () => {
  const messages = [];
  let reject = false;
  const context = { location: { origin: 'https://traaaack.app' }, document: { addEventListener() {} },
    fetch: async () => { if (reject) throw Error('network'); return 'ok'; },
    webkit: { messageHandlers: { nativeSpeech: { postMessage: m => messages.push(m.action) } } } };
  context.window = context;
  vm.runInNewContext(bridge, context);
  assert.equal(await context.fetch('/nutrition'), 'ok');
  assert.equal(messages.length, 0);
  await context.fetch('/nutrition', { method: 'POST' });
  assert.deepEqual(messages, ['invalidatePages', 'invalidatePages']);
  messages.length = 0;
  reject = true;
  await assert.rejects(context.fetch({ method: 'DELETE' }));
  assert.equal(messages.length, 2);
});

test('native bridge does not modify a third-party authentication page', () => {
  const original = () => {};
  const context = { location: { origin: 'https://oauth.telegram.org' }, fetch: original };
  context.window = context;
  vm.runInNewContext(bridge, context);
  assert.equal(context.fetch, original);
  assert.equal(context.__spendTrackerNative, undefined);
});

test('all embedded native bridge scripts parse', () => {
  for (const match of swift.matchAll(/private static let \w+ = #"""([\s\S]*?)"""#/g)) new vm.Script(match[1]);
});

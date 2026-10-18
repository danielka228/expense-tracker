// Копирует распознаватель штрих-кодов (для Safari на iPhone, где нет встроенного BarcodeDetector)
// в public/vendor, чтобы сайт отдавал его сам, без внешних CDN. Запускается автоматически перед деплоем.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'public/vendor');
mkdirSync(out, { recursive: true });

// zxing-wasm может лежать рядом или внутри barcode-detector (если версии разошлись)
const bd = join(root, 'node_modules/barcode-detector');
const zx = [join(bd, 'node_modules/zxing-wasm'), join(root, 'node_modules/zxing-wasm')].find(existsSync);
copyFileSync(join(bd, 'dist/iife/ponyfill.js'), join(out, 'barcode-detector.js'));
copyFileSync(join(zx, 'dist/reader/zxing_reader.wasm'), join(out, 'zxing_reader.wasm'));
console.log('vendor: barcode-detector.js, zxing_reader.wasm -> public/vendor');

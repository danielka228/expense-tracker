// Поиск товара по штрих-коду (Open Food Facts) и магазинов рядом (OpenStreetMap / Overpass).
// Ответы внешних сервисов кэшируются в D1: Cache API на *.workers.dev не работает.

import { tidyProduct } from './vision';

const UA = 'SpendTracker/1.0 (expense tracker; https://github.com/danielka228/expense-tracker)';
const PRODUCT_TTL_DAYS = 30;
const MISSING_TTL_DAYS = 1;
const STORES_TTL_HOURS = 24;

export interface Product {
  barcode: string;
  found: boolean;
  name: string | null;
  brand: string | null;
  quantity: string | null;
  image: string | null;
  category: string | null;
}

export interface Store {
  name: string;
  kind: string;
  category: string | null;
  distance: number;
  color: string;
  custom?: boolean; // магазин добавили сами пользователи
}

// ---------- товары ----------

// Категория по тегам открытых баз; почти всё в Open Food Facts — еда и напитки
function productCategory(tags: string[]): string | null {
  const t = tags.join(' ');
  if (/:(tobacco|cigarettes|cigars|heated-tobacco|e-cigarettes|vapes)/.test(t)) return 'Табак';
  if (/en:(beauty|cosmetics|hygiene|toothpastes|shampoos)/.test(t)) return 'Здоровье';
  if (tags.length) return 'Еда';
  return null;
}

export function parseOffProduct(barcode: string, json: unknown): Product {
  const j = json as { status?: number; product?: Record<string, unknown> };
  const p = j?.product;
  if (!p || j.status === 0) return { barcode, found: false, name: null, brand: null, quantity: null, image: null, category: null };
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const name = str(p.product_name_ru) ?? str(p.product_name) ?? str(p.generic_name_ru) ?? str(p.generic_name);
  // В brands бывает и торговая марка, и юрлицо («COCA-COLA SERVICES SA/NV») — юрлица отбрасываем, из остального берём самое короткое
  // Граница слова задана вручную: \b в JavaScript не работает с кириллицей
  const LEGAL = /(^|[\s.(\/])(s\.?a\.?|n\.?v\.?|llc|ltd|gmbh|inc|corp|company|services|ооо|оао|зао|пао|ао)(?=$|[\s.,)\/])/i;
  const brand = (str(p.brands) ?? '').split(',').map((b) => b.trim()).filter((b) => b && !LEGAL.test(b)).sort((a, b) => a.length - b.length)[0] ?? null;
  const tags = Array.isArray(p.categories_tags) ? (p.categories_tags as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  return {
    barcode,
    found: Boolean(name || brand),
    name,
    brand,
    quantity: str(p.quantity),
    image: str(p.image_front_small_url) ?? str(p.image_small_url),
    category: productCategory(tags),
  };
}

// Открытые базы одного проекта с одинаковым API: еда и напитки, прочие товары, косметика и бытовое
const PRODUCT_SOURCES = ['world.openfoodfacts.org', 'world.openproductsfacts.org', 'world.openbeautyfacts.org'];
const NOT_FOUND = (barcode: string): Product => ({ barcode, found: false, name: null, brand: null, quantity: null, image: null, category: null });

// ai — Workers AI (необязательно): приводит найденное в базе название в порядок, результат кэшируется вместе с товаром
export async function lookupProduct(db: D1Database, barcode: string, ai?: Ai): Promise<Product> {
  // Названия, которые вписали пользователи, не устаревают; ответы баз кэшируются на время
  const cached = await db
    .prepare(
      `SELECT barcode, found, name, brand, quantity, image, category FROM products
       WHERE barcode = ? AND (source = 'user' OR fetched_at > datetime('now', CASE WHEN found THEN ? ELSE ? END))`,
    )
    .bind(barcode, `-${PRODUCT_TTL_DAYS} days`, `-${MISSING_TTL_DAYS} days`)
    .first<Omit<Product, 'found'> & { found: number }>();
  if (cached) return { ...cached, found: Boolean(cached.found) };

  let product = NOT_FOUND(barcode);
  let answered = false;
  for (const host of PRODUCT_SOURCES) {
    try {
      const res = await fetch(
        `https://${host}/api/v2/product/${barcode}.json?fields=product_name,product_name_ru,generic_name,generic_name_ru,brands,quantity,image_front_small_url,image_small_url,categories_tags&lc=ru`,
        { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000) },
      );
      if (res.status !== 404 && !res.ok) continue;
      answered = true;
      if (res.ok) product = parseOffProduct(barcode, await res.json());
      if (product.found) break;
    } catch {
      /* база недоступна — пробуем следующую */
    }
  }
  // Ни одна база не ответила — не кэшируем, попробуем в следующий раз
  if (!answered) return product;

  if (ai && product.found) {
    const g = await tidyProduct(ai, product);
    if (g) {
      // В аккуратное название уже вошли бренд и объём. Категорию из тегов базы оставляем, если она не просто «Еда»
      product = { ...product, name: g.name, brand: null, quantity: null, category: product.category && product.category !== 'Еда' ? product.category : g.category };
    }
  }

  await db
    .prepare(
      `INSERT INTO products (barcode, found, name, brand, quantity, image, category, source, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'off', datetime('now'))
       ON CONFLICT(barcode) DO UPDATE SET found = excluded.found, name = excluded.name, brand = excluded.brand,
         quantity = excluded.quantity, image = excluded.image, category = excluded.category, fetched_at = excluded.fetched_at
       WHERE products.source <> 'user'`,
    )
    .bind(barcode, product.found ? 1 : 0, product.name, product.brand, product.quantity, product.image, product.category)
    .run();
  return product;
}

// Товара нет ни в одной базе, а пользователь вписал название — запоминаем его для всех.
// Найденные в базах товары не перезаписываем.
export async function rememberProduct(db: D1Database, barcode: string, name: string, category: string) {
  await db
    .prepare(
      `INSERT INTO products (barcode, found, name, category, source, fetched_at) VALUES (?, 1, ?, ?, 'user', datetime('now'))
       ON CONFLICT(barcode) DO UPDATE SET found = 1, name = excluded.name, category = excluded.category, source = 'user', fetched_at = excluded.fetched_at
       WHERE products.found = 0 OR products.source = 'user'`,
    )
    .bind(barcode, name.slice(0, 120), category)
    .run();
}

// История цен по штрих-коду: свои покупки и средние цены у всех по магазинам за 90 дней
export async function priceHistory(db: D1Database, barcode: string, userId: number) {
  const [mine, stores] = await db.batch([
    db
      .prepare(
        `SELECT amount, store, expense_date AS date FROM expenses
         WHERE barcode = ? AND user_id = ? ORDER BY expense_date DESC, id DESC LIMIT 3`,
      )
      .bind(barcode, userId),
    db
      .prepare(
        `SELECT COALESCE(store, '') AS store, COUNT(*) AS n, ROUND(AVG(amount), 2) AS avg, MIN(amount) AS min
         FROM expenses WHERE barcode = ? AND expense_date >= date('now', '-90 days')
         GROUP BY COALESCE(store, '') ORDER BY n DESC LIMIT 5`,
      )
      .bind(barcode),
  ]);
  return {
    mine: mine.results as { amount: number; store: string | null; date: string }[],
    stores: (stores.results as { store: string; n: number; avg: number; min: number }[]).map((r) => ({ ...r, store: r.store || null })),
  };
}

// ---------- магазины ----------

// База торговых сетей: нормализованное название, цвет значка и категория трат
const CHAINS: { re: RegExp; name: string; color: string; category: string }[] = [
  { re: /пят[её]рочк/i, name: 'Пятёрочка', color: '#e3262f', category: 'Еда' },
  { re: /магнит.*косметик/i, name: 'Магнит Косметик', color: '#d6206f', category: 'Здоровье' },
  { re: /магнит/i, name: 'Магнит', color: '#e4003a', category: 'Еда' },
  { re: /перекр[её]ст/i, name: 'Перекрёсток', color: '#0d7a3a', category: 'Еда' },
  { re: /вкусвилл/i, name: 'ВкусВилл', color: '#3bb54a', category: 'Еда' },
  { re: /дикси/i, name: 'Дикси', color: '#f37021', category: 'Еда' },
  { re: /лента/i, name: 'Лента', color: '#003d8f', category: 'Еда' },
  { re: /ашан|auchan/i, name: 'Ашан', color: '#e2001a', category: 'Еда' },
  { re: /азбука вкуса/i, name: 'Азбука вкуса', color: '#1d1d1b', category: 'Еда' },
  { re: /spar|спар/i, name: 'SPAR', color: '#00843d', category: 'Еда' },
  { re: /магнолия/i, name: 'Магнолия', color: '#0f9d58', category: 'Еда' },
  { re: /верный/i, name: 'Верный', color: '#e30613', category: 'Еда' },
  { re: /чижик/i, name: 'Чижик', color: '#ffd400', category: 'Еда' },
  { re: /светофор/i, name: 'Светофор', color: '#e30613', category: 'Еда' },
  { re: /окей|o'?key/i, name: 'О’КЕЙ', color: '#e31e24', category: 'Еда' },
  { re: /metro|метро c&c/i, name: 'METRO', color: '#003b7e', category: 'Еда' },
  { re: /глобус/i, name: 'Глобус', color: '#f39200', category: 'Еда' },
  { re: /красное ?& ?белое|красное и белое/i, name: 'Красное&Белое', color: '#b5121b', category: 'Еда' },
  { re: /бристоль/i, name: 'Бристоль', color: '#1c3f94', category: 'Еда' },
  { re: /fix ?price|фикс ?прайс/i, name: 'Fix Price', color: '#0057b8', category: 'Прочее' },
  { re: /самокат/i, name: 'Самокат', color: '#ff335f', category: 'Еда' },
  { re: /вкусно ?[-—и]? ?точка/i, name: 'Вкусно — и точка', color: '#1e7d3c', category: 'Еда' },
  { re: /kfc|rostic|ростикс/i, name: 'Rostic’s', color: '#e4002b', category: 'Еда' },
  { re: /бургер кинг|burger king/i, name: 'Бургер Кинг', color: '#d62300', category: 'Еда' },
  { re: /шоколадниц/i, name: 'Шоколадница', color: '#6b3a2a', category: 'Еда' },
  { re: /кофе хауз|coffee house/i, name: 'Кофе Хауз', color: '#7a1e2b', category: 'Еда' },
  { re: /cofix|кофикс/i, name: 'Cofix', color: '#c2185b', category: 'Еда' },
  { re: /аптека|36[,.]6|ригла|горздрав|асна|столички/i, name: '', color: '#2fb36b', category: 'Здоровье' },
  { re: /лукойл|роснефть|газпромнефть|shell|татнефть/i, name: '', color: '#e4002b', category: 'Транспорт' },
];

const KIND_CATEGORY: Record<string, string> = {
  supermarket: 'Еда', convenience: 'Еда', grocery: 'Еда', greengrocer: 'Еда', bakery: 'Еда', butcher: 'Еда',
  alcohol: 'Еда', beverages: 'Еда', confectionery: 'Еда', deli: 'Еда', cafe: 'Еда', restaurant: 'Еда',
  fast_food: 'Еда', bar: 'Развлечения', pub: 'Развлечения', cinema: 'Развлечения', pharmacy: 'Здоровье',
  chemist: 'Здоровье', cosmetics: 'Здоровье', clothes: 'Одежда', shoes: 'Одежда', fuel: 'Транспорт',
  tobacco: 'Табак', 'e-cigarette': 'Табак', kiosk: 'Еда', pastry: 'Еда', seafood: 'Еда', ice_cream: 'Еда',
};
const PALETTE = ['#5f8cf7', '#2fc487', '#f68a41', '#ef6a9c', '#9a72f7', '#30c2b4', '#efb73d', '#ec5a70'];

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type PlacedStore = Store & { lat: number; lon: number };

export function parseOverpass(json: unknown, lat: number, lon: number): PlacedStore[] {
  const elements = ((json as { elements?: unknown[] })?.elements ?? []) as {
    lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string>;
  }[];
  const seen = new Map<string, PlacedStore>();
  for (const el of elements) {
    const t = el.tags ?? {};
    const raw = t['name:ru'] || t.name || t.brand;
    const pLat = el.lat ?? el.center?.lat;
    const pLon = el.lon ?? el.center?.lon;
    if (!raw || pLat === undefined || pLon === undefined) continue;
    const kind = t.shop || t.amenity || '';
    const chain = CHAINS.find((c) => c.re.test(`${raw} ${t.brand ?? ''}`));
    const name = chain?.name || raw;
    const store: PlacedStore = {
      name,
      lat: pLat,
      lon: pLon,
      kind,
      category: chain?.category ?? KIND_CATEGORY[kind] ?? null,
      distance: Math.round(distanceM(lat, lon, pLat, pLon)),
      color: chain?.color ?? PALETTE[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % PALETTE.length],
    };
    const prev = seen.get(name);
    if (!prev || store.distance < prev.distance) seen.set(name, store);
  }
  return [...seen.values()].sort((a, b) => a.distance - b.distance).slice(0, 20);
}

// Запасной источник — Nominatim (поиск OpenStreetMap): ищем типы мест в квадрате ~300 м вокруг точки
const NOMINATIM_QUERIES = [
  'supermarket', 'convenience store', 'bakery', 'cafe', 'fast food', 'restaurant',
  'pharmacy', 'kiosk', 'tobacco shop', 'alcohol shop', 'butcher', 'greengrocer',
];

export function parseNominatim(lists: unknown[], lat: number, lon: number): PlacedStore[] {
  const elements = lists.flatMap((l) => (Array.isArray(l) ? l : [])).map((it) => {
    const r = it as { lat?: string; lon?: string; name?: string; category?: string; type?: string; namedetails?: Record<string, string> };
    const tags: Record<string, string> = { name: r.name || r.namedetails?.name || '' };
    if (r.namedetails?.['name:ru']) tags['name:ru'] = r.namedetails['name:ru'];
    if (r.namedetails?.brand) tags.brand = r.namedetails.brand;
    if (r.category === 'amenity') tags.amenity = r.type ?? ''; else tags.shop = r.type ?? '';
    return { lat: Number(r.lat), lon: Number(r.lon), tags };
  });
  return parseOverpass({ elements }, lat, lon);
}

async function nominatimStores(lat: number, lon: number, errors: string[]): Promise<PlacedStore[] | null> {
  const d = 0.003;
  const box = [lon - d * 1.8, lat + d, lon + d * 1.8, lat - d].map((x) => x.toFixed(5)).join(',');
  const lists: unknown[] = [];
  let ok = false;
  // Запросы идут группами по 3, чтобы не долбить публичный Nominatim; результат кэшируется на сутки
  for (let i = 0; i < NOMINATIM_QUERIES.length; i += 3) {
    await Promise.all(
      NOMINATIM_QUERIES.slice(i, i + 3).map(async (q) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&viewbox=${box}&bounded=1&format=jsonv2&limit=15&namedetails=1&accept-language=ru`,
            { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
          );
          if (!res.ok) { errors.push(`nominatim ${q}: HTTP ${res.status}`); return; }
          lists.push(await res.json());
          ok = true;
        } catch (e) {
          errors.push(`nominatim ${q}: ${(e as Error).message}`);
        }
      }),
    );
  }
  return ok ? parseNominatim(lists, lat, lon) : null;
}

// Расстояния всегда считаем от настоящей точки пользователя, а не от округлённой
// Магазины, которые добавили пользователи, стоят в общем списке и вытесняют одноимённые с карты
function byDistance(stores: PlacedStore[], lat: number, lon: number, own: PlacedStore[] = []): Store[] {
  const all = new Map<string, Store>();
  for (const { lat: sLat, lon: sLon, ...st } of [...stores, ...own]) {
    const s = { ...st, distance: Math.round(distanceM(lat, lon, sLat, sLon)) };
    const k = s.name.toLowerCase();
    const prev = all.get(k);
    if (!prev || s.custom || s.distance < prev.distance) all.set(k, s);
  }
  return [...all.values()].sort((a, b) => a.distance - b.distance).slice(0, 12);
}

// ---------- магазины, добавленные пользователями ----------

const PLACE_RADIUS_DEG = 0.004; // ~400 м по широте

async function customPlaces(db: D1Database, lat: number, lon: number): Promise<PlacedStore[]> {
  const dLon = PLACE_RADIUS_DEG / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const { results } = await db
    .prepare('SELECT name, category, lat, lon FROM places WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT 50')
    .bind(lat - PLACE_RADIUS_DEG, lat + PLACE_RADIUS_DEG, lon - dLon, lon + dLon)
    .all<{ name: string; category: string | null; lat: number; lon: number }>();
  return results.map((r) => {
    const chain = CHAINS.find((c) => c.name && c.re.test(r.name));
    return {
      name: chain?.name || r.name,
      kind: 'custom',
      category: r.category ?? chain?.category ?? null,
      lat: r.lat,
      lon: r.lon,
      distance: 0,
      color: chain?.color ?? PALETTE[[...r.name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % PALETTE.length],
      custom: true,
    };
  });
}

// Пользователь вписал магазин, которого не было в подсказках, — запоминаем его в этом месте.
// Если рядом (~100 м) уже есть место с таким же названием, второй раз не добавляем.
export async function rememberPlace(db: D1Database, name: string, category: string | null, lat: number, lon: number, userId: number) {
  const d = 0.001;
  const exists = await db
    .prepare('SELECT 1 FROM places WHERE lower(name) = lower(?) AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?')
    .bind(name, lat - d, lat + d, lon - d * 2, lon + d * 2)
    .first();
  if (exists) return;
  // Координаты округляем до ~10 м: этого хватает, чтобы найти магазин, и не хранит точную точку
  await db
    .prepare('INSERT INTO places (name, category, lat, lon, added_by) VALUES (?, ?, ?, ?, ?)')
    .bind(name.slice(0, 80), category, Number(lat.toFixed(4)), Number(lon.toFixed(4)), userId)
    .run();
}

// Зеркала OpenStreetMap Overpass по очереди: главный сервер не всегда принимает запросы из Cloudflare
const OVERPASS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function nearbyStores(db: D1Database, lat: number, lon: number): Promise<{ stores: Store[]; error?: string }> {
  // Округляем до ~100 м: соседние запросы попадают в один кэш, а точные координаты не хранятся
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const [cached, own] = await Promise.all([
    db
      .prepare(`SELECT json FROM stores_cache WHERE key = ? AND fetched_at > datetime('now', ?)`)
      .bind(key, `-${STORES_TTL_HOURS} hours`)
      .first<{ json: string }>(),
    customPlaces(db, lat, lon),
  ]);
  if (cached) return { stores: byDistance(JSON.parse(cached.json) as PlacedStore[], lat, lon, own) };

  const cLat = Number(lat.toFixed(3));
  const cLon = Number(lon.toFixed(3));
  const around = `around:300,${cLat},${cLon}`;
  const q = `[out:json][timeout:10];(
    nwr(${around})["shop"]["name"];
    nwr(${around})["amenity"~"^(cafe|restaurant|fast_food|food_court|ice_cream|bar|pub|pharmacy|fuel|cinema)$"]["name"];
  );out center 60;`;

  // Все зеркала опрашиваются одновременно, берётся первый успешный ответ
  const errors: string[] = [];
  const json: unknown = await Promise.any(
    OVERPASS.map(async (url) => {
      const host = new URL(url).host;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: 'data=' + encodeURIComponent(q),
          signal: AbortSignal.timeout(7000),
        });
        if (res.ok) return await res.json();
        errors.push(`${host}: HTTP ${res.status} ${(await res.text()).slice(0, 80).replace(/\s+/g, ' ')}`);
      } catch (e) {
        errors.push(`${host}: ${(e as Error).message}`);
      }
      throw new Error(host);
    }),
  ).catch(() => null);

  const stores = json ? parseOverpass(json, cLat, cLon) : await nominatimStores(cLat, cLon, errors);
  // Карта недоступна — показываем хотя бы магазины, добавленные пользователями
  if (!stores) return { stores: byDistance([], lat, lon, own), error: errors.join('; ') };
  await db
    .prepare(
      `INSERT INTO stores_cache (key, json, fetched_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`,
    )
    .bind(key, JSON.stringify(stores))
    .run();
  return { stores: byDistance(stores, lat, lon, own) };
}

export interface FoodProductMatch {
  code: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  kcal_per_100: number | null;
  image: string | null;
  source_url: string;
}

const text = (value: unknown, max = 160): string | null => typeof value === 'string' && value.trim() ? value.replace(/[<>\u0000-\u001f]/g, ' ').trim().slice(0, max) : null;
const imageUrl = (value: unknown): string | null => {
  const raw = text(value, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && ['images.openfoodfacts.org','images.openfoodfacts.net'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
};

export function parseFoodSearchResults(value: unknown): FoodProductMatch[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { products?: unknown }).products)) return [];
  const output: FoodProductMatch[] = [];
  const seen = new Set<string>();
  for (const raw of (value as { products: unknown[] }).products) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    const code = text(p.code ?? p._id, 20);
    const name = text(p.product_name_ru ?? p.product_name, 160);
    if (!code || !/^\d{8,14}$/.test(code) || !name || seen.has(code)) continue;
    seen.add(code);
    const nutriments = p.nutriments && typeof p.nutriments === 'object' ? p.nutriments as Record<string, unknown> : {};
    const kcal = Number(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal_value']);
    output.push({
      code,
      name,
      brand: text(p.brands, 100),
      quantity: text(p.quantity, 60),
      kcal_per_100: Number.isFinite(kcal) && kcal >= 0 && kcal <= 1000 ? kcal : null,
      image: imageUrl(p.image_front_url ?? p.image_front_small_url),
      source_url: `https://world.openfoodfacts.net/product/${code}`,
    });
  }
  return output;
}

const key = (s: string) => s.toLocaleLowerCase().normalize('NFKC').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function closeBrand(a: string, b: string) {
  if (a === b || a.includes(b) || b.includes(a)) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 6) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Search text candidates in Open Food Facts; try product name and brand/name parts separately for imperfect OCR. */
export async function searchFoodProducts(name: string, brand: string | null): Promise<FoodProductMatch[]> {
  const words = key(name).split(/\s+/).filter(Boolean);
  const productWord = words.at(-1) || '';
  const queries = [...new Set([name, brand && productWord ? `${brand} ${productWord}` : '', productWord].map(q => key(q)).filter(q => q.length >= 3))].slice(0, 3);
  const responses = await Promise.allSettled(queries.map(async query => {
    const url = new URL('https://world.openfoodfacts.net/cgi/search.pl');
    url.search = new URLSearchParams({
      action: 'process', json: '1', search_terms: query,
      fields: 'code,product_name,product_name_ru,brands,quantity,image_front_url,image_front_small_url,nutriments',
      sort_by: 'unique_scans_n', page_size: '8',
    }).toString();
    const response = await fetch(url, { headers: { 'User-Agent': 'SpendTrackerFoodDiary/1.0 (https://traaaack.app)' }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return [];
    return parseFoodSearchResults(await response.json());
  }));
  const found = new Map<string, FoodProductMatch>();
  for (const response of responses) if (response.status === 'fulfilled') for (const product of response.value) found.set(product.code, product);
  const brandKey = brand ? key(brand) : '';
  const nameTokens = new Set(words.filter(w => w.length > 2));
  const score = (p: FoodProductMatch) => {
    const productTokens = new Set(key(`${p.name} ${p.brand || ''}`).split(' '));
    let overlap = 0;
    for (const token of nameTokens) if (productTokens.has(token)) overlap++;
    const candidateBrand = p.brand ? key(p.brand) : '';
    const brandMatch = brandKey && candidateBrand && closeBrand(candidateBrand, brandKey) ? 2 : 0;
    return brandMatch + overlap / Math.max(1, nameTokens.size) + (p.image ? 0.05 : 0);
  };
  return [...found.values()].sort((a, b) => score(b) - score(a)).slice(0, 8);
}

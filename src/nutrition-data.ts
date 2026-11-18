export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export interface Food {
  id: number; name: string; grams: number; kcal_per_100: number; price?: number | null;
  meal: typeof MEALS[number]; entry_date: string; kind: 'meal' | 'purchase'; expense_id: number | null; source?: 'manual' | 'estimate' | 'label' | 'catalog';
}
export function foodNumber(value: unknown, max: number, zero = false): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (String(value).trim() === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n <= max && (zero ? n >= 0 : n > 0) ? n : null;
}
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export const calories = (grams: number, per100: number) => Math.round(grams * per100 / 100 * 10) / 10;
export function readFood(f: Record<string, unknown>) {
  const name = typeof f.name === 'string' ? f.name.trim() : '';
  const grams = foodNumber(f.grams, 100000);
  const kcal = foodNumber(f.kcal_per_100, 1000, true);
  const meal = MEALS.find(m => m === f.meal);
  if (!name || name.length > 120 || grams === null || kcal === null || !meal || !validDate(f.entry_date) || !['meal','purchase'].includes(String(f.kind))) return null;
  const source = ['estimate', 'label', 'catalog'].includes(String(f.source)) ? String(f.source) : 'manual';
  return { name, grams, kcal, meal, date: f.entry_date, kind: String(f.kind), source };
}
export interface FoodGuess {
  is_food: boolean; name: string; brand: string | null; grams: number | null; kcal_per_100: number | null; questions: string[]; note: string; source: 'estimate' | 'label';
}
const clean = (x: unknown, max: number) => typeof x === 'string' ? x.replace(/[<>\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
export function parseFoodGuess(raw: string): FoodGuess | null {
  try {
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start < 0 || end < start) return null;
    const j = JSON.parse(raw.slice(start, end + 1));
    if (!j || typeof j !== 'object') return null;
    if (j.is_food === false) return { is_food: false, name: '', brand: null, grams: null, kcal_per_100: null, questions: [], note: clean(j.note, 500), source: 'estimate' };
    if (j.is_food !== true) return null;
    const name = clean(j.name, 120);
    const questions = Array.isArray(j.questions) ? j.questions.map((q: unknown) => clean(q, 250)).filter(Boolean).slice(0, 4) : [];
    if (!name && !questions.length) return null;
    return { is_food: true, name, brand: clean(j.brand, 80) || null, source: j.source === 'label' ? 'label' : 'estimate', grams: foodNumber(j.grams, 100000), kcal_per_100: foodNumber(j.kcal_per_100, 1000, true), questions, note: clean(j.note, 500) };
  } catch { return null; }
}

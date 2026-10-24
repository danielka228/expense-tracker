// Курсы для сравнения сумм в разных валютах — сколько единиц валюты в 1 USD.
// Прикидочные на октябрь 2026, обновляются вручную; точность до копейки тут не нужна.
export const RATES_PER_USD: Record<string, number> = { USD: 1, RUB: 82, KZT: 449, AED: 3.6725, EUR: 0.92, KGS: 87.5, UZS: 11900 };
const rate = (cur: string) => RATES_PER_USD[cur] ?? RATES_PER_USD.RUB;
// Перевод суммы из одной валюты в другую через USD.
export const convert = (amount: number, from: string, to: string) => (from === to ? amount : (amount / rate(from)) * rate(to));

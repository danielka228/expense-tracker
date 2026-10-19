// Стикерпак Трэка. Картинки (public/stickers/NN.png, 512×512) рисует scripts/make-stickers.mts,
// а бот по команде /stickers выпускает из них набор в Telegram (createNewStickerSet).
// Чтобы добавить стикер: допиши строку в конец списка и перерисуй картинки — при следующем /stickers
// от владельца набора бот допишет новые стикеры в уже выпущенный набор.

import type { Mood } from './mascot';

export interface StickerDef {
  mood: Mood;
  caption: string; // \n — перенос строки
  prop?: string; // эмодзи-деталь рядом с Трэком
  emoji: string[]; // по каким эмодзи Telegram предлагает стикер
}

export const STICKERS: StickerDef[] = [
  { mood: 'wave', caption: 'Привет!', emoji: ['👋', '😊'] },
  { mood: 'happy', caption: 'Записал!', prop: '✅', emoji: ['✅', '👍'] },
  { mood: 'wow', caption: 'Сколько?!', emoji: ['😱', '😳'] },
  { mood: 'worried', caption: 'Опять кофе?', prop: '☕', emoji: ['☕', '😬'] },
  { mood: 'sleep', caption: 'Ноль трат', emoji: ['😴', '💤'] },
  { mood: 'wink', caption: 'Всё под\nконтролем', emoji: ['😉', '👌'] },
  { mood: 'love', caption: 'Кэшбэк!', prop: '💸', emoji: ['😍', '💸'] },
  { mood: 'sad', caption: 'Денег нет', emoji: ['😢', '💔'] },
  { mood: 'cool', caption: 'Богач', prop: '💰', emoji: ['😎', '💰'] },
  { mood: 'happy', caption: 'Зарплата!', prop: '💵', emoji: ['🤑', '💵'] },
  { mood: 'wow', caption: 'Скидка?!', prop: '🏷️', emoji: ['🤩', '🏷'] },
  { mood: 'worried', caption: 'До зарплаты\n3 дня', emoji: ['😬', '📅'] },
  { mood: 'happy', caption: 'Копим!', prop: '🌱', emoji: ['🌱', '💪'] },
  { mood: 'love', caption: 'Шаурма —\nлюбовь', prop: '🌯', emoji: ['🌯', '❤️'] },
  { mood: 'cool', caption: 'Экономлю', emoji: ['😎', '🧘'] },
  { mood: 'sad', caption: 'Это не я\nпотратил', prop: '🙈', emoji: ['🙈', '😅'] },
];

export const stickerFile = (i: number) => `/stickers/${String(i + 1).padStart(2, '0')}.png`;

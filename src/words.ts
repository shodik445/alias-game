import type { Word } from './types';

export const wordBank: Record<string, Word[]> = {
  uz: [
    { id: 1, text: "Anor", difficulty: "easy" },
    { id: 2, text: "Kitob", difficulty: "easy" },
    { id: 3, text: "Mashina", difficulty: "easy" },
    { id: 4, text: "Kompyuter", difficulty: "medium" },
    { id: 5, text: "G'alaba", difficulty: "medium" },
    { id: 6, text: "Samolyot", difficulty: "easy" },
    { id: 7, text: "Muzqaymoq", difficulty: "medium" },
    { id: 8, text: "Tadbirkor", difficulty: "hard" },
    { id: 9, text: "Oila", difficulty: "easy" },
    { id: 10, text: "Maktab", difficulty: "easy" },
    { id: 11, text: "Qovun", difficulty: "easy" },
    { id: 12, text: "Dasturchi", difficulty: "hard" },
    { id: 13, text: "Choynak", difficulty: "easy" },
    { id: 14, text: "Do'stlik", difficulty: "medium" },
    { id: 15, text: "Kelajak", difficulty: "hard" }
  ],
  en: [
    { id: 101, text: "Apple", difficulty: "easy" },
    { id: 102, text: "Universe", difficulty: "hard" },
    { id: 103, text: "Laptop", difficulty: "medium" }
  ]
};
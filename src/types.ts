// src/types.ts
export type GameState = 'START' | 'PLAYING' | 'REVIEW' | 'GAME_OVER';

export interface Word {
  id: number;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Team {
  name: string;
  score: number;
}
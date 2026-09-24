// FLASHCARDS — baralho do jogo (somente leitura no app).
// Gerado por tools/build_cards.py a partir dos arquivos em flashcards/ e publicado em
// /public/cards/deck.json. Para um backend, basta implementar a mesma interface.
import type { DeckFile } from '../types';

export interface CardRepository {
  loadAll(): Promise<DeckFile>;
}

export class StaticCardRepository implements CardRepository {
  async loadAll() {
    return (await fetch(import.meta.env.BASE_URL + 'cards/deck.json').then((r) => r.json())) as DeckFile;
  }
}

export const cardRepo: CardRepository = new StaticCardRepository();

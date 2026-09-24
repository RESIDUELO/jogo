// FLASHCARDS — baralho do jogo (somente leitura no app).
// Gerado por tools/build_cards.py a partir dos arquivos em cards/ e publicado em
// /public/cards/deck.json. Para um backend, basta implementar a mesma interface.
import type { DeckFile, Flashcard } from '../types';

export interface CardRepository {
  loadAll(): Promise<Flashcard[]>;
}

export class StaticCardRepository implements CardRepository {
  async loadAll() {
    const deck: DeckFile = await fetch(import.meta.env.BASE_URL + 'cards/deck.json').then((r) => r.json());
    return deck.cards;
  }
}

export const cardRepo: CardRepository = new StaticCardRepository();

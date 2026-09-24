// Camada de persistência. O jogo só conhece a interface SaveRepository —
// trocar localStorage por uma API (login + sincronização) exige apenas uma nova implementação.
import type { SaveData } from '../types';
import { SAVE_VERSION } from '../engine/game';

export interface SaveRepository {
  load(): SaveData | null;
  save(data: SaveData): void;
  clear(): void;
}

const KEY = 'residencia-quest:save';

export class LocalStorageRepository implements SaveRepository {
  constructor(private key = KEY) {}

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? migrate(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  save(data: SaveData): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (e) {
      console.error('Falha ao salvar o progresso', e);
    }
  }

  clear(): void {
    try { localStorage.removeItem(this.key); } catch { /* ignora */ }
  }
}

/** Atualiza saves antigos para o formato atual. */
export function migrate(data: unknown): SaveData {
  const s = data as SaveData;
  if (!s || typeof s !== 'object' || !s.player || !Array.isArray(s.cards)) throw new Error('Save inválido');
  if (!s.version) s.version = 1;
  // futuras migrações: if (s.version < 2) { ...; s.version = 2 }
  s.version = SAVE_VERSION;
  return s;
}

export function exportSave(data: SaveData) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const d = new Date();
  a.download = `residencia-quest-save-${d.toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const repository: SaveRepository = new LocalStorageRepository();

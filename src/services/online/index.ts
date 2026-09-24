// Escolhe o backend online:
//  - ?online=mock na URL → backend simulado (testes locais);
//  - public/online-config.json com supabaseUrl + supabaseAnonKey → Supabase;
//  - senão, online desativado (o jogo funciona offline normalmente).
import type { OnlineBackend } from './types';

let cached: Promise<OnlineBackend | null> | null = null;

export const urlParam = (k: string) => new URLSearchParams(location.search).get(k);

export function getBackend(): Promise<OnlineBackend | null> {
  if (cached) return cached;
  cached = (async () => {
    if (urlParam('online') === 'mock') {
      const { createMockBackend } = await import('./mockBackend');
      return createMockBackend(urlParam('slot') ?? 'default');
    }
    try {
      const cfg = await fetch(import.meta.env.BASE_URL + 'online-config.json', { cache: 'no-store' }).then((r) => r.json());
      if (cfg?.supabaseUrl && cfg?.supabaseAnonKey) {
        const { createSupabaseBackend } = await import('./supabaseBackend');
        return createSupabaseBackend(cfg.supabaseUrl, cfg.supabaseAnonKey);
      }
    } catch {
      /* sem configuração */
    }
    return null;
  })();
  return cached;
}

export * from './types';

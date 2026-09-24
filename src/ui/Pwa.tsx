// App instalável: aviso de nova versão, "pronto para offline" e botão de instalar.
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { isNative } from '../native';
import { Btn, Modal } from './common';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// o evento pode chegar antes do React montar: guarda desde o início
let deferred: InstallPromptEvent | null = null;
const subs = new Set<() => void>();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  subs.forEach((f) => f());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  subs.forEach((f) => f());
});

const isAndroid = () => /android/i.test(navigator.userAgent);
export const isStandalone = () => isNative() || window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return {
    installed: isStandalone(),
    canPrompt: !!deferred,
    ios: isIOS(),
    android: isAndroid(),
    prompt: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const r = await deferred.userChoice;
      deferred = null;
      return r.outcome === 'accepted';
    },
  };
}

/** Cartão "Instalar o app" (some quando o app já está instalado). */
export function InstallCard() {
  const inst = useInstall();
  const [help, setHelp] = useState(false);
  if (inst.installed) return null;
  return (
    <>
      {inst.android && (
        <a
          href={`${import.meta.env.BASE_URL}residuelo.apk`}
          download
          className="mb-2 w-full flex items-center gap-3 rounded-2xl p-3 text-left border border-sky-400/30 bg-sky-500/10 hover:bg-sky-500/15 transition"
        >
          <span className="text-3xl">🤖</span>
          <span className="flex-1">
            <span className="block font-display font-semibold">Baixar APK (Android)</span>
            <span className="block text-xs text-white/60">App nativo, funciona 100% offline. Permita "instalar apps desconhecidos" se o Android pedir.</span>
          </span>
          <span className="text-xl">⬇</span>
        </a>
      )}
      <button
        onClick={async () => {
          if (inst.canPrompt) await inst.prompt();
          else setHelp(true);
        }}
        className="w-full flex items-center gap-3 rounded-2xl p-3 text-left border border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition"
      >
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="w-11 h-11 rounded-xl" />
        <span className="flex-1">
          <span className="block font-display font-semibold">📲 Instalar o app</span>
          <span className="block text-xs text-white/60">Ícone na tela inicial, tela cheia e funciona sem internet.</span>
        </span>
        <span className="text-xl">›</span>
      </button>
      <Modal open={help} onClose={() => setHelp(false)} title="Instalar o Residuelo">
        {inst.ios ? (
          <ol className="space-y-3 text-sm list-decimal pl-5">
            <li>
              Abra este site no <b>Safari</b> (no iPhone a instalação só funciona pelo Safari).
            </li>
            <li>
              Toque no botão <b>Compartilhar</b> <span className="inline-block px-1.5 rounded bg-white/10">⬆︎</span> na barra de baixo.
            </li>
            <li>
              Role e toque em <b>Adicionar à Tela de Início</b>.
            </li>
            <li>
              Toque em <b>Adicionar</b>. O ícone da roleta aparece na sua tela inicial.
            </li>
          </ol>
        ) : (
          <ol className="space-y-3 text-sm list-decimal pl-5">
            <li>
              Abra este site no <b>Chrome</b> (Android) ou no Edge/Chrome do computador.
            </li>
            <li>
              Toque no menu <b>⋮</b> (canto superior direito).
            </li>
            <li>
              Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
            </li>
          </ol>
        )}
        <Btn className="w-full mt-5" onClick={() => setHelp(false)}>
          Entendi
        </Btn>
      </Modal>
    </>
  );
}

/** Avisos do service worker: nova versão disponível / pronto para offline. */
export function PwaUpdater() {
  return isNative() ? null : <PwaUpdaterWeb />;
}

function PwaUpdaterWeb() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // procura atualização a cada hora enquanto o app estiver aberto
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);
  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:w-96 z-[97] rounded-2xl bg-ink-800 border border-violet-400/40 shadow-2xl p-3 flex items-center gap-3 animate-rise">
      <span className="text-2xl">{needRefresh ? '✨' : '✅'}</span>
      <span className="flex-1 text-sm">{needRefresh ? 'Nova versão do Residuelo disponível.' : 'Pronto! O app agora funciona sem internet.'}</span>
      {needRefresh ? (
        <>
          <Btn variant="ghost" onClick={() => setNeedRefresh(false)}>
            Depois
          </Btn>
          <Btn onClick={() => updateServiceWorker(true)}>Atualizar</Btn>
        </>
      ) : null}
    </div>
  );
}

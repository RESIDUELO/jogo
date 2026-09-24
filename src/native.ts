// Integração com o app Android (Capacitor). No navegador, tudo aqui é inofensivo.
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

/** Botão "voltar" do Android: volta uma tela no jogo; na tela inicial, fecha o app. */
export async function setupBackButton(onBack: () => boolean) {
  if (!isNative()) return;
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', () => {
    if (!onBack()) void App.exitApp();
  });
}

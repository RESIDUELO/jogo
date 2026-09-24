import { BankScreen } from './screens/Bank';
import { Home } from './screens/Home';
import { MatchScreen } from './screens/MatchScreen';
import { useEffect } from 'react';
import { AccountScreen, OnlineRoomScreen, OnlineSearchScreen, PlayScreen, RankedScreen } from './screens/PlayModes';
import { OnlineMatchScreen } from './screens/OnlineMatchScreen';
import { ReportScreen } from './screens/ResultScreen';
import { urlParam } from './services/online';
import { useOnline } from './state/online';
import { Profile } from './screens/Profile';
import { ResultScreen } from './screens/ResultScreen';
import { Onboarding, PlayersScreen, SettingsScreen } from './screens/Settings';
import { AchievementsScreen, MissionsScreen, RankingScreen, ShopScreen } from './screens/Social';
import { StatsScreen } from './screens/Stats';
import { TrainingRun } from './screens/TrainingRun';
import { TrainingSetup } from './screens/TrainingSetup';
import { WrongQuestions } from './screens/WrongQuestions';
import { useStore } from './state/store';
import { EventLayer } from './ui/EventLayer';

function Current() {
  const { screen } = useStore();
  switch (screen.name) {
    case 'home':
      return <Home />;
    case 'play':
      return <PlayScreen />;
    case 'match':
      return <MatchScreen key={screen.nonce} config={screen.config} />;
    case 'training':
      return <TrainingSetup />;
    case 'trainingRun':
      return <TrainingRun key={screen.nonce} config={screen.config} />;
    case 'ranked':
      return <RankedScreen />;
    case 'result':
      return <ResultScreen summary={screen.summary} rematch={screen.rematch} retrain={screen.retrain} />;
    case 'profile':
      return <Profile />;
    case 'ranking':
      return <RankingScreen />;
    case 'wrong':
      return <WrongQuestions />;
    case 'stats':
      return <StatsScreen />;
    case 'achievements':
      return <AchievementsScreen />;
    case 'missions':
      return <MissionsScreen />;
    case 'shop':
      return <ShopScreen />;
    case 'bank':
      return <BankScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'players':
      return <PlayersScreen />;
    case 'account':
      return <AccountScreen />;
    case 'onlineSearch':
      return <OnlineSearchScreen key={screen.nonce} setup={screen.setup} ranked={screen.ranked} />;
    case 'onlineRoom':
      return <OnlineRoomScreen matchId={screen.matchId} code={screen.code} />;
    case 'onlineMatch':
      return <OnlineMatchScreen key={screen.matchId} matchId={screen.matchId} />;
    case 'report':
      return <ReportScreen summary={screen.summary} />;
  }
}

/** Link de convite (?sala=CODIGO): entra direto na sala após o login. */
function InviteLink() {
  const store = useStore();
  const online = useOnline();
  useEffect(() => {
    const code = urlParam('sala');
    if (!code || online.loading || !online.backend || !store.player) return;
    if (!online.account) {
      store.nav({ name: 'account' });
      return;
    }
    const url = new URL(location.href);
    url.searchParams.delete('sala');
    history.replaceState(null, '', url);
    online.backend.joinInvite(code).then(
      (id) => store.nav({ name: 'onlineMatch', matchId: id }),
      (e) => alert(String(e.message ?? e)),
    );
  }, [online.loading, online.account, online.backend, store.player]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function App() {
  const { ready, error, player } = useStore();
  return (
    <div className="min-h-screen bg-app text-white">
      <div className="mx-auto max-w-3xl px-4 pb-[env(safe-area-inset-bottom)]">
        {error ? (
          <div className="py-24 text-center">
            <div className="text-5xl">⚠️</div>
            <p className="mt-3 text-white/70">Não foi possível carregar o banco de questões.</p>
            <p className="text-xs text-white/40 mt-1">{error}</p>
          </div>
        ) : !ready ? (
          <div className="py-32 text-center">
            <div className="text-6xl animate-spin inline-block">🎡</div>
            <p className="mt-4 font-display text-lg text-white/70">Carregando questões...</p>
          </div>
        ) : !player ? (
          <Onboarding />
        ) : (
          <Current />
        )}
      </div>
      <EventLayer />
      {ready && <InviteLink />}
    </div>
  );
}

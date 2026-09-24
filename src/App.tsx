import { GameProvider, useGame } from './state/store';
import { Hud } from './components/Hud';
import { Notifications } from './components/Notifications';
import { CreateCharacter } from './screens/CreateCharacter';
import { Dashboard } from './screens/Dashboard';
import { Battle } from './screens/Battle';
import { Decks } from './screens/Decks';
import { Character } from './screens/Character';
import { Inventory } from './screens/Inventory';
import { WorldMap } from './screens/WorldMap';
import { Quests } from './screens/Quests';
import { Stats } from './screens/Stats';
import { Achievements } from './screens/Achievements';
import { Settings } from './screens/Settings';

const SCREENS = {
  dashboard: Dashboard,
  battle: Battle,
  decks: Decks,
  character: Character,
  inventory: Inventory,
  map: WorldMap,
  quests: Quests,
  stats: Stats,
  achievements: Achievements,
  settings: Settings,
};

function Game() {
  const { screen } = useGame();
  const Screen = SCREENS[screen];
  return (
    <div className="app">
      <Hud />
      <main className={`screen screen-${screen}`}>
        <Screen />
      </main>
      <Notifications />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider fallback={start => <CreateCharacter onStart={start} />}>
      <Game />
    </GameProvider>
  );
}

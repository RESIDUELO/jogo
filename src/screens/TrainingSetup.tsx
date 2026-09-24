import { useEffect, useMemo, useState } from 'react';
import { inTopics } from '../engine/cards';
import { useStore } from '../state/store';
import { Btn, Card, Header, Seg } from '../ui/common';
import { TopicPicker } from '../ui/TopicPicker';
import { TimePicker } from './PlayModes';

const KEY = 'rdl.trainSetup';
interface TrainPrefs {
  count: number | 'inf';
  topics: string[];
  timeSec: number;
  wrongOnly: boolean;
}
const DEFAULTS: TrainPrefs = { count: 10, topics: [], timeSec: 60, wrongOnly: false };
function load(): TrainPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function TrainingSetup() {
  const store = useStore();
  const [t, setT] = useState<TrainPrefs>(load);
  const set = (p: Partial<TrainPrefs>) => setT((x) => ({ ...x, ...p }));
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(t));
    } catch {
      /* sem armazenamento */
    }
  }, [t]);

  const available = useMemo(
    () => store.cards.filter((c) => inTopics(c, t.topics) && (!t.wrongOnly || (store.history.get(c.id)?.wrong ?? 0) > 0)).length,
    [store.cards, t.topics, t.wrongOnly, store.history],
  );

  return (
    <div className="pb-10">
      <Header title="Modo Treino" subtitle="Jogue sozinho, no seu ritmo" />
      <Card className="p-4 space-y-5">
        <div>
          <div className="font-display font-semibold mb-2">🎯 Temas</div>
          <TopicPicker cards={store.cards} topics={t.topics} onChange={(topics) => set({ topics })} />
        </div>
        <div>
          <div className="font-display font-semibold mb-2">Quantidade</div>
          <Seg
            value={t.count}
            onChange={(count) => set({ count })}
            options={[
              { v: 10, label: '10' },
              { v: 20, label: '20' },
              { v: 50, label: '50' },
              { v: 'inf', label: '∞ Infinito' },
            ]}
          />
        </div>
        <div>
          <div className="font-display font-semibold mb-2">⏱️ Tempo por cartão</div>
          <TimePicker value={t.timeSec} onChange={(timeSec) => set({ timeSec })} />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={t.wrongOnly} onChange={(e) => set({ wrongOnly: e.target.checked })} className="w-5 h-5 accent-violet-500" />
          <span>
            <b>Somente cartões que errei</b>
            <span className="block text-xs text-white/50">Revisão focada nas suas falhas</span>
          </span>
        </label>
        <div className="text-sm text-white/60">{available} flashcards disponíveis com esses filtros.</div>
        <Btn
          big
          className="w-full"
          disabled={!available}
          onClick={() => store.nav({ name: 'trainingRun', config: { count: t.count, categories: [], wrongOnly: t.wrongOnly, topics: t.topics, timeSec: t.timeSec } })}
        >
          📚 COMEÇAR TREINO
        </Btn>
      </Card>
    </div>
  );
}

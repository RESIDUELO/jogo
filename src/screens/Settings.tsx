import { useRef, useState } from 'react';
import { COSMETICS } from '../data/shop';
import { levelFromXp } from '../engine/progression';
import { playerRepo } from '../services/playerRepo';
import { useStore } from '../state/store';
import type { PlayerSettings } from '../types';
import { Avatar, Btn, Card, Header, Modal, Seg } from '../ui/common';

function download(name: string, content: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export { download };

export function SettingsScreen() {
  const store = useStore();
  const p = store.player!;
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof PlayerSettings>(k: K, v: PlayerSettings[K]) => store.updatePlayer((x) => ({ ...x, settings: { ...x.settings, [k]: v } }));
  return (
    <div className="pb-10">
      <Header title="Ajustes" />
      <Card className="p-4 space-y-5">
        <Row title="🔊 Efeitos sonoros" desc="Roleta, acerto, erro, vitória, XP, conquistas.">
          <Seg value={p.settings.sound ? 'on' : 'off'} onChange={(v) => set('sound', v === 'on')} options={[{ v: 'on', label: 'Ligado' }, { v: 'off', label: 'Desligado' }]} />
        </Row>
        <Row title="⏱️ Tempo por questão" desc="Adaptativo: 30 s + tempo extra para casos longos (até 75 s).">
          <Seg
            value={p.settings.timerMode}
            onChange={(v) => set('timerMode', v)}
            options={[
              { v: 'adaptativo', label: 'Adaptativo' },
              { v: 'fixo30', label: '30 s fixo' },
              { v: 'relaxado', label: 'Relaxado' },
            ]}
          />
        </Row>
        <Row title="🎡 Reduzir animações" desc="Roleta mais curta e menos movimento.">
          <Seg value={p.settings.reduceMotion ? 'on' : 'off'} onChange={(v) => set('reduceMotion', v === 'on')} options={[{ v: 'off', label: 'Não' }, { v: 'on', label: 'Sim' }]} />
        </Row>
        <Row title="📚 Incluir anuladas no treino" desc="Questões anuladas nunca entram em partidas PvP/ranqueadas.">
          <Seg value={p.settings.includeAnnulledInStudy ? 'on' : 'off'} onChange={(v) => set('includeAnnulledInStudy', v === 'on')} options={[{ v: 'off', label: 'Não' }, { v: 'on', label: 'Sim' }]} />
        </Row>
      </Card>

      <Card className="p-4 mt-4 space-y-3">
        <div className="font-display font-semibold">💾 Dados</div>
        <p className="text-sm text-white/60">O progresso é salvo neste navegador. Exporte para levar a outro aparelho.</p>
        <div className="flex flex-wrap gap-2">
          <Btn variant="secondary" onClick={() => download(`residuelo-save-${new Date().toISOString().slice(0, 10)}.json`, playerRepo.exportAll())}>
            ⬇️ Exportar progresso
          </Btn>
          <Btn variant="secondary" onClick={() => file.current?.click()}>
            ⬆️ Importar progresso
          </Btn>
          <Btn variant="secondary" onClick={() => store.nav({ name: 'players' })}>
            👥 Perfis
          </Btn>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              playerRepo.importAll(await f.text());
              store.reloadPlayers();
              alert('Progresso importado!');
            } catch (err) {
              alert('Falha ao importar: ' + err);
            }
          }}
        />
      </Card>
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-white/50">{desc}</div>
      </div>
      {children}
    </div>
  );
}

const FREE_AVATARS = COSMETICS.filter((c) => c.kind === 'avatar' && c.price === 0);

export function PlayersScreen() {
  const store = useStore();
  const [del, setDel] = useState<string | null>(null);
  return (
    <div className="pb-10">
      <Header title="Perfis" subtitle="Vários jogadores no mesmo aparelho" />
      <div className="space-y-2">
        {store.players.map((pl) => (
          <Card key={pl.id} className={`p-3 flex items-center gap-3 ${pl.id === store.player?.id ? 'border-violet-400/60' : ''}`}>
            <Avatar player={pl} size={48} />
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold truncate">{pl.name}</div>
              <div className="text-xs text-white/50">
                Nível {levelFromXp(pl.xp).level} · {pl.wins}V/{pl.losses}D
              </div>
            </div>
            {pl.id === store.player?.id ? (
              <span className="text-xs text-violet-300">ativo</span>
            ) : (
              <Btn variant="secondary" onClick={() => store.switchPlayer(pl.id)}>
                Usar
              </Btn>
            )}
            <button className="text-white/30 hover:text-rose-300 px-2" onClick={() => setDel(pl.id)} aria-label="Excluir">
              🗑
            </button>
          </Card>
        ))}
      </div>
      <Onboarding embedded />
      <Modal open={!!del} onClose={() => setDel(null)} title="Excluir perfil?">
        <p className="text-white/70 mb-4">Todo o histórico deste perfil será apagado deste aparelho.</p>
        <div className="flex gap-2">
          <Btn variant="secondary" className="flex-1" onClick={() => setDel(null)}>
            Cancelar
          </Btn>
          <Btn
            variant="danger"
            className="flex-1"
            onClick={() => {
              store.deletePlayer(del!);
              setDel(null);
            }}
          >
            Excluir
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

export function Onboarding({ embedded }: { embedded?: boolean }) {
  const store = useStore();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(FREE_AVATARS[1].id);
  const create = () => {
    if (!name.trim()) return;
    const p = store.createPlayer(name.trim(), avatar);
    if (embedded) setName('');
    else store.switchPlayer(p.id);
  };
  return (
    <div className={embedded ? 'mt-6' : 'min-h-[80vh] grid place-items-center'}>
      <div className="w-full max-w-md text-center">
        {!embedded && (
          <>
            <div className="text-6xl animate-bob">🩺</div>
            <h1 className="font-display text-5xl font-bold mt-2">
              Resi<span className="text-amber-300">duelo</span>
            </h1>
            <p className="text-white/60 mt-2">Perguntados + Duolingo + questões reais de residência. Cada partida são 10–20 questões de prova — disfarçadas de jogo.</p>
          </>
        )}
        <Card className="p-5 mt-6 text-left">
          <div className="font-display font-semibold mb-2">{embedded ? 'Novo perfil' : 'Crie seu perfil'}</div>
          <input className="input" placeholder="Seu nome ou apelido" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} autoFocus={!embedded} />
          <div className="text-xs text-white/50 mt-3 mb-2">Avatar</div>
          <div className="flex flex-wrap gap-2">
            {FREE_AVATARS.map((a) => (
              <button key={a.id} onClick={() => setAvatar(a.id)} className={`w-12 h-12 rounded-full text-2xl grid place-items-center border-2 transition ${avatar === a.id ? 'border-violet-400 bg-violet-500/30 scale-110' : 'border-white/10 bg-black/20'}`}>
                {a.value}
              </button>
            ))}
          </div>
          <Btn big variant="gold" className="w-full mt-4" disabled={!name.trim()} onClick={create}>
            {embedded ? 'Criar perfil' : 'COMEÇAR A JOGAR'}
          </Btn>
        </Card>
      </div>
    </div>
  );
}

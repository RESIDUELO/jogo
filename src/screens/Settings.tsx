import { useRef } from 'react';
import { useGame } from '../state/store';
import { Panel } from '../components/ui';
import { renamePlayer, updateSettings } from '../engine/game';
import { exportSave, migrate } from '../storage/repository';

export function Settings() {
  const { s, run, replace, reset } = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const st = s.settings;

  const importSave = async (f: File) => {
    try {
      const data = migrate(JSON.parse(await f.text()));
      if (confirm('Substituir TODO o progresso atual por este save?')) replace(data);
    } catch {
      alert('Arquivo de save inválido.');
    }
  };

  return (
    <div className="settings-screen">
      <Panel title="💾 Save">
        <p className="muted">Seu progresso é salvo automaticamente neste navegador. Exporte regularmente para ter um backup ou levar para outro dispositivo.</p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => exportSave(s)}>⬇ Exportar save (JSON)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Importar save</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={e => { if (e.target.files?.[0]) importSave(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </Panel>

      <Panel title="⚙️ Estudo">
        <label className="field inline">Cards novos por dia (por deck)
          <input type="number" min={0} max={500} value={st.newPerDay} onChange={e => run(x => updateSettings(x, { newPerDay: Math.max(0, Number(e.target.value) || 0) }))} />
        </label>
        <label className="field inline">Meta diária de cards
          <input type="number" min={1} max={2000} value={st.dailyGoal} onChange={e => run(x => updateSettings(x, { dailyGoal: Math.max(1, Number(e.target.value) || 1) }))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={st.weaknesses} onChange={e => run(x => updateSettings(x, { weaknesses: e.target.checked }))} />
          Fraquezas temáticas (cards do deck/tag correspondente causam +20% de dano)
        </label>
        <label className="check">
          <input type="checkbox" checked={st.sound} onChange={e => run(x => updateSettings(x, { sound: e.target.checked }))} />
          Efeitos sonoros
        </label>
      </Panel>

      <Panel title="🧙 Personagem">
        <button className="btn" onClick={() => { const n = prompt('Novo nome:', s.player.name); if (n) run(x => renamePlayer(x, n)); }}>Renomear personagem</button>
      </Panel>

      <Panel title="⚠️ Zona de perigo">
        <button className="btn btn-danger" onClick={() => {
          if (confirm('Apagar TODO o progresso? Exporte seu save antes!') && confirm('Tem certeza absoluta?')) reset();
        }}>Apagar progresso e recomeçar</button>
      </Panel>

      <Panel title="⌨️ Atalhos">
        <ul className="kv">
          <li><span>Revelar resposta</span><b>Espaço / Enter</b></li>
          <li><span>Errei · Difícil · Acertei · Dominei</span><b>1 · 2 · 3 · 4</b></li>
          <li><span>Acertei (após revelar)</span><b>Espaço</b></li>
        </ul>
      </Panel>
    </div>
  );
}

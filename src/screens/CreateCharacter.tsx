import { useRef, useState } from 'react';
import type { ClassId } from '../types';
import { CLASSES } from '../data/content';
import { migrate, repository } from '../storage/repository';

export function CreateCharacter({ onStart }: { onStart: (name: string, cls: ClassId) => void }) {
  const [name, setName] = useState('');
  const [cls, setCls] = useState<ClassId>('mago');
  const fileRef = useRef<HTMLInputElement>(null);

  const importSave = async (f: File) => {
    try {
      const s = migrate(JSON.parse(await f.text()));
      repository.save(s);
      location.reload();
    } catch {
      alert('Arquivo de save inválido.');
    }
  };

  return (
    <div className="create">
      <div className="create-box">
        <div className="create-logo">⚔️</div>
        <h1 className="cinzel title-glow">Residência Quest</h1>
        <p className="muted">Cada flashcard é um golpe. Cada revisão, um passo rumo à residência.</p>

        <label className="field">
          Nome do personagem
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Pablo" maxLength={24} autoFocus />
        </label>

        <div className="class-grid">
          {CLASSES.map(c => (
            <button key={c.id} type="button" disabled={c.unlockLevel > 1} className={`class-card${cls === c.id ? ' selected' : ''}`} onClick={() => setCls(c.id)}>
              <span className="class-icon">{c.unlockLevel > 1 ? '🔒' : c.icon}</span>
              <b>{c.name}</b>
              <small>{c.description}</small>
              <ul>{c.perks.map(pk => <li key={pk}>{pk}</li>)}</ul>
            </button>
          ))}
        </div>

        <button className="btn btn-primary btn-big" onClick={() => onStart(name, cls)}>Começar a jornada</button>
        <button className="link" onClick={() => fileRef.current?.click()}>Já tenho um save — importar arquivo</button>
        <input ref={fileRef} type="file" accept=".json" hidden onChange={e => e.target.files?.[0] && importSave(e.target.files[0])} />
      </div>
    </div>
  );
}

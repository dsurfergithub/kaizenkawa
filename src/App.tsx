import { useEffect, useRef, useState } from 'react';
import type { Instrument, SessionConfig, SessionProgress } from './types';
import { runSession, type SessionHandle } from './audio/autosample';
import { SamplerPlayer } from './audio/samplerPlayer';
import { deleteInstrument, listInstruments, saveInstrument } from './db';
import { noteName } from './notes';
import SessionForm from './components/SessionForm';
import Library from './components/Library';
import Keyboard from './components/Keyboard';

export default function App() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SessionHandle | null>(null);
  const playerRef = useRef<SamplerPlayer | null>(null);

  useEffect(() => {
    void listInstruments().then(setInstruments);
  }, []);

  const busy = progress !== null && progress.phase !== 'terminado' && progress.phase !== 'cancelado';

  const startSession = async (cfg: SessionConfig) => {
    setError(null);
    const handle = runSession(cfg, setProgress);
    sessionRef.current = handle;
    try {
      const instrument = await handle.result;
      if (instrument) {
        await saveInstrument(instrument);
        setInstruments(await listInstruments());
        await loadInstrument(instrument);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      sessionRef.current = null;
    }
  };

  const loadInstrument = async (instrument: Instrument) => {
    playerRef.current ??= new SamplerPlayer();
    await playerRef.current.load(instrument);
    setLoadedId(instrument.id);
  };

  const removeInstrument = async (id: string) => {
    await deleteInstrument(id);
    if (id === loadedId) setLoadedId(null);
    setInstruments(await listInstruments());
  };

  return (
    <div className="app">
      <header>
        <h1>
          KaizenKawa <span>AutoSampler</span>
        </h1>
        <p className="hint">Muestrea instrumentos automáticamente y tócalos — 100 % local, sin servidor.</p>
      </header>

      <SessionForm onStart={(cfg) => void startSession(cfg)} busy={busy} />

      {progress && busy && (
        <div className="panel progress">
          <p>
            {progress.phase === 'preparando'
              ? 'Abriendo entrada de audio…'
              : `${progress.phase} ${noteName(progress.note)} · ${progress.current + 1}/${progress.total}`}
          </p>
          <div className="bar">
            <div className="bar__fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
          <button
            className="danger"
            onClick={() => {
              sessionRef.current?.cancel();
              setProgress({ ...progress, phase: 'cancelado' });
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {error && <p className="error">⚠ {error}</p>}

      <section className="panel">
        <h2>Instrumentos</h2>
        <Library
          instruments={instruments}
          loadedId={loadedId}
          onLoad={(inst) => void loadInstrument(inst)}
          onDelete={(id) => void removeInstrument(id)}
        />
      </section>

      <section className="panel panel--keyboard">
        <h2>Teclado {loadedId ? '' : '(carga un instrumento para tocar)'}</h2>
        <Keyboard
          low={36}
          high={84}
          disabled={!loadedId}
          onNoteOn={(n) => playerRef.current?.noteOn(n)}
          onNoteOff={(n) => playerRef.current?.noteOff(n)}
        />
      </section>
    </div>
  );
}

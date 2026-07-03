import { useEffect, useState } from 'react';
import type { SessionConfig } from '../types';
import { noteName } from '../notes';
import { listMidiOutputs, midiSupported, type MidiOut } from '../audio/midi';

interface Props {
  onStart: (cfg: SessionConfig) => void;
  busy: boolean;
}

const DEFAULTS: SessionConfig = {
  name: '',
  source: 'demo',
  midiChannel: 0,
  lowNote: 36, // C2
  highNote: 84, // C6
  interval: 3,
  noteLength: 1.5,
  releaseTail: 0.8,
  velocity: 100,
  trimSilence: true,
  normalize: true,
};

export default function SessionForm({ onStart, busy }: Props) {
  const [cfg, setCfg] = useState<SessionConfig>(DEFAULTS);
  const [outputs, setOutputs] = useState<MidiOut[]>([]);

  useEffect(() => {
    if (cfg.source === 'midi') {
      void listMidiOutputs().then((outs) => {
        setOutputs(outs);
        if (outs.length && !cfg.midiOutputId) {
          setCfg((c) => ({ ...c, midiOutputId: outs[0].id }));
        }
      });
    }
  }, [cfg.source, cfg.midiOutputId]);

  const set = <K extends keyof SessionConfig>(key: K, value: SessionConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const noteCount = Math.floor((cfg.highNote - cfg.lowNote) / cfg.interval) + 1;
  const estSeconds = Math.round(noteCount * (cfg.noteLength + cfg.releaseTail + 0.3));

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        onStart(cfg);
      }}
    >
      <h2>Nueva sesión de auto-sampleo</h2>

      <label>
        Nombre del instrumento
        <input
          type="text"
          value={cfg.name}
          placeholder="Mi sinte muestreado"
          onChange={(e) => set('name', e.target.value)}
        />
      </label>

      <label>
        Fuente de sonido
        <select value={cfg.source} onChange={(e) => set('source', e.target.value as SessionConfig['source'])}>
          <option value="demo">Sinte interno (demo, sin hardware)</option>
          <option value="midi" disabled={!midiSupported()}>
            Sinte externo por MIDI + entrada de audio{midiSupported() ? '' : ' (no soportado en este navegador)'}
          </option>
        </select>
      </label>

      {cfg.source === 'midi' && (
        <label>
          Salida MIDI
          <select value={cfg.midiOutputId ?? ''} onChange={(e) => set('midiOutputId', e.target.value)}>
            {outputs.length === 0 && <option value="">— sin dispositivos —</option>}
            {outputs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="row">
        <label>
          Nota grave: {noteName(cfg.lowNote)}
          <input
            type="range"
            min={21}
            max={cfg.highNote - 1}
            value={cfg.lowNote}
            onChange={(e) => set('lowNote', Number(e.target.value))}
          />
        </label>
        <label>
          Nota aguda: {noteName(cfg.highNote)}
          <input
            type="range"
            min={cfg.lowNote + 1}
            max={108}
            value={cfg.highNote}
            onChange={(e) => set('highNote', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="row">
        <label>
          Intervalo: {cfg.interval} st
          <input
            type="range"
            min={1}
            max={12}
            value={cfg.interval}
            onChange={(e) => set('interval', Number(e.target.value))}
          />
        </label>
        <label>
          Velocity: {cfg.velocity}
          <input
            type="range"
            min={1}
            max={127}
            value={cfg.velocity}
            onChange={(e) => set('velocity', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="row">
        <label>
          Duración nota: {cfg.noteLength.toFixed(1)} s
          <input
            type="range"
            min={0.3}
            max={8}
            step={0.1}
            value={cfg.noteLength}
            onChange={(e) => set('noteLength', Number(e.target.value))}
          />
        </label>
        <label>
          Cola release: {cfg.releaseTail.toFixed(1)} s
          <input
            type="range"
            min={0}
            max={6}
            step={0.1}
            value={cfg.releaseTail}
            onChange={(e) => set('releaseTail', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="row row--checks">
        <label className="check">
          <input type="checkbox" checked={cfg.trimSilence} onChange={(e) => set('trimSilence', e.target.checked)} />
          Recortar silencio
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.normalize} onChange={(e) => set('normalize', e.target.checked)} />
          Normalizar
        </label>
      </div>

      <p className="hint">
        {noteCount} muestras · duración estimada ≈ {estSeconds} s
      </p>

      <button type="submit" className="primary" disabled={busy || (cfg.source === 'midi' && !cfg.midiOutputId)}>
        {busy ? 'Muestreando…' : 'Iniciar auto-sampleo'}
      </button>
    </form>
  );
}

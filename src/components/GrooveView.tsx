import { useState } from 'react';
import type { Pad, PadGroup } from '../types';
import { GROUP_LABELS, PAD_GROUPS, STEPS } from '../types';

export const GROUP_COLORS: Record<PadGroup, string> = {
  drums: '#f97f4f',
  bass: '#4f9cf9',
  melody: '#3fc98f',
  fx: '#9d6ff9',
};

interface Props {
  pads: Pad[];
  bpm: number;
  onBpmChange: (bpm: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  activeIds: Set<string>;
  pendingIds: Map<string, boolean>;
  currentStep: number;
  onPadToggle: (pad: Pad) => void;
  onPatternChange: (pad: Pad, pattern: boolean[]) => void;
  onPreview: (pad: Pad) => void;
  onExport: (bars: number) => void;
  exporting: boolean;
}

/** Modo groove estilo Groovepad: loops por grupo, secuenciador y export. */
export default function GrooveView(props: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bars, setBars] = useState(8);
  const editing = props.pads.find((p) => p.id === editingId) ?? null;
  const canExport = props.pads.some((p) => props.activeIds.has(p.id) && p.pattern.some(Boolean));

  return (
    <div className="groove">
      <div className="transport">
        <button className="transport__play" onClick={props.onPlayToggle} aria-label="Play/Stop">
          {props.playing ? '■' : '▶'}
        </button>
        <label className="transport__bpm">
          BPM: {props.bpm}
          <input
            type="range"
            min={60}
            max={180}
            value={props.bpm}
            onChange={(e) => props.onBpmChange(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="groove__grid">
        {PAD_GROUPS.map((group) => (
          <div key={group} className="groove__col">
            <span className="groove__col-name" style={{ color: GROUP_COLORS[group] }}>
              {GROUP_LABELS[group]}
            </span>
            {props.pads
              .filter((p) => p.group === group)
              .map((pad) => {
                const isActive = props.activeIds.has(pad.id);
                const pending = props.pendingIds.get(pad.id);
                const state =
                  pending !== undefined ? (pending ? 'queued-on' : 'queued-off') : isActive ? 'on' : 'off';
                return (
                  <div
                    key={pad.id}
                    className={`gpad gpad--${state}`}
                    style={{ borderColor: GROUP_COLORS[group] }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      props.onPadToggle(pad);
                    }}
                  >
                    <span className="pad__label">{pad.label}</span>
                    <button
                      className="pad__edit"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(pad.id === editingId ? null : pad.id);
                      }}
                      aria-label="Editar patrón"
                    >
                      ▦
                    </button>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      <p className="hint">
        Toca un pad para lanzar/parar su loop (entra al siguiente compás; uno por grupo). ▦ edita su patrón.
      </p>

      {editing && (
        <div className="panel step-editor">
          <div className="pad-editor__head">
            <h2>
              Patrón · {GROUP_LABELS[editing.group]} <span className="hint">{editing.label}</span>
            </h2>
            <div>
              <button onClick={() => props.onPreview(editing)}>🔊</button>
              <button onClick={() => setEditingId(null)}>✕</button>
            </div>
          </div>
          <div className="steps">
            {Array.from({ length: STEPS }, (_, i) => (
              <button
                key={i}
                className={`step${editing.pattern[i] ? ' step--on' : ''}${
                  props.currentStep === i ? ' step--now' : ''
                }${i % 4 === 0 ? ' step--beat' : ''}`}
                style={editing.pattern[i] ? { background: GROUP_COLORS[editing.group] } : undefined}
                onClick={() => {
                  const pattern = editing.pattern.map((v, j) => (j === i ? !v : v));
                  props.onPatternChange(editing, pattern);
                }}
                aria-label={`Paso ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="row groove__export">
        <label>
          Compases: {bars}
          <input type="range" min={2} max={32} step={2} value={bars} onChange={(e) => setBars(Number(e.target.value))} />
        </label>
        <button className="primary" disabled={!canExport || props.exporting} onClick={() => props.onExport(bars)}>
          {props.exporting ? 'Renderizando…' : '⬇ Exportar track WAV'}
        </button>
      </div>
      {!canExport && <p className="hint">Activa al menos un loop con patrón para poder exportar el track.</p>}
    </div>
  );
}

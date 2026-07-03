import type { Macros } from '../types';

interface Props {
  macros: Macros;
  onChange: (macros: Macros) => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
}

const LABELS: Array<{ key: keyof Macros; name: string; low: string; high: string }> = [
  { key: 'attack', name: 'Ataque', low: 'suave', high: 'afilado' },
  { key: 'brightness', name: 'Brillo', low: 'oscuro', high: 'brillante' },
  { key: 'grit', name: 'Grit', low: 'limpio', high: 'sucio' },
  { key: 'variety', name: 'Variedad', low: 'similar', high: 'diverso' },
];

/** Macros que dirigen la re-selección de samples, al estilo AutoSamplr. */
export default function MacroControls({ macros, onChange, onRegenerate, canRegenerate }: Props) {
  return (
    <div className="macros">
      {LABELS.map(({ key, name, low, high }) => (
        <label key={key}>
          <span className="macros__name">
            {name} <em>({low} ↔ {high})</em>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={macros[key]}
            onChange={(e) => onChange({ ...macros, [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <button className="primary" onClick={onRegenerate} disabled={!canRegenerate}>
        ↻ Re-seleccionar samples
      </button>
      {!canRegenerate && (
        <p className="hint">Importa una canción (o re-importala) para poder re-seleccionar con las macros.</p>
      )}
    </div>
  );
}

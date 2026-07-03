import type { Pad } from '../types';

interface Props {
  pad: Pad;
  index: number;
  onChange: (pad: Pad) => void;
  onSwap: () => void;
  canSwap: boolean;
  onClose: () => void;
}

/** Ajustes por pad: ganancia, tono, reverse y cambio por otro candidato. */
export default function PadEditor({ pad, index, onChange, onSwap, canSwap, onClose }: Props) {
  return (
    <div className="panel pad-editor">
      <div className="pad-editor__head">
        <h2>
          Pad {index + 1} <span className="hint">· momento {pad.label} de la canción</span>
        </h2>
        <button onClick={onClose}>✕</button>
      </div>

      <label>
        Ganancia: {(20 * Math.log10(pad.gain)).toFixed(1)} dB
        <input
          type="range"
          min={0.1}
          max={2}
          step={0.01}
          value={pad.gain}
          onChange={(e) => onChange({ ...pad, gain: Number(e.target.value) })}
        />
      </label>

      <label>
        Tono: {pad.pitch > 0 ? '+' : ''}
        {pad.pitch} st
        <input
          type="range"
          min={-12}
          max={12}
          step={1}
          value={pad.pitch}
          onChange={(e) => onChange({ ...pad, pitch: Number(e.target.value) })}
        />
      </label>

      <div className="row row--checks">
        <label className="check">
          <input
            type="checkbox"
            checked={pad.reverse}
            onChange={(e) => onChange({ ...pad, reverse: e.target.checked })}
          />
          Reverse
        </label>
        <button onClick={onSwap} disabled={!canSwap}>
          🎲 Cambiar sample
        </button>
      </div>
    </div>
  );
}

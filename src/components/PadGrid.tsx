import type { Pad } from '../types';

interface Props {
  pads: Pad[];
  selectedId: string | null;
  onPlay: (pad: Pad) => void;
  onSelect: (pad: Pad) => void;
}

const PAD_COLORS = ['#4f9cf9', '#9d6ff9', '#f97f4f', '#3fc98f'];

/** Rejilla 4×4 de pads: tocar reproduce; el botón ✎ selecciona para editar. */
export default function PadGrid({ pads, selectedId, onPlay, onSelect }: Props) {
  return (
    <div className="pads">
      {pads.map((pad, i) => (
        <div
          key={pad.id}
          className={`pad${pad.id === selectedId ? ' pad--selected' : ''}`}
          style={{ borderColor: PAD_COLORS[i % PAD_COLORS.length] }}
          onPointerDown={(e) => {
            e.preventDefault();
            onPlay(pad);
          }}
        >
          <span className="pad__num">{i + 1}</span>
          <span className="pad__label">{pad.label}</span>
          <button
            className="pad__edit"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(pad);
            }}
            aria-label={`Editar pad ${i + 1}`}
          >
            ✎
          </button>
        </div>
      ))}
    </div>
  );
}

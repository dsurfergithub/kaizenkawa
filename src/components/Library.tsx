import type { Instrument } from '../types';
import { noteName } from '../notes';
import { downloadBlob, exportInstrumentZip } from '../export/sfz';

interface Props {
  instruments: Instrument[];
  loadedId: string | null;
  onLoad: (instrument: Instrument) => void;
  onDelete: (id: string) => void;
}

export default function Library({ instruments, loadedId, onLoad, onDelete }: Props) {
  if (instruments.length === 0) {
    return <p className="hint">Todavía no hay instrumentos. Lanza una sesión de auto-sampleo para crear el primero.</p>;
  }
  return (
    <ul className="library">
      {instruments.map((inst) => (
        <li key={inst.id} className={inst.id === loadedId ? 'library__item library__item--active' : 'library__item'}>
          <div className="library__meta">
            <strong>{inst.name}</strong>
            <span className="hint">
              {inst.zones.length} zonas · {noteName(inst.zones[0]?.rootNote ?? 0)}–
              {noteName(inst.zones[inst.zones.length - 1]?.rootNote ?? 0)} ·{' '}
              {new Date(inst.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="library__actions">
            <button onClick={() => onLoad(inst)}>{inst.id === loadedId ? 'Cargado ✓' : 'Tocar'}</button>
            <button onClick={() => downloadBlob(exportInstrumentZip(inst), `${inst.name || 'instrumento'}.zip`)}>
              Exportar SFZ
            </button>
            <button className="danger" onClick={() => onDelete(inst.id)}>
              Borrar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

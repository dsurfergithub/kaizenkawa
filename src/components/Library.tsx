import type { Kit } from '../types';
import { downloadBlob, exportKitZip } from '../export/kit';

interface Props {
  kits: Kit[];
  loadedId: string | null;
  onLoad: (kit: Kit) => void;
  onDelete: (id: string) => void;
}

export default function Library({ kits, loadedId, onLoad, onDelete }: Props) {
  if (kits.length === 0) {
    return <p className="hint">Todavía no hay kits guardados. Importa una canción para crear el primero.</p>;
  }
  return (
    <ul className="library">
      {kits.map((kit) => (
        <li key={kit.id} className={kit.id === loadedId ? 'library__item library__item--active' : 'library__item'}>
          <div className="library__meta">
            <strong>{kit.name}</strong>
            <span className="hint">
              {kit.pads.length} pads · {new Date(kit.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="library__actions">
            <button onClick={() => onLoad(kit)}>{kit.id === loadedId ? 'Cargado ✓' : 'Abrir'}</button>
            <button
              onClick={() => {
                void exportKitZip(kit).then((blob) => downloadBlob(blob, `${kit.name || 'kit'}.zip`));
              }}
            >
              Exportar WAVs
            </button>
            <button className="danger" onClick={() => onDelete(kit.id)}>
              Borrar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

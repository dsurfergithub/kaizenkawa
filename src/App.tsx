import { useEffect, useRef, useState } from 'react';
import type { AnalysisPhase, Kit, Macros, Pad } from './types';
import { NEUTRAL_MACROS } from './types';
import { analyzeSong, type Analysis, type Candidate } from './analysis/analyze';
import { pickReplacement, selectPads } from './analysis/select';
import { buildKit } from './analysis/kitBuilder';
import { PadPlayer } from './audio/padPlayer';
import { getAudioContext } from './audio/context';
import { deleteKit, listKits, saveKit } from './db';
import { downloadBlob, exportKitZip } from './export/kit';
import PadGrid from './components/PadGrid';
import MacroControls from './components/MacroControls';
import PadEditor from './components/PadEditor';
import Library from './components/Library';

interface SourceSession {
  name: string;
  buffer: AudioBuffer;
  analysis: Analysis;
  chosen: Candidate[];
}

export default function App() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [kit, setKit] = useState<Kit | null>(null);
  const [phase, setPhase] = useState<AnalysisPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [macros, setMacros] = useState<Macros>(NEUTRAL_MACROS);
  const [selectedPadId, setSelectedPadId] = useState<string | null>(null);
  const sourceRef = useRef<SourceSession | null>(null);
  const playerRef = useRef<PadPlayer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listKits().then(setKits);
  }, []);

  const busy = phase !== null && phase !== 'listo';

  const player = () => (playerRef.current ??= new PadPlayer());

  const persist = async (next: Kit) => {
    setKit(next);
    await saveKit(next);
    setKits(await listKits());
  };

  const importSong = async (file: File) => {
    setError(null);
    setSelectedPadId(null);
    try {
      setPhase('decodificando');
      const data = await file.arrayBuffer();
      const buffer = await getAudioContext().decodeAudioData(data);

      setPhase('analizando');
      await new Promise((r) => setTimeout(r, 30)); // deja pintar el estado
      const analysis = await analyzeSong(buffer);
      if (analysis.candidates.length === 0) {
        throw new Error('No se han encontrado momentos muestreables en este audio.');
      }

      setPhase('seleccionando');
      const chosen = selectPads(analysis.candidates, macros);
      const name = file.name.replace(/\.[^.]+$/, '');
      const newKit = buildKit(name, buffer, chosen);

      sourceRef.current = { name, buffer, analysis, chosen };
      await player().loadPads(newKit.pads);
      await persist(newKit);
      setPhase('listo');
    } catch (e) {
      setPhase(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const regenerate = async () => {
    const source = sourceRef.current;
    if (!source || !kit) return;
    setPhase('seleccionando');
    setSelectedPadId(null);
    const chosen = selectPads(source.analysis.candidates, macros);
    const next = { ...buildKit(source.name, source.buffer, chosen), id: kit.id, name: kit.name };
    source.chosen = chosen;
    await player().loadPads(next.pads);
    await persist(next);
    setPhase('listo');
  };

  const swapPad = async (pad: Pad) => {
    const source = sourceRef.current;
    if (!source || !kit) return;
    const index = kit.pads.findIndex((p) => p.id === pad.id);
    const current = source.chosen[index];
    const replacement = pickReplacement(source.analysis.candidates, macros, source.chosen, current);
    if (!replacement) return;

    source.chosen = source.chosen.map((c, i) => (i === index ? replacement : c));
    const rebuilt = buildKit(source.name, source.buffer, [replacement]).pads[0];
    const nextPads = kit.pads.map((p, i) => (i === index ? rebuilt : p));
    const next = { ...kit, pads: nextPads };
    await player().loadPads(next.pads);
    await persist(next);
    setSelectedPadId(rebuilt.id);
    player().play(rebuilt);
  };

  const updatePad = async (pad: Pad) => {
    if (!kit) return;
    player().invalidate(pad.id);
    await persist({ ...kit, pads: kit.pads.map((p) => (p.id === pad.id ? pad : p)) });
  };

  const loadKit = async (k: Kit) => {
    setSelectedPadId(null);
    sourceRef.current = null; // sin la canción original no hay re-selección
    await player().loadPads(k.pads);
    setKit(k);
    setPhase('listo');
  };

  const removeKit = async (id: string) => {
    await deleteKit(id);
    if (kit?.id === id) {
      setKit(null);
      setPhase(null);
    }
    setKits(await listKits());
  };

  const selectedPad = kit?.pads.find((p) => p.id === selectedPadId) ?? null;
  const selectedIndex = selectedPad && kit ? kit.pads.findIndex((p) => p.id === selectedPad.id) : -1;

  return (
    <div className="app">
      <header>
        <h1>
          KaizenKawa <span>Samplr</span>
        </h1>
        <p className="hint">
          Convierte cualquier canción en un kit de samples tocable — análisis 100 % local, sin subir nada.
        </p>
      </header>

      <div className="panel">
        <h2>1 · Importa una canción</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importSong(file);
            e.target.value = '';
          }}
        />
        <button className="primary" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {busy ? `${phase}…` : '♫ Elegir archivo de audio'}
        </button>
        <p className="hint">
          Se detectan los momentos musicalmente útiles (onsets, sonoridad, timbre) y se eligen 16 con diversidad.
        </p>
      </div>

      {error && <p className="error">⚠ {error}</p>}

      {kit && phase === 'listo' && (
        <>
          <section className="panel">
            <div className="pad-editor__head">
              <h2>2 · Kit: {kit.name}</h2>
              <button
                onClick={() => {
                  void exportKitZip(kit).then((blob) => downloadBlob(blob, `${kit.name || 'kit'}.zip`));
                }}
              >
                ⬇ Exportar WAVs
              </button>
            </div>
            <PadGrid
              pads={kit.pads}
              selectedId={selectedPadId}
              onPlay={(pad) => player().play(pad)}
              onSelect={(pad) => setSelectedPadId(pad.id === selectedPadId ? null : pad.id)}
            />
          </section>

          {selectedPad && selectedIndex >= 0 && (
            <PadEditor
              pad={selectedPad}
              index={selectedIndex}
              onChange={(p) => void updatePad(p)}
              onSwap={() => void swapPad(selectedPad)}
              canSwap={sourceRef.current !== null}
              onClose={() => setSelectedPadId(null)}
            />
          )}

          <section className="panel">
            <h2>3 · Macros de selección</h2>
            <MacroControls
              macros={macros}
              onChange={setMacros}
              onRegenerate={() => void regenerate()}
              canRegenerate={sourceRef.current !== null}
            />
          </section>
        </>
      )}

      <section className="panel">
        <h2>Kits guardados</h2>
        <Library
          kits={kits}
          loadedId={kit?.id ?? null}
          onLoad={(k) => void loadKit(k)}
          onDelete={(id) => void removeKit(id)}
        />
      </section>
    </div>
  );
}

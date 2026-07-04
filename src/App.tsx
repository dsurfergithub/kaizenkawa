import { useEffect, useRef, useState } from 'react';
import type { AnalysisPhase, Kit, Macros, Pad } from './types';
import { NEUTRAL_MACROS } from './types';
import { analyzeSong, type Analysis } from './analysis/analyze';
import { detectBpm } from './analysis/tempo';
import { pickReplacement, selectGroupedPads, type GroupedCandidate } from './analysis/select';
import { buildKit } from './analysis/kitBuilder';
import { PadPlayer } from './audio/padPlayer';
import { GrooveSequencer } from './audio/sequencer';
import { getAudioContext } from './audio/context';
import { deleteKit, listKits, saveKit } from './db';
import { downloadBlob, exportKitZip } from './export/kit';
import { renderTrackWav } from './export/track';
import PadGrid from './components/PadGrid';
import GrooveView from './components/GrooveView';
import MacroControls from './components/MacroControls';
import PadEditor from './components/PadEditor';
import Library from './components/Library';

interface SourceSession {
  name: string;
  buffer: AudioBuffer;
  analysis: Analysis;
  chosen: GroupedCandidate[];
}

export default function App() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [kit, setKit] = useState<Kit | null>(null);
  const [phase, setPhase] = useState<AnalysisPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [macros, setMacros] = useState<Macros>(NEUTRAL_MACROS);
  const [selectedPadId, setSelectedPadId] = useState<string | null>(null);
  const [mode, setMode] = useState<'pads' | 'groove'>('groove');
  const [playing, setPlaying] = useState(false);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Map<string, boolean>>(new Map());
  const [currentStep, setCurrentStep] = useState(-1);
  const [exporting, setExporting] = useState(false);
  const sourceRef = useRef<SourceSession | null>(null);
  const playerRef = useRef<PadPlayer | null>(null);
  const sequencerRef = useRef<GrooveSequencer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listKits().then(setKits);
  }, []);

  const busy = phase !== null && phase !== 'listo';

  const player = () => (playerRef.current ??= new PadPlayer());
  const sequencer = () => {
    if (!sequencerRef.current) {
      sequencerRef.current = new GrooveSequencer(player());
      sequencerRef.current.onStep(setCurrentStep);
      sequencerRef.current.onBar((active) => {
        setActiveIds(active);
        setPendingIds(new Map());
      });
    }
    return sequencerRef.current;
  };

  const persist = async (next: Kit) => {
    setKit(next);
    sequencer().setPads(next.pads);
    sequencer().bpm = next.bpm;
    await saveKit(next);
    setKits(await listKits());
  };

  const attachKit = async (next: Kit) => {
    await player().loadPads(next.pads);
    sequencer().stop();
    setPlaying(false);
    setActiveIds(new Set());
    setPendingIds(new Map());
    sequencer().setPads(next.pads);
    sequencer().bpm = next.bpm;
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
      const bpm = detectBpm(analysis.frames);
      const chosen = selectGroupedPads(analysis.candidates, macros);
      const name = file.name.replace(/\.[^.]+$/, '');
      const newKit = buildKit(name, buffer, chosen, bpm);

      sourceRef.current = { name, buffer, analysis, chosen };
      await attachKit(newKit);
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
    const chosen = selectGroupedPads(source.analysis.candidates, macros);
    const next = { ...buildKit(source.name, source.buffer, chosen, kit.bpm), id: kit.id, name: kit.name };
    source.chosen = chosen;
    await attachKit(next);
    await persist(next);
    setPhase('listo');
  };

  const swapPad = async (pad: Pad) => {
    const source = sourceRef.current;
    if (!source || !kit) return;
    const index = kit.pads.findIndex((p) => p.id === pad.id);
    const current = source.chosen[index];
    const replacement = pickReplacement(
      source.analysis.candidates,
      macros,
      source.chosen.map((c) => c.candidate),
      current.candidate,
      pad.group,
    );
    if (!replacement) return;

    source.chosen = source.chosen.map((c, i) => (i === index ? { candidate: replacement, group: pad.group } : c));
    const rebuilt = buildKit(source.name, source.buffer, [{ candidate: replacement, group: pad.group }], kit.bpm)
      .pads[0];
    // conserva patrón y ajustes del pad reemplazado
    const merged: Pad = { ...rebuilt, pattern: pad.pattern, gain: pad.gain, pitch: pad.pitch, reverse: pad.reverse };
    const next = { ...kit, pads: kit.pads.map((p, i) => (i === index ? merged : p)) };
    await player().loadPads(next.pads);
    await persist(next);
    setSelectedPadId(merged.id);
    player().play(merged);
  };

  const updatePad = async (pad: Pad) => {
    if (!kit) return;
    player().invalidate(pad.id);
    await persist({ ...kit, pads: kit.pads.map((p) => (p.id === pad.id ? pad : p)) });
  };

  const loadKit = async (k: Kit) => {
    setSelectedPadId(null);
    sourceRef.current = null; // sin la canción original no hay re-selección
    await attachKit(k);
    setKit(k);
    setPhase('listo');
  };

  const removeKit = async (id: string) => {
    await deleteKit(id);
    if (kit?.id === id) {
      sequencer().stop();
      setPlaying(false);
      setKit(null);
      setPhase(null);
    }
    setKits(await listKits());
  };

  const togglePlay = () => {
    const seq = sequencer();
    if (seq.isPlaying) {
      seq.stop();
      setPlaying(false);
    } else {
      getAudioContext(); // gesto del usuario: asegura que el contexto arranca
      seq.start();
      setPlaying(true);
    }
  };

  const togglePad = (pad: Pad) => {
    const seq = sequencer();
    seq.toggle(pad.id);
    setActiveIds(seq.activeIds);
    setPendingIds(seq.pendingToggles);
    if (!seq.isPlaying) togglePlay();
  };

  const exportTrack = async (bars: number) => {
    if (!kit) return;
    setExporting(true);
    try {
      const blob = await renderTrackWav(kit, activeIds, bars);
      downloadBlob(blob, `${kit.name || 'track'}-groove.wav`);
    } finally {
      setExporting(false);
    }
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
          Convierte cualquier canción en un kit de samples y crea grooves — 100 % local, sin subir nada.
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
          Se detectan los momentos musicalmente útiles y se clasifican en Drums, Bajo, Melodía y FX.
        </p>
      </div>

      {error && <p className="error">⚠ {error}</p>}

      {kit && phase === 'listo' && (
        <>
          <section className="panel">
            <div className="pad-editor__head">
              <h2>2 · {kit.name}</h2>
              <div className="tabs">
                <button className={mode === 'groove' ? 'tab tab--on' : 'tab'} onClick={() => setMode('groove')}>
                  Groove
                </button>
                <button className={mode === 'pads' ? 'tab tab--on' : 'tab'} onClick={() => setMode('pads')}>
                  Pads
                </button>
              </div>
            </div>

            {mode === 'groove' ? (
              <GrooveView
                pads={kit.pads}
                bpm={kit.bpm}
                onBpmChange={(bpm) => void persist({ ...kit, bpm })}
                playing={playing}
                onPlayToggle={togglePlay}
                activeIds={activeIds}
                pendingIds={pendingIds}
                currentStep={currentStep}
                onPadToggle={togglePad}
                onPatternChange={(pad, pattern) => void updatePad({ ...pad, pattern })}
                onPreview={(pad) => player().play(pad)}
                onExport={(bars) => void exportTrack(bars)}
                exporting={exporting}
              />
            ) : (
              <>
                <PadGrid
                  pads={kit.pads}
                  selectedId={selectedPadId}
                  onPlay={(pad) => player().play(pad)}
                  onSelect={(pad) => setSelectedPadId(pad.id === selectedPadId ? null : pad.id)}
                />
                <button
                  onClick={() => {
                    void exportKitZip(kit).then((blob) => downloadBlob(blob, `${kit.name || 'kit'}.zip`));
                  }}
                >
                  ⬇ Exportar samples (ZIP de WAVs)
                </button>
              </>
            )}
          </section>

          {mode === 'pads' && selectedPad && selectedIndex >= 0 && (
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

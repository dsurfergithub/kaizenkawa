import type { Instrument, SessionConfig, SessionProgress, Zone } from '../types';
import { assignKeyRanges, sessionNotes } from '../notes';
import { getAudioContext } from './context';
import { renderDemoNote } from './demoSynth';
import { InputRecorder, sleep } from './recorder';
import { fadeOut, normalizePeak, trimSilence } from './processing';
import { encodeWav } from './wav';
import * as midi from './midi';

export interface SessionHandle {
  cancel(): void;
  result: Promise<Instrument | null>;
}

/**
 * Ejecuta una sesión de auto-sampleo: recorre las notas configuradas, dispara
 * cada una (sinte demo o MIDI externo), graba, procesa y construye el
 * instrumento multi-muestreado.
 */
export function runSession(
  cfg: SessionConfig,
  onProgress: (p: SessionProgress) => void,
): SessionHandle {
  let cancelled = false;

  const result = (async (): Promise<Instrument | null> => {
    const notes = sessionNotes(cfg.lowNote, cfg.highNote, cfg.interval);
    const ranges = assignKeyRanges(notes);
    const sampleRate = getAudioContext().sampleRate;
    const zones: Zone[] = [];

    const recorder = cfg.source === 'midi' ? new InputRecorder() : null;
    if (recorder) {
      onProgress({ current: 0, total: notes.length, note: notes[0], phase: 'preparando' });
      await recorder.open();
    }

    try {
      for (let i = 0; i < notes.length; i++) {
        if (cancelled) return null;
        const note = notes[i];
        onProgress({ current: i, total: notes.length, note, phase: 'grabando' });

        let buffer: AudioBuffer;
        if (cfg.source === 'demo') {
          buffer = await renderDemoNote(note, cfg.velocity, cfg.noteLength, cfg.releaseTail, sampleRate);
        } else {
          const outId = cfg.midiOutputId!;
          const recording = recorder!.record(cfg.noteLength + cfg.releaseTail + 0.2);
          await sleep(50); // deja arrancar MediaRecorder antes del note-on
          midi.noteOn(outId, cfg.midiChannel, note, cfg.velocity);
          await sleep(cfg.noteLength * 1000);
          midi.noteOff(outId, cfg.midiChannel, note);
          buffer = await recording;
        }

        onProgress({ current: i, total: notes.length, note, phase: 'procesando' });
        if (cfg.trimSilence) buffer = trimSilence(buffer);
        if (cfg.normalize) buffer = normalizePeak(buffer);
        buffer = fadeOut(buffer);

        zones.push({
          rootNote: note,
          loKey: ranges[i].lo,
          hiKey: ranges[i].hi,
          wav: encodeWav(buffer),
        });
      }
    } finally {
      if (recorder) {
        if (cfg.midiOutputId) midi.allNotesOff(cfg.midiOutputId, cfg.midiChannel);
        recorder.close();
      }
    }

    onProgress({ current: notes.length, total: notes.length, note: cfg.highNote, phase: 'terminado' });
    return {
      id: crypto.randomUUID(),
      name: cfg.name || 'Instrumento sin nombre',
      createdAt: Date.now(),
      sampleRate,
      zones,
    };
  })();

  return {
    cancel: () => {
      cancelled = true;
    },
    result,
  };
}

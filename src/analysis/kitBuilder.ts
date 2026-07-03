import type { Candidate } from './analyze';
import type { Kit, Pad } from '../types';
import { fadeOut, normalizePeak, trimSilence } from '../audio/processing';
import { encodeWav } from '../audio/wav';

function extractSlice(src: AudioBuffer, t0: number, t1: number): AudioBuffer {
  const start = Math.floor(t0 * src.sampleRate);
  const end = Math.min(src.length, Math.ceil(t1 * src.sampleRate));
  const out = new AudioBuffer({
    numberOfChannels: src.numberOfChannels,
    length: Math.max(1, end - start),
    sampleRate: src.sampleRate,
  });
  for (let c = 0; c < src.numberOfChannels; c++) {
    out.copyToChannel(src.getChannelData(c).subarray(start, end), c);
  }
  return out;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

/** Extrae los slices elegidos de la canción original y monta el kit. */
export function buildKit(name: string, source: AudioBuffer, chosen: Candidate[]): Kit {
  const pads: Pad[] = chosen.map((c) => {
    let slice = extractSlice(source, c.t0, c.t1);
    slice = trimSilence(slice, 0.002);
    slice = normalizePeak(slice, 0.95);
    slice = fadeOut(slice, 10);
    return {
      id: crypto.randomUUID(),
      label: formatTime(c.t0),
      sourceTime: c.t0,
      wav: encodeWav(slice),
      gain: 1,
      pitch: 0,
      reverse: false,
    };
  });

  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    sampleRate: source.sampleRate,
    pads,
  };
}

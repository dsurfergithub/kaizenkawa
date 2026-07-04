import type { GroupedCandidate } from './select';
import type { Kit, Pad, PadGroup } from '../types';
import { STEPS } from '../types';
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

function pattern(...steps: number[]): boolean[] {
  const p = new Array<boolean>(STEPS).fill(false);
  for (const s of steps) p[s] = true;
  return p;
}

/** Patrones iniciales por grupo para que el groove suene a la primera. */
const DEFAULT_PATTERNS: Record<PadGroup, boolean[][]> = {
  drums: [pattern(0, 4, 8, 12), pattern(2, 6, 10, 14), pattern(4, 12), pattern()],
  bass: [pattern(0, 7, 10), pattern(), pattern(), pattern()],
  melody: [pattern(0, 8), pattern(), pattern(), pattern()],
  fx: [pattern(0), pattern(), pattern(), pattern()],
};

/** Extrae los slices elegidos de la canción original y monta el kit agrupado. */
export function buildKit(name: string, source: AudioBuffer, chosen: GroupedCandidate[], bpm: number): Kit {
  const groupCounts = new Map<PadGroup, number>();

  const pads: Pad[] = chosen.map(({ candidate: c, group }) => {
    let slice = extractSlice(source, c.t0, c.t1);
    slice = trimSilence(slice, 0.002);
    slice = normalizePeak(slice, 0.95);
    slice = fadeOut(slice, 10);
    const nth = groupCounts.get(group) ?? 0;
    groupCounts.set(group, nth + 1);
    return {
      id: crypto.randomUUID(),
      label: formatTime(c.t0),
      sourceTime: c.t0,
      wav: encodeWav(slice),
      gain: 1,
      pitch: 0,
      reverse: false,
      group,
      pattern: [...(DEFAULT_PATTERNS[group][nth] ?? pattern())],
    };
  });

  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    sampleRate: source.sampleRate,
    bpm,
    pads,
  };
}

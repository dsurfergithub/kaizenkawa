import type { FrameData } from './analyze';
import { ANALYSIS_RATE } from './analyze';

const HOP = 512;
const MIN_BPM = 60;
const MAX_BPM = 180;

/**
 * Estima el BPM por autocorrelación de la envolvente de onsets (spectral
 * flux). Prefiere tempos alrededor de 120 BPM cuando hay ambigüedad
 * (dobles/mitades), como es habitual en detectores sencillos.
 */
export function detectBpm(frames: FrameData[]): number {
  const frameRate = ANALYSIS_RATE / HOP;
  const flux = frames.map((f) => f.flux);
  const n = flux.length;
  if (n < frameRate * 4) return 100; // menos de ~4 s: no hay base fiable

  const mean = flux.reduce((a, b) => a + b, 0) / n;
  const signal = flux.map((v) => Math.max(0, v - mean));

  const minLag = Math.floor((60 / MAX_BPM) * frameRate);
  const maxLag = Math.ceil((60 / MIN_BPM) * frameRate);

  let bestLag = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i + lag < n; i++) corr += signal[i] * signal[i + lag];
    corr /= n - lag;
    const bpm = (60 * frameRate) / lag;
    // Ponderación log-gaussiana centrada en 120 BPM.
    const weight = Math.exp(-0.5 * ((Math.log2(bpm / 120) / 0.6) ** 2));
    const score = corr * weight;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round((60 * frameRate) / bestLag)));
}

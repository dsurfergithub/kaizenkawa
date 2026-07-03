import { fft, hannWindow } from './fft';

/** Frecuencia de análisis: suficiente para features y mucho más rápida que 44.1k. */
export const ANALYSIS_RATE = 22050;
const FRAME = 1024;
const HOP = 512;
/** Hz por debajo de los cuales contamos energía como "graves". */
const LOW_BAND_HZ = 200;

export interface FrameData {
  /** Tiempo del frame en segundos. */
  t: number;
  flux: number;
  energy: number;
  centroid: number;
  flatness: number;
  lowRatio: number;
}

export interface CandidateFeatures {
  rms: number;
  /** Relación pico/media de energía: percusividad. */
  crest: number;
  /** Segundos desde el inicio del slice hasta el pico de energía. */
  attackTime: number;
  centroid: number;
  flatness: number;
  lowRatio: number;
  duration: number;
  onsetStrength: number;
}

export interface Candidate {
  /** Inicio/fin en segundos sobre la canción original. */
  t0: number;
  t1: number;
  features: CandidateFeatures;
}

export interface Analysis {
  frames: FrameData[];
  candidates: Candidate[];
}

/** Mezcla a mono y remuestrea a la frecuencia de análisis. */
async function toAnalysisMono(src: AudioBuffer): Promise<Float32Array> {
  const length = Math.ceil((src.duration + 0.05) * ANALYSIS_RATE);
  const ctx = new OfflineAudioContext(1, length, ANALYSIS_RATE);
  const node = ctx.createBufferSource();
  node.buffer = src;
  node.connect(ctx.destination);
  node.start(0);
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0);
}

function computeFrames(mono: Float32Array): FrameData[] {
  const window = hannWindow(FRAME);
  const bins = FRAME / 2;
  const hzPerBin = ANALYSIS_RATE / FRAME;
  const lowBins = Math.max(1, Math.floor(LOW_BAND_HZ / hzPerBin));
  const re = new Float32Array(FRAME);
  const im = new Float32Array(FRAME);
  let prevMag: Float32Array | null = null;
  const frames: FrameData[] = [];

  for (let start = 0; start + FRAME <= mono.length; start += HOP) {
    for (let i = 0; i < FRAME; i++) {
      re[i] = mono[start + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);

    const mag = new Float32Array(bins);
    let energy = 0;
    let lowEnergy = 0;
    let magSum = 0;
    let centroidNum = 0;
    let logSum = 0;
    let flux = 0;
    for (let k = 1; k < bins; k++) {
      const m = Math.hypot(re[k], im[k]);
      mag[k] = m;
      const p = m * m;
      energy += p;
      if (k <= lowBins) lowEnergy += p;
      magSum += m;
      centroidNum += m * k * hzPerBin;
      logSum += Math.log(m + 1e-9);
      if (prevMag) {
        const d = m - prevMag[k];
        if (d > 0) flux += d;
      }
    }
    const meanMag = magSum / (bins - 1);
    frames.push({
      t: start / ANALYSIS_RATE,
      flux,
      energy,
      centroid: magSum > 1e-9 ? centroidNum / magSum : 0,
      flatness: meanMag > 1e-9 ? Math.exp(logSum / (bins - 1)) / meanMag : 0,
      lowRatio: energy > 1e-12 ? lowEnergy / energy : 0,
    });
    prevMag = mag;
  }
  return frames;
}

/** Detección de onsets por spectral flux con umbral adaptativo. */
function detectOnsets(frames: FrameData[]): number[] {
  const flux = frames.map((f) => f.flux);
  const maxFlux = Math.max(...flux, 1e-9);
  const norm = flux.map((v) => v / maxFlux);

  const onsets: number[] = [];
  const win = 10;
  const minGapFrames = Math.round((0.09 * ANALYSIS_RATE) / HOP); // ≥90 ms entre onsets
  let last = -minGapFrames;

  for (let i = 1; i < norm.length - 1; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - win); j <= Math.min(norm.length - 1, i + win); j++) {
      sum += norm[j];
      count++;
    }
    const threshold = (sum / count) * 1.3 + 0.01;
    const isPeak = norm[i] >= norm[i - 1] && norm[i] >= norm[i + 1];
    if (isPeak && norm[i] > threshold && i - last >= minGapFrames) {
      onsets.push(i);
      last = i;
    }
  }
  return onsets;
}

const MIN_SLICE_SEC = 0.06;
const MAX_SLICE_SEC = 2.5;
/** Pre-roll antes del onset para no comerse el transitorio. */
const PRE_ROLL_SEC = 0.012;

function buildCandidates(frames: FrameData[], onsets: number[], songDuration: number): Candidate[] {
  const frameSec = HOP / ANALYSIS_RATE;
  const meanEnergy = frames.reduce((a, f) => a + f.energy, 0) / Math.max(frames.length, 1);
  const candidates: Candidate[] = [];

  for (let i = 0; i < onsets.length; i++) {
    const startFrame = onsets[i];
    const nextFrame = i + 1 < onsets.length ? onsets[i + 1] : frames.length;
    const t0 = Math.max(0, frames[startFrame].t - PRE_ROLL_SEC);
    const t1 = Math.min(songDuration, Math.min(frames[Math.min(nextFrame, frames.length - 1)].t, t0 + MAX_SLICE_SEC));
    if (t1 - t0 < MIN_SLICE_SEC) continue;

    const endFrame = Math.min(frames.length, startFrame + Math.ceil((t1 - t0) / frameSec));
    const slice = frames.slice(startFrame, Math.max(endFrame, startFrame + 1));

    let energySum = 0;
    let peak = 0;
    let peakIdx = 0;
    let centroidNum = 0;
    let flatnessNum = 0;
    let lowNum = 0;
    for (let f = 0; f < slice.length; f++) {
      const e = slice[f].energy;
      energySum += e;
      if (e > peak) {
        peak = e;
        peakIdx = f;
      }
      centroidNum += slice[f].centroid * e;
      flatnessNum += slice[f].flatness * e;
      lowNum += slice[f].lowRatio * e;
    }
    if (energySum / slice.length < meanEnergy * 0.05) continue; // descarta momentos casi silenciosos
    const meanE = energySum / slice.length;

    candidates.push({
      t0,
      t1,
      features: {
        rms: Math.sqrt(meanE),
        crest: peak / (meanE + 1e-12),
        attackTime: peakIdx * frameSec,
        centroid: energySum > 0 ? centroidNum / energySum : 0,
        flatness: energySum > 0 ? flatnessNum / energySum : 0,
        lowRatio: energySum > 0 ? lowNum / energySum : 0,
        duration: t1 - t0,
        onsetStrength: frames[startFrame].flux,
      },
    });
  }
  return candidates;
}

/**
 * Analiza la canción: STFT → onsets → slices candidatos con características
 * (sonoridad, percusividad, brillo, textura, graves). Todo local, sin red.
 */
export async function analyzeSong(src: AudioBuffer): Promise<Analysis> {
  const mono = await toAnalysisMono(src);
  const frames = computeFrames(mono);
  const onsets = detectOnsets(frames);
  const candidates = buildCandidates(frames, onsets, src.duration);
  return { frames, candidates };
}

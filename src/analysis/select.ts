import type { Candidate, CandidateFeatures } from './analyze';
import type { Macros } from '../types';

const FEATURE_KEYS = ['rms', 'crest', 'attackTime', 'centroid', 'flatness', 'lowRatio', 'duration'] as const;

type FeatureVector = number[];

/** Normaliza cada característica a z-score sobre el conjunto de candidatos. */
function zScores(candidates: Candidate[]): FeatureVector[] {
  const means: number[] = [];
  const stds: number[] = [];
  for (const key of FEATURE_KEYS) {
    const values = candidates.map((c) => c.features[key as keyof CandidateFeatures]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || 1;
    means.push(mean);
    stds.push(std);
  }
  return candidates.map((c) =>
    FEATURE_KEYS.map((key, i) => (c.features[key as keyof CandidateFeatures] - means[i]) / stds[i]),
  );
}

const Z = { rms: 0, crest: 1, attackTime: 2, centroid: 3, flatness: 4, lowRatio: 5, duration: 6 };

/** Puntúa un candidato según las macros (cada macro en 0..1, 0.5 = neutro). */
function score(z: FeatureVector, macros: Macros): number {
  const attackPref = (macros.attack - 0.5) * 2;
  const brightPref = (macros.brightness - 0.5) * 2;
  const gritPref = (macros.grit - 0.5) * 2;
  return (
    0.8 * z[Z.rms] +
    0.3 * z[Z.crest] +
    1.2 * attackPref * -z[Z.attackTime] +
    1.2 * brightPref * z[Z.centroid] +
    1.2 * gritPref * z[Z.flatness]
  );
}

function distance(a: FeatureVector, b: FeatureVector): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/**
 * Selección greedy con diversidad: empieza por el mejor candidato y va
 * añadiendo el que maximiza puntuación + λ·(distancia mínima a lo ya elegido).
 * λ crece con la macro de variedad.
 */
export function selectPads(candidates: Candidate[], macros: Macros, count = 16): Candidate[] {
  if (candidates.length <= count) return [...candidates].sort((a, b) => a.t0 - b.t0);

  const z = zScores(candidates);
  const scores = z.map((v) => score(v, macros));
  const lambda = 0.3 + macros.variety * 1.7;

  const selected: number[] = [];
  const remaining = new Set(candidates.map((_, i) => i));

  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  selected.push(best);
  remaining.delete(best);

  while (selected.length < count && remaining.size > 0) {
    let bestIdx = -1;
    let bestValue = -Infinity;
    for (const i of remaining) {
      let minDist = Infinity;
      for (const s of selected) minDist = Math.min(minDist, distance(z[i], z[s]));
      const value = scores[i] + lambda * minDist;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    }
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }

  return selected
    .map((i) => candidates[i])
    .sort((a, b) => a.t0 - b.t0);
}

/**
 * Sustituto para un pad: el mejor candidato no usado, favoreciendo que se
 * distinga de lo que ya suena en el kit.
 */
export function pickReplacement(
  candidates: Candidate[],
  macros: Macros,
  used: Candidate[],
  exclude: Candidate,
): Candidate | null {
  const usedSet = new Set(used.map((c) => c.t0));
  const pool = candidates.filter((c) => !usedSet.has(c.t0) && c !== exclude);
  if (pool.length === 0) return null;

  const all = [...pool, ...used];
  const z = zScores(all);
  const lambda = 0.3 + macros.variety * 1.7;
  const usedZ = z.slice(pool.length);

  let bestIdx = 0;
  let bestValue = -Infinity;
  for (let i = 0; i < pool.length; i++) {
    let minDist = Infinity;
    for (const u of usedZ) minDist = Math.min(minDist, distance(z[i], u));
    const value = score(z[i], macros) + lambda * minDist;
    if (value > bestValue) {
      bestValue = value;
      bestIdx = i;
    }
  }
  return pool[bestIdx];
}

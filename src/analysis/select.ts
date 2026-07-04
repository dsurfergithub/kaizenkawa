import type { Candidate, CandidateFeatures } from './analyze';
import type { Macros, PadGroup } from '../types';
import { PAD_GROUPS } from '../types';

const FEATURE_KEYS = ['rms', 'crest', 'attackTime', 'centroid', 'flatness', 'lowRatio', 'duration'] as const;

type FeatureVector = number[];

export interface GroupedCandidate {
  candidate: Candidate;
  group: PadGroup;
}

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

/** Afinidad de un candidato con cada grupo, a partir de sus características. */
function groupScores(z: FeatureVector): Record<PadGroup, number> {
  return {
    drums: 0.8 * z[Z.crest] - 0.8 * z[Z.attackTime] - 0.5 * z[Z.duration],
    bass: 1.2 * z[Z.lowRatio] - 0.6 * z[Z.centroid] - 0.2 * z[Z.flatness],
    melody: 0.4 * z[Z.duration] - 0.6 * z[Z.flatness] + 0.2 * z[Z.centroid],
    fx: 0.8 * z[Z.flatness] + 0.3 * z[Z.duration],
  };
}

/** Clasifica cada candidato en su grupo más afín. */
export function classifyCandidates(candidates: Candidate[]): PadGroup[] {
  const zs = zScores(candidates);
  return zs.map((z) => {
    const scores = groupScores(z);
    return PAD_GROUPS.reduce((best, g) => (scores[g] > scores[best] ? g : best), PAD_GROUPS[0]);
  });
}

/** Selección greedy con diversidad dentro de un subconjunto de índices. */
function greedyPick(
  indices: number[],
  zs: FeatureVector[],
  scores: number[],
  lambda: number,
  count: number,
): number[] {
  if (indices.length <= count) return [...indices];
  const selected: number[] = [];
  const remaining = new Set(indices);

  let best = indices[0];
  for (const i of indices) if (scores[i] > scores[best]) best = i;
  selected.push(best);
  remaining.delete(best);

  while (selected.length < count && remaining.size > 0) {
    let bestIdx = -1;
    let bestValue = -Infinity;
    for (const i of remaining) {
      let minDist = Infinity;
      for (const s of selected) minDist = Math.min(minDist, distance(zs[i], zs[s]));
      const value = scores[i] + lambda * minDist;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    }
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }
  return selected;
}

/**
 * Selección estilo Groovepad: 4 candidatos por grupo (drums, bajo, melodía,
 * fx). Dentro de cada grupo se puntúa con las macros y se maximiza la
 * diversidad; si un grupo no llega a 4, se rellena con los mejores restantes.
 */
export function selectGroupedPads(candidates: Candidate[], macros: Macros, perGroup = 4): GroupedCandidate[] {
  const zs = zScores(candidates);
  const scores = zs.map((z) => score(z, macros));
  const groups = classifyCandidates(candidates);
  const lambda = 0.3 + macros.variety * 1.7;

  const chosen: GroupedCandidate[] = [];
  const used = new Set<number>();

  for (const group of PAD_GROUPS) {
    const pool = candidates.map((_, i) => i).filter((i) => groups[i] === group && !used.has(i));
    const picked = greedyPick(pool, zs, scores, lambda, perGroup);
    picked.sort((a, b) => candidates[a].t0 - candidates[b].t0);
    for (const i of picked) {
      chosen.push({ candidate: candidates[i], group });
      used.add(i);
    }
    // Relleno si el grupo se queda corto: mejores candidatos restantes.
    let deficit = perGroup - picked.length;
    if (deficit > 0) {
      const rest = candidates
        .map((_, i) => i)
        .filter((i) => !used.has(i))
        .sort((a, b) => scores[b] - scores[a]);
      for (const i of rest) {
        if (deficit === 0) break;
        chosen.push({ candidate: candidates[i], group });
        used.add(i);
        deficit--;
      }
    }
  }
  return chosen;
}

/**
 * Sustituto para un pad: el mejor candidato no usado del mismo grupo,
 * favoreciendo que se distinga de lo que ya suena en el kit.
 */
export function pickReplacement(
  candidates: Candidate[],
  macros: Macros,
  used: Candidate[],
  exclude: Candidate,
  group: PadGroup,
): Candidate | null {
  const groups = classifyCandidates(candidates);
  const usedSet = new Set(used.map((c) => c.t0));
  const poolIdx = candidates
    .map((_, i) => i)
    .filter((i) => groups[i] === group && !usedSet.has(candidates[i].t0) && candidates[i] !== exclude);
  // Si el grupo está agotado, abre el pool a cualquier candidato libre.
  const finalPool = poolIdx.length
    ? poolIdx
    : candidates.map((_, i) => i).filter((i) => !usedSet.has(candidates[i].t0) && candidates[i] !== exclude);
  if (finalPool.length === 0) return null;

  const zs = zScores(candidates);
  const scores = zs.map((z) => score(z, macros));
  const lambda = 0.3 + macros.variety * 1.7;
  const usedZ = candidates.map((c, i) => (usedSet.has(c.t0) ? zs[i] : null)).filter((v): v is FeatureVector => !!v);

  let bestIdx = finalPool[0];
  let bestValue = -Infinity;
  for (const i of finalPool) {
    let minDist = Infinity;
    for (const u of usedZ) minDist = Math.min(minDist, distance(zs[i], u));
    const value = scores[i] + lambda * (usedZ.length ? minDist : 0);
    if (value > bestValue) {
      bestValue = value;
      bestIdx = i;
    }
  }
  return candidates[bestIdx];
}

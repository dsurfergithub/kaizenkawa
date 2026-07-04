/** Parámetros ajustables de cada pad. */
export interface PadParams {
  /** Ganancia lineal (1 = sin cambio). */
  gain: number;
  /** Transposición en semitonos. */
  pitch: number;
  reverse: boolean;
}

/** Grupos de la rejilla groove, al estilo Groovepad. */
export type PadGroup = 'drums' | 'bass' | 'melody' | 'fx';

export const PAD_GROUPS: PadGroup[] = ['drums', 'bass', 'melody', 'fx'];
export const GROUP_LABELS: Record<PadGroup, string> = {
  drums: 'Drums',
  bass: 'Bajo',
  melody: 'Melodía',
  fx: 'FX',
};

/** Pasos del secuenciador por pad (semicorcheas de un compás de 4/4). */
export const STEPS = 16;

/** Un pad del kit: una muestra extraída de la canción + sus ajustes. */
export interface Pad extends PadParams {
  id: string;
  label: string;
  /** Momento de la canción del que salió (segundos), para referencia. */
  sourceTime: number;
  wav: ArrayBuffer;
  group: PadGroup;
  /** Patrón de 16 pasos del secuenciador. */
  pattern: boolean[];
}

export interface Kit {
  id: string;
  name: string;
  createdAt: number;
  sampleRate: number;
  bpm: number;
  pads: Pad[];
}

/**
 * Macros que dirigen la selección de samples (0..1, 0.5 = neutro),
 * al estilo de los macro-controles de AutoSamplr.
 */
export interface Macros {
  /** Preferir ataques más afilados y percusivos. */
  attack: number;
  /** Preferir sonidos más brillantes (centroide espectral alto). */
  brightness: number;
  /** Preferir texturas más sucias/ruidosas (planitud espectral alta). */
  grit: number;
  /** Cuánta variedad tímbrica exigir entre los pads elegidos. */
  variety: number;
}

export const NEUTRAL_MACROS: Macros = { attack: 0.5, brightness: 0.5, grit: 0.5, variety: 0.5 };

export type AnalysisPhase = 'decodificando' | 'analizando' | 'seleccionando' | 'listo';

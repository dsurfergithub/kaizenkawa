/** Una zona = una muestra grabada, mapeada a un rango de teclas. */
export interface Zone {
  /** Nota MIDI raíz con la que se grabó la muestra. */
  rootNote: number;
  /** Rango de teclas que dispara esta zona (inclusive). */
  loKey: number;
  hiKey: number;
  /** PCM mono/estéreo intercalado como WAV para persistencia. */
  wav: ArrayBuffer;
}

export interface Instrument {
  id: string;
  name: string;
  createdAt: number;
  sampleRate: number;
  zones: Zone[];
}

export type SourceKind = 'demo' | 'midi';

export interface SessionConfig {
  name: string;
  source: SourceKind;
  /** Salida MIDI (id del dispositivo) cuando source === 'midi'. */
  midiOutputId?: string;
  midiChannel: number;
  lowNote: number;
  highNote: number;
  /** Intervalo en semitonos entre notas muestreadas. */
  interval: number;
  /** Duración de la nota sostenida, en segundos. */
  noteLength: number;
  /** Cola de release grabada tras el note-off, en segundos. */
  releaseTail: number;
  velocity: number;
  /** Recortar silencio inicial/final. */
  trimSilence: boolean;
  /** Normalizar el pico de cada muestra. */
  normalize: boolean;
}

export interface SessionProgress {
  current: number;
  total: number;
  note: number;
  phase: 'preparando' | 'grabando' | 'procesando' | 'terminado' | 'cancelado';
}

import type { Instrument } from '../types';
import { getAudioContext } from './context';
import { decodeWav } from './wav';

interface LoadedZone {
  rootNote: number;
  loKey: number;
  hiKey: number;
  buffer: AudioBuffer;
}

interface ActiveVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * Reproductor del instrumento muestreado: elige la zona por tecla y ajusta el
 * tono con playbackRate (repitch clásico de sampler).
 */
export class SamplerPlayer {
  private zones: LoadedZone[] = [];
  private voices = new Map<number, ActiveVoice>();
  private master: GainNode;

  constructor() {
    const ctx = getAudioContext();
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
  }

  async load(instrument: Instrument): Promise<void> {
    const ctx = getAudioContext();
    this.zones = await Promise.all(
      instrument.zones.map(async (z) => ({
        rootNote: z.rootNote,
        loKey: z.loKey,
        hiKey: z.hiKey,
        buffer: await decodeWav(ctx, z.wav),
      })),
    );
  }

  get isLoaded(): boolean {
    return this.zones.length > 0;
  }

  noteOn(note: number): void {
    const zone = this.zones.find((z) => note >= z.loKey && note <= z.hiKey);
    if (!zone) return;
    this.noteOff(note); // re-disparo: corta la voz previa de la misma tecla

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = zone.buffer;
    source.playbackRate.value = Math.pow(2, (note - zone.rootNote) / 12);

    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain).connect(this.master);
    source.start();
    source.onended = () => {
      if (this.voices.get(note)?.source === source) this.voices.delete(note);
    };
    this.voices.set(note, { source, gain });
  }

  noteOff(note: number, releaseSec = 0.25): void {
    const voice = this.voices.get(note);
    if (!voice) return;
    this.voices.delete(note);
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.001, now + releaseSec);
    voice.source.stop(now + releaseSec + 0.05);
  }

  allOff(): void {
    for (const note of [...this.voices.keys()]) this.noteOff(note, 0.05);
  }
}

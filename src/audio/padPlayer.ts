import type { Pad } from '../types';
import { getAudioContext } from './context';
import { decodeWav } from './wav';

function reversed(buffer: AudioBuffer): AudioBuffer {
  const out = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length,
    sampleRate: buffer.sampleRate,
  });
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c).slice();
    data.reverse();
    out.copyToChannel(data, c);
  }
  return out;
}

/** Reproductor del kit: decodifica cada pad una vez y lo dispara con sus ajustes. */
export class PadPlayer {
  private buffers = new Map<string, AudioBuffer>();
  private reversedCache = new Map<string, AudioBuffer>();
  private master: GainNode;

  constructor() {
    const ctx = getAudioContext();
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
  }

  async loadPads(pads: Pad[]): Promise<void> {
    const ctx = getAudioContext();
    this.buffers.clear();
    this.reversedCache.clear();
    await Promise.all(
      pads.map(async (p) => {
        this.buffers.set(p.id, await decodeWav(ctx, p.wav));
      }),
    );
  }

  play(pad: Pad): void {
    let buffer = this.buffers.get(pad.id);
    if (!buffer) return;
    if (pad.reverse) {
      let rev = this.reversedCache.get(pad.id);
      if (!rev) {
        rev = reversed(buffer);
        this.reversedCache.set(pad.id, rev);
      }
      buffer = rev;
    }
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, pad.pitch / 12);
    const gain = ctx.createGain();
    gain.gain.value = pad.gain;
    source.connect(gain).connect(this.master);
    source.start();
  }

  /** Invalida la caché de un pad tras editarlo (p. ej. cambio de reverse). */
  invalidate(padId: string): void {
    this.reversedCache.delete(padId);
  }
}

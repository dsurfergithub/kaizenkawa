import type { Kit } from '../types';
import { STEPS } from '../types';
import { getAudioContext } from '../audio/context';
import { normalizePeak } from '../audio/processing';
import { decodeWav, encodeWav } from '../audio/wav';

/**
 * Renderiza offline la mezcla del groove actual: los pads activos repiten su
 * patrón durante `bars` compases al BPM del kit, con sus ajustes aplicados.
 * Devuelve un WAV estéreo listo para descargar.
 */
export async function renderTrackWav(kit: Kit, activeIds: Set<string>, bars: number): Promise<Blob> {
  const ctx = getAudioContext();
  const stepDur = 60 / kit.bpm / 4;
  const tail = 2; // deja sonar las colas del último compás
  const sampleRate = kit.sampleRate;
  const off = new OfflineAudioContext(2, Math.ceil((bars * STEPS * stepDur + tail) * sampleRate), sampleRate);

  const pads = kit.pads.filter((p) => activeIds.has(p.id) && p.pattern.some(Boolean));
  for (const pad of pads) {
    let buffer = await decodeWav(ctx, pad.wav);
    if (pad.reverse) {
      const rev = new AudioBuffer({
        numberOfChannels: buffer.numberOfChannels,
        length: buffer.length,
        sampleRate: buffer.sampleRate,
      });
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c).slice();
        data.reverse();
        rev.copyToChannel(data, c);
      }
      buffer = rev;
    }
    const gain = off.createGain();
    gain.gain.value = pad.gain;
    gain.connect(off.destination);

    for (let bar = 0; bar < bars; bar++) {
      for (let step = 0; step < STEPS; step++) {
        if (!pad.pattern[step]) continue;
        const source = off.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = Math.pow(2, pad.pitch / 12);
        source.connect(gain);
        source.start((bar * STEPS + step) * stepDur);
      }
    }
  }

  // La suma de loops puede superar 0 dBFS: normaliza la mezcla a ~-1 dB.
  const rendered = normalizePeak(await off.startRendering(), 0.89);
  return new Blob([encodeWav(rendered)], { type: 'audio/wav' });
}

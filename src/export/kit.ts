import type { Kit, Pad } from '../types';
import { getAudioContext } from '../audio/context';
import { decodeWav, encodeWav } from '../audio/wav';
import { buildZip } from './zip';

/**
 * Renderiza un pad con sus ajustes (ganancia, pitch, reverse) a un nuevo
 * buffer, para que el WAV exportado suene igual que en la app.
 */
async function renderPad(pad: Pad): Promise<ArrayBuffer> {
  if (pad.gain === 1 && pad.pitch === 0 && !pad.reverse) return pad.wav;

  const ctx = getAudioContext();
  const buffer = await decodeWav(ctx, pad.wav);
  const rate = Math.pow(2, pad.pitch / 12);
  const outLength = Math.max(1, Math.ceil(buffer.length / rate));
  const off = new OfflineAudioContext(buffer.numberOfChannels, outLength, buffer.sampleRate);

  let src = buffer;
  if (pad.reverse) {
    src = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: buffer.length,
      sampleRate: buffer.sampleRate,
    });
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c).slice();
      data.reverse();
      src.copyToChannel(data, c);
    }
  }

  const node = off.createBufferSource();
  node.buffer = src;
  node.playbackRate.value = rate;
  const gain = off.createGain();
  gain.gain.value = pad.gain;
  node.connect(gain).connect(off.destination);
  node.start(0);
  return encodeWav(await off.startRendering());
}

/**
 * Empaqueta el kit como WAVs numerados (01.wav…16.wav) en un ZIP — la
 * convención que aceptan Koala, SP-404MKII, Logic, Maschine, etc. al importar
 * en bloque.
 */
export async function exportKitZip(kit: Kit): Promise<Blob> {
  const safeName = kit.name.replace(/[^\w\- ]+/g, '').trim() || 'kit';
  const files: Array<{ name: string; data: ArrayBuffer | string }> = [];
  for (let i = 0; i < kit.pads.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    files.push({ name: `${safeName}/${num}.wav`, data: await renderPad(kit.pads[i]) });
  }
  files.push({
    name: `${safeName}/kit.txt`,
    data: `${kit.name}\nGenerado por KaizenKawa Samplr\nPads: ${kit.pads.length}\n`,
  });
  return buildZip(files);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

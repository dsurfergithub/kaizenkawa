import type { Instrument } from '../types';
import { noteName } from '../notes';
import { buildZip } from './zip';

function sampleFileName(rootNote: number): string {
  return `samples/${String(rootNote).padStart(3, '0')}_${noteName(rootNote).replace('#', 's')}.wav`;
}

/** Genera el texto SFZ del instrumento (formato abierto, compatible con muchos samplers). */
export function toSfz(instrument: Instrument): string {
  const lines = [
    `// ${instrument.name} — exportado por KaizenKawa AutoSampler`,
    '<control>',
    'default_path=',
    '<global>',
    'ampeg_release=0.3',
    '',
  ];
  for (const z of instrument.zones) {
    lines.push(
      '<region>',
      `sample=${sampleFileName(z.rootNote)}`,
      `pitch_keycenter=${z.rootNote}`,
      `lokey=${z.loKey}`,
      `hikey=${z.hiKey}`,
      '',
    );
  }
  return lines.join('\n');
}

/** Empaqueta el instrumento (SFZ + WAVs) en un ZIP descargable. */
export function exportInstrumentZip(instrument: Instrument): Blob {
  const safeName = instrument.name.replace(/[^\w\- ]+/g, '').trim() || 'instrumento';
  const files: Array<{ name: string; data: ArrayBuffer | string }> = [
    { name: `${safeName}.sfz`, data: toSfz(instrument) },
  ];
  for (const z of instrument.zones) {
    files.push({ name: sampleFileName(z.rootNote), data: z.wav });
  }
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

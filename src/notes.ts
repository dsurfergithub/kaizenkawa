const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(midi: number): string {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

/** Notas a muestrear entre low y high con un intervalo dado (siempre incluye high). */
export function sessionNotes(low: number, high: number, interval: number): number[] {
  const notes: number[] = [];
  for (let n = low; n <= high; n += interval) notes.push(n);
  if (notes[notes.length - 1] !== high) notes.push(high);
  return notes;
}

/** Reparte rangos de teclado entre zonas: cada zona cubre hasta el punto medio con la siguiente. */
export function assignKeyRanges(roots: number[]): Array<{ lo: number; hi: number }> {
  return roots.map((root, i) => {
    const lo = i === 0 ? 0 : Math.floor((roots[i - 1] + root) / 2) + 1;
    const hi = i === roots.length - 1 ? 127 : Math.floor((root + roots[i + 1]) / 2);
    return { lo, hi };
  });
}

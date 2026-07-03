export interface MidiOut {
  id: string;
  name: string;
}

let access: MIDIAccess | null = null;

export async function listMidiOutputs(): Promise<MidiOut[]> {
  if (!('requestMIDIAccess' in navigator)) return [];
  try {
    access = access ?? (await navigator.requestMIDIAccess());
    return [...access.outputs.values()].map((o) => ({ id: o.id, name: o.name ?? o.id }));
  } catch {
    return [];
  }
}

export function midiSupported(): boolean {
  return 'requestMIDIAccess' in navigator;
}

function getOutput(id: string): MIDIOutput | undefined {
  return access?.outputs.get(id) ?? undefined;
}

export function noteOn(outputId: string, channel: number, note: number, velocity: number): void {
  getOutput(outputId)?.send([0x90 | (channel & 0x0f), note & 0x7f, velocity & 0x7f]);
}

export function noteOff(outputId: string, channel: number, note: number): void {
  getOutput(outputId)?.send([0x80 | (channel & 0x0f), note & 0x7f, 0]);
}

export function allNotesOff(outputId: string, channel: number): void {
  getOutput(outputId)?.send([0xb0 | (channel & 0x0f), 123, 0]);
}

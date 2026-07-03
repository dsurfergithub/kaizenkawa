import { midiToFreq } from '../notes';

/**
 * Sinte interno de demostración: permite probar el auto-sampleo sin hardware.
 * Se renderiza offline (rápido y con timing exacto), igual que haría el
 * muestreo real pero sin pasar por el micrófono.
 */
export async function renderDemoNote(
  note: number,
  velocity: number,
  noteLength: number,
  releaseTail: number,
  sampleRate: number,
): Promise<AudioBuffer> {
  const total = noteLength + releaseTail;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * sampleRate), sampleRate);
  const freq = midiToFreq(note);
  const vel = velocity / 127;

  const out = ctx.createGain();
  out.connect(ctx.destination);

  // Dos osciladores ligeramente desafinados + sub, filtro con envolvente.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 8 * vel + 200, 0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 120), noteLength);
  filter.Q.value = 1.2;
  filter.connect(out);

  const mk = (type: OscillatorType, f: number, gain: number) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g).connect(filter);
    osc.start(0);
    osc.stop(total);
  };
  mk('sawtooth', freq * 1.003, 0.28 * vel);
  mk('sawtooth', freq * 0.997, 0.28 * vel);
  mk('sine', freq / 2, 0.2 * vel);

  // Envolvente de amplitud: ataque corto, sustain, release tras note-off.
  const now = 0;
  out.gain.setValueAtTime(0, now);
  out.gain.linearRampToValueAtTime(1, now + 0.01);
  out.gain.setValueAtTime(1, noteLength);
  out.gain.exponentialRampToValueAtTime(0.0001, Math.max(noteLength + releaseTail * 0.9, noteLength + 0.05));

  return ctx.startRendering();
}

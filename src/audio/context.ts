let ctx: AudioContext | null = null;

/** AudioContext compartido; se crea/reanuda con el primer gesto del usuario. */
export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

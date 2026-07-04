import type { Pad } from '../types';
import { STEPS } from '../types';
import { getAudioContext } from './context';
import type { PadPlayer } from './padPlayer';

const LOOKAHEAD_SEC = 0.12;
const TICK_MS = 30;

/**
 * Secuenciador groove estilo Groovepad: reloj sobre el AudioContext con
 * lookahead, patrones de 16 pasos, y activación/desactivación de loops
 * sincronizada al inicio del compás. Solo puede sonar un pad por grupo:
 * esa regla la aplica quien llama (App) al calcular el set activo.
 */
export class GrooveSequencer {
  bpm = 100;

  private pads: Pad[] = [];
  private active = new Set<string>();
  private pending = new Map<string, boolean>();
  private step = 0;
  private nextStepTime = 0;
  private timer: number | null = null;
  private player: PadPlayer;
  private onStepCb: ((step: number) => void) | null = null;
  private onBarCb: ((active: Set<string>) => void) | null = null;

  constructor(player: PadPlayer) {
    this.player = player;
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  get activeIds(): Set<string> {
    return new Set(this.active);
  }

  get pendingToggles(): Map<string, boolean> {
    return new Map(this.pending);
  }

  setPads(pads: Pad[]): void {
    this.pads = pads;
    const ids = new Set(pads.map((p) => p.id));
    for (const id of [...this.active]) if (!ids.has(id)) this.active.delete(id);
    this.pending.clear();
  }

  /** Callback de playhead para la UI. */
  onStep(cb: ((step: number) => void) | null): void {
    this.onStepCb = cb;
  }

  /** Callback al aplicar los toggles pendientes (inicio de compás). */
  onBar(cb: ((active: Set<string>) => void) | null): void {
    this.onBarCb = cb;
  }

  /**
   * Conmuta el loop de un pad. En marcha, el cambio se aplica al empezar el
   * siguiente compás (como Groovepad); parado, es inmediato. Activar un pad
   * desactiva al resto de su grupo.
   */
  toggle(padId: string): void {
    const pad = this.pads.find((p) => p.id === padId);
    if (!pad) return;
    const targetOn = this.pending.has(padId) ? !this.pending.get(padId)! : !this.active.has(padId);

    const apply = (map: (id: string, on: boolean) => void) => {
      map(padId, targetOn);
      if (targetOn) {
        for (const other of this.pads) {
          if (other.group === pad.group && other.id !== padId) map(other.id, false);
        }
      }
    };

    if (this.isPlaying) {
      apply((id, on) => {
        const currentlyOn = this.active.has(id);
        if (currentlyOn === on) this.pending.delete(id);
        else this.pending.set(id, on);
      });
    } else {
      apply((id, on) => (on ? this.active.add(id) : this.active.delete(id)));
      this.onBarCb?.(this.activeIds);
    }
  }

  start(): void {
    if (this.isPlaying) return;
    const ctx = getAudioContext();
    this.step = 0;
    this.nextStepTime = ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.pending.clear();
    this.onStepCb?.(-1);
  }

  private tick(): void {
    const ctx = getAudioContext();
    const stepDur = 60 / this.bpm / 4;
    while (this.nextStepTime < ctx.currentTime + LOOKAHEAD_SEC) {
      if (this.step === 0 && this.pending.size > 0) {
        for (const [id, on] of this.pending) {
          if (on) this.active.add(id);
          else this.active.delete(id);
        }
        this.pending.clear();
        this.onBarCb?.(this.activeIds);
      }
      for (const pad of this.pads) {
        if (this.active.has(pad.id) && pad.pattern[this.step]) {
          this.player.play(pad, this.nextStepTime);
        }
      }
      const uiStep = this.step;
      const delay = Math.max(0, (this.nextStepTime - ctx.currentTime) * 1000);
      setTimeout(() => this.onStepCb?.(uiStep), delay);

      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % STEPS;
    }
  }
}

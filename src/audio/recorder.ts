import { getAudioContext } from './context';

/**
 * Grabador de la entrada de audio (micrófono / interfaz de línea) basado en
 * MediaRecorder. Se abre una vez por sesión y graba un clip por nota.
 */
export class InputRecorder {
  private stream: MediaStream | null = null;

  async open(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  }

  /** Graba `seconds` y devuelve el clip decodificado como AudioBuffer. */
  async record(seconds: number): Promise<AudioBuffer> {
    if (!this.stream) throw new Error('El grabador no está abierto');
    const stream = this.stream;
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);

    const done = new Promise<Blob>((resolve, reject) => {
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType }));
      rec.onerror = () => reject(new Error('Fallo de MediaRecorder'));
    });

    rec.start();
    await sleep(seconds * 1000);
    rec.stop();
    const blob = await done;
    return getAudioContext().decodeAudioData(await blob.arrayBuffer());
  }

  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

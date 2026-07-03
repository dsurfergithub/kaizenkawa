/** Recorta silencio al inicio/final según un umbral, dejando un pequeño margen. */
export function trimSilence(buffer: AudioBuffer, threshold = 0.004, padMs = 8): AudioBuffer {
  const pad = Math.floor((padMs / 1000) * buffer.sampleRate);
  let start = buffer.length;
  let end = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > threshold) {
        if (i < start) start = i;
        break;
      }
    }
    for (let i = data.length - 1; i >= 0; i--) {
      if (Math.abs(data[i]) > threshold) {
        if (i > end) end = i;
        break;
      }
    }
  }
  if (start >= end) return buffer; // todo silencio: no tocar
  start = Math.max(0, start - pad);
  end = Math.min(buffer.length - 1, end + pad);
  return sliceBuffer(buffer, start, end + 1);
}

export function normalizePeak(buffer: AudioBuffer, targetPeak = 0.98): AudioBuffer {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  }
  if (peak < 1e-6) return buffer;
  const gain = targetPeak / peak;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
  return buffer;
}

/** Fundido de salida corto para evitar clics al final de la muestra. */
export function fadeOut(buffer: AudioBuffer, ms = 15): AudioBuffer {
  const n = Math.min(buffer.length, Math.floor((ms / 1000) * buffer.sampleRate));
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) {
      data[buffer.length - 1 - i] *= i / n;
    }
  }
  return buffer;
}

function sliceBuffer(buffer: AudioBuffer, start: number, end: number): AudioBuffer {
  const length = end - start;
  const out = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length,
    sampleRate: buffer.sampleRate,
  });
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.copyToChannel(buffer.getChannelData(c).subarray(start, end), c);
  }
  return out;
}

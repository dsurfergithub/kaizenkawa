# KaizenKawa Samplr

Clon del concepto de **[AutoSamplr](https://autosamplr.com/)** pensado para **móvil** y **100 % local**: importas una canción, la app busca automáticamente los **momentos musicalmente útiles** (no cortes a intervalos fijos), los puntúa por sonoridad, ataque, contenido espectral, timbre y lo distinto que es cada sonido de los demás, y monta un **kit de 16 pads tocable** que puedes ajustar con macros y exportar como **WAVs numerados** para tu sampler favorito.

Todo el análisis ocurre en el dispositivo: no hay servidor, no hay cuentas, el audio no sale de tu móvil.

## Cómo funciona (pipeline de análisis)

1. **Decodificación** del archivo (MP3/WAV/OGG/M4A… lo que soporte el navegador) y mezcla a mono a 22 050 Hz para el análisis.
2. **STFT** (FFT radix-2 propia, ventana Hann 1024, hop 512) calculando por frame: energía, *spectral flux*, centroide espectral (brillo), planitud espectral (suciedad/ruido) y proporción de graves.
3. **Detección de onsets** por spectral flux con umbral adaptativo (media local × 1.3) y separación mínima de 90 ms.
4. **Candidatos**: cada onset abre un slice hasta el siguiente onset (máx. 2.5 s), con pre-roll para no comerse el transitorio; se descartan los casi silenciosos. Cada candidato lleva su vector de características: RMS, factor de cresta (percusividad), tiempo de ataque, centroide, planitud, graves, duración y fuerza del onset.
5. **Selección con diversidad**: las características se normalizan (z-score), se puntúan según las **macros**, y una selección greedy maximiza `puntuación + λ·(distancia mínima a lo ya elegido)` — así el kit no acaba con 16 versiones del mismo bombo. λ crece con la macro *Variedad*.
6. **Construcción del kit**: los slices se extraen de la canción original a resolución completa, se recorta el silencio, se normaliza el pico y se aplica un fundido anti-clic.

### Macros (como los macro-controles de AutoSamplr)

| Macro | Efecto en la selección |
|---|---|
| **Ataque** | prefiere transitorios afilados y percusivos |
| **Brillo** | prefiere sonidos con centroide espectral alto/bajo |
| **Grit** | prefiere texturas ruidosas/sucias (planitud espectral) |
| **Variedad** | exige más distancia tímbrica entre los 16 pads |

Mueve las macros y pulsa **Re-seleccionar**: la re-selección es instantánea porque el análisis ya está hecho.

## Funcionalidades

- Importación de cualquier audio local del móvil (selector de archivos).
- **Clasificación automática en 4 grupos** estilo Groovepad — Drums, Bajo, Melodía y FX — según las características de cada sample (percusividad, graves, tonalidad, ruido); 4 pads por grupo.
- **Modo Groove** (estilo [Groovepad](https://play.google.com/store/apps/details?id=com.easybrain.make.music)):
  - Cada pad tiene un **patrón de 16 pasos** (secuenciador de semicorcheas, un compás de 4/4) con patrones iniciales por grupo para que suene a la primera.
  - Tocar un pad **lanza/para su loop sincronizado al siguiente compás**; solo un loop activo por grupo (activar uno apaga el anterior).
  - **BPM detectado automáticamente** de la canción (autocorrelación de onsets) y ajustable 60–180.
  - Reloj de audio con *lookahead* sobre el AudioContext: timing estable también en móvil.
  - **Exportar track**: render offline de N compases (2–32) del groove activo a WAV estéreo, con los ajustes de cada pad aplicados y mezcla normalizada a −1 dBFS.
- **Modo Pads**: disparo one-shot clásico, edición por pad (ganancia, tono ±12 st, reverse, 🎲 cambiar sample por otro candidato del mismo grupo) y export del kit como ZIP de WAVs numerados (`01.wav`…`16.wav`, la convención de Koala, SP-404MKII, Logic, Maschine…).
- **Biblioteca local** de kits en IndexedDB (incluye patrones y BPM) — sobrevive a recargas y funciona offline.
- **PWA instalable** con service worker: úsala sin conexión.

### Icono de la app

El manifest apunta a `public/icons/icon-192.png`, `icon-512.png` y `apple-touch-icon.png` (180×180). Ahora contienen un placeholder generado desde el SVG; para usar tu ilustración, sustituye esos tres PNG por tu imagen (cuadrada) con los mismos nombres — no hay que tocar código.

## Evaluación técnica: por qué PWA

| Opción | Pros | Contras |
|---|---|---|
| **PWA (Web Audio)** ✅ | Instalable en Android/iOS sin tiendas, offline total, un solo código, DSP suficiente en JS para este análisis | Sin acceso a la librería de música de iOS más allá del selector de archivos |
| React Native / Flutter | Look nativo | El DSP serio exige módulos nativos/FFI; doble complejidad |
| Nativo (Kotlin/Swift) | Máximo rendimiento | Dos códigos; innecesario: el análisis de una canción de 4 min tarda ~1-2 s en JS |

La pieza que AutoSamplr tiene y esta versión no: **separación de stems** (voz/batería/bajo/resto) antes de trocear. Eso requiere un modelo de ML (tipo Demucs); es viable en local con ONNX Runtime Web + WebGPU, pero pesa decenas de MB y se deja como evolución (ver hoja de ruta). El resto del pipeline (slicing por interés musical + scoring + diversidad + macros + export de kits) está completo.

## Cómo ejecutarla

```bash
npm install
npm run dev        # desarrollo (accesible desde el móvil en la misma red)
npm run build      # chequeo de tipos + build de producción en dist/
npm run preview    # sirve el build
```

Para usarla en el móvil: `npm run dev` y abre `http://<ip-del-pc>:5173`, o despliega `dist/` en cualquier hosting estático y añádela a la pantalla de inicio.

## Estructura

```
src/
  analysis/
    fft.ts         # FFT radix-2 + ventana Hann
    analyze.ts     # STFT, features por frame, onsets, candidatos
    tempo.ts       # detección de BPM por autocorrelación de onsets
    select.ts      # clasificación en grupos + scoring con macros + diversidad
    kitBuilder.ts  # extracción de slices, grupos y patrones por defecto
  audio/
    context.ts     # AudioContext compartido
    padPlayer.ts   # disparo de pads (gain, pitch, reverse, programable)
    sequencer.ts   # secuenciador groove: lookahead, sync a compás, 1 loop/grupo
    processing.ts  # trim de silencio, normalización, fades
    wav.ts         # codificación/decodificación WAV 16-bit
  export/
    kit.ts         # render de pads con ajustes + ZIP de WAVs numerados
    track.ts       # render offline del groove (N compases) a WAV estéreo
    zip.ts         # escritor ZIP sin dependencias (método store)
  components/      # GrooveView, PadGrid, MacroControls, PadEditor, Library
  db.ts            # persistencia IndexedDB (con migración de campos nuevos)
public/
  manifest.webmanifest, sw.js, icons/   # PWA
```

## Hoja de ruta

- [ ] **Separación de stems local** (ONNX Runtime Web + WebGPU, modelo tipo Demucs cuantizado) y muestreo por stem, como AutoSamplr.
- [ ] Análisis en un Web Worker para no tocar el hilo de UI con canciones largas.
- [ ] Vista de forma de onda con los slices marcados y ajuste fino de inicio/fin por pad.
- [ ] Export `.adg` (Ableton Drum Rack) y `.ablpresetbundle`.
- [ ] Grabación en vivo de la sesión groove (looper) además del render por compases.
- [ ] Patrones de más de un compás (2/4 compases) y swing ajustable.
- [ ] FX de interpretación estilo Groovepad (filtro, flanger, gate) sobre la mezcla.

# KaizenKawa AutoSampler

Clon de la idea de **Auto Sampler** (Logic Pro / MainStage) pensado para **móvil** y **100 % local**: recorre automáticamente un rango de notas, dispara cada nota en un instrumento (por MIDI o con el sinte interno de demo), graba el audio resultante, lo procesa y construye un **instrumento multi-muestreado** que puedes tocar al momento y exportar en formato **SFZ**.

Todo ocurre en el dispositivo: no hay servidor, no hay cuentas, no sale audio de tu móvil.

## Evaluación: qué hace falta y qué stack se eligió

### Qué hace un Auto Sampler

1. Reproduce cada N semitonos una nota (MIDI note-on → sostener → note-off) contra un instrumento fuente.
2. Graba el audio de cada nota, incluida la cola de release.
3. Procesa cada muestra: recorte de silencio, normalización, fundido anti-clic.
4. Mapea las muestras en zonas de teclado (cada muestra cubre las teclas vecinas re-pitcheando).
5. Deja un instrumento tocable y exportable a un formato estándar de sampler.

### Opciones de stack evaluadas

| Opción | Pros | Contras |
|---|---|---|
| **PWA (Web Audio + Web MIDI)** ✅ elegida | Instalable en Android/iOS sin tiendas, offline total, un solo código, desarrollo y pruebas rápidos | Web MIDI no está en Safari iOS; latencia algo mayor que nativo |
| React Native / Expo | Look nativo, acceso a audio nativo vía módulos | El audio de baja latencia requiere módulos nativos propios (Oboe/AVAudioEngine); doble build |
| Flutter | Buen rendimiento UI | Mismo problema: audio serio = FFI a C++; ecosistema MIDI móvil verde |
| Nativo (Kotlin + Swift) | Máximo control (AudioKit, Oboe, CoreMIDI/AMIDI) | Dos códigos, ciclo de desarrollo mucho más lento |

La PWA cubre todo el flujo con APIs estándar: `Web MIDI` (disparo de notas a hardware), `getUserMedia`/`MediaRecorder` (grabación de la entrada de audio), `Web Audio`/`OfflineAudioContext` (síntesis, procesado y reproducción), `IndexedDB` (persistencia local de instrumentos y WAVs) y *service worker* (offline). Si más adelante se necesita latencia nativa o Web MIDI en iOS, el núcleo (`src/audio/`) es TypeScript puro y se puede envolver en Capacitor sin reescribirlo.

### Matriz de soporte móvil

| Función | Android (Chrome) | iOS (Safari) |
|---|---|---|
| Sinte interno demo + sampler | ✅ | ✅ |
| Grabación por micrófono/interfaz | ✅ | ✅ |
| Disparo MIDI a hardware externo | ✅ (USB-OTG / BLE MIDI) | ❌ Web MIDI no soportado → usar modo demo o un navegador con Web MIDI (p. ej. Web MIDI Browser) |
| Instalación como app + offline | ✅ | ✅ (Añadir a pantalla de inicio) |

## Funcionalidades actuales

- **Sesión de auto-sampleo configurable**: rango de notas, intervalo en semitonos, velocity, duración de nota, cola de release.
- **Dos fuentes**: sinte interno de demostración (render offline, sin hardware) o sinte externo vía **Web MIDI** grabando por la entrada de audio.
- **Procesado por muestra**: recorte de silencio, normalización de pico y fade-out anti-clic.
- **Mapeo automático de zonas**: cada muestra cubre hasta el punto medio con la siguiente; re-pitch por `playbackRate`.
- **Teclado táctil multi-touch** con glissando para tocar el instrumento resultante.
- **Biblioteca local** en IndexedDB: guarda, carga y borra instrumentos sin conexión.
- **Exportación SFZ + WAVs en ZIP** (formato abierto, compatible con Sforzando, TAL Sampler, DecentSampler vía conversión, etc.).
- **PWA**: manifest + service worker para instalarla y usarla sin red.

## Cómo ejecutarla

```bash
npm install
npm run dev        # desarrollo (accesible en LAN con --host ya activado)
npm run build      # comprobación de tipos + build de producción en dist/
npm run preview    # sirve el build
```

Para probarla en el móvil durante el desarrollo: arranca `npm run dev`, abre `http://<ip-del-pc>:5173` desde el móvil (misma red). Nota: `getUserMedia` y Web MIDI requieren **HTTPS o localhost**; para pruebas de micrófono en LAN usa un túnel HTTPS o despliega el `dist/` en cualquier hosting estático.

## Estructura

```
src/
  audio/
    autosample.ts    # orquestación de la sesión de muestreo
    demoSynth.ts     # sinte interno (OfflineAudioContext)
    midi.ts          # salida Web MIDI (note on/off)
    recorder.ts      # grabación de entrada de audio (MediaRecorder)
    processing.ts    # trim de silencio, normalización, fades
    samplerPlayer.ts # reproducción multi-zona con re-pitch
    wav.ts           # codificación/decodificación WAV 16-bit
  export/
    sfz.ts           # generación de .sfz y empaquetado
    zip.ts           # escritor ZIP sin dependencias (método store)
  components/        # formulario de sesión, teclado táctil, biblioteca
  db.ts              # persistencia IndexedDB
  notes.ts           # utilidades de notas/rangos
public/
  manifest.webmanifest, sw.js, icons/   # PWA
```

## Hoja de ruta sugerida

- [ ] Capas de velocity (muestrear varias dinámicas por nota y hacer crossfade).
- [ ] Detección automática de puntos de loop (autocorrelación) para sustain infinito.
- [ ] Entrada MIDI (tocar el sampler con un teclado físico).
- [ ] Grabación vía AudioWorklet (PCM crudo, timing exacto) en lugar de MediaRecorder.
- [ ] Import de instrumentos (ZIP/SFZ) y backup/restore de la biblioteca.
- [ ] Envoltorio Capacitor si se necesita CoreMIDI en iOS o publicar en tiendas.

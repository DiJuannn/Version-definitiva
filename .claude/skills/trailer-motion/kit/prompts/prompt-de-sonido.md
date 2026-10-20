# Prompt de sonido (un prompt aparte, después de la imagen)

La imagen es código mudo; el sonido sale de **un prompt más**, conducido por la misma tabla de tiempos (y por la simulación física, si la hay). Todo sintetizado: sin samples, sin voces, sin palabras, 48 kHz estéreo. Nosotros lo hacemos con numpy (`kit/audio/sfxlib.py` + `build.py`); el Claw Machine lo hizo con Web Audio en un `OfflineAudioContext`. El método es el mismo.

## Bloques

```
SOUND: synthesized only, no samples, no voices or words, 48 kHz stereo WAV.
       Every hit peaks ONE FRAME after its picture event, driven by the same timeline (cues.js)
       and the physics bake.

ROOM:    la cama de ambiente (tono de sala, zumbido grave, sonidos lejanos). Nunca silencio digital salvo a propósito.
MACHINE: cada mecanismo con su sonido y ligado a su velocidad (el motor sube de tono con la velocidad de la grúa,
         con un bend tipo Doppler; el cable con carraca; las pinzas cierran con un clac seco y abren con uno suave).
PROPS:   cada aterrizaje de la simulación es un golpe suave, más grave cuanto más grande.
TRIES:   la música por actos: un loop pícaro en los intentos 1–2; un «womp» triste y un resoplido al fallar;
         en el último intento la música cae a un latido y un tic-tac, todo aguanta la respiración;
         el premio aterriza con un THUNK profundo.
WIN:     jingle de victoria, whoosh del salto, chirrido del peluche al abrazarlo, un brillo cálido del rubor
         y un único «tink» en el parpadeo final.
MIX:     unos −14 LUFS integrados, true peak ≤ −2 dBTP, y el limitador NUNCA quita más de 3 dB.
```

## Las 3 correcciones de sonido que hicieron falta (con números)

1. **Tras la primera mezcla:** la cama, demasiado baja, y los golpes, demasiado altos.
   - Música +6 dB, ambiente +10, foley +1.
   - THUNK −5, golpe −6, moneda, botón y pinzas −3/−4, latido −7 («que pulse, no que pegue»).
   - Normalizar a −14 LUFS con limitador con anticipación a −3,0 dBTP.
2. **Tras medir el AAC final:** medía −1,9 dBTP, por encima del límite. Se limitó el WAV a −3,4 dBTP.
3. **Tras el informe del limitador:** quitaba 5,4 dB porque cada golpe estaba 14 dB por encima de la cama.
   - Música +3 dB más, ambiente +4.
   - Efectos y foley −2/−3, carraca y motor −3, latido −3, aterrizaje del salto −3.
   - Volver a masterizar.

**Resultado:** −27,1 LUFS en crudo → −14,0 LUFS, −3,3 dBTP en el WAV y 2,98 dB de reducción máxima.

## Con nuestras herramientas

| Paso | Herramienta |
|---|---|
| Golpes un fotograma después de la imagen | `place(fx, sonido, H["golpe"] + 1/FPS)` en `build.py`; comprueba con `kit/checks/sincronia-golpes.py banda.wav cues.js` |
| Master con informe | `kit/audio/limitador.py` (`masterizar(mix, SR, lufs=-14, techo_dbtp=-3.0)` → LUFS crudo, final, pico y reducción máxima) |
| Sonoridad por tramos | `kit/checks/sonoridad-medio-segundo.py` (que el drop caiga donde explota la imagen) |
| El MP4 entregado | `ffmpeg … -af ebur128=peak=true`: mide **siempre** el archivo final, no el WAV |

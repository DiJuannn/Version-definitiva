"""¿Cada sonido cae en su fotograma? Regla Claw Machine: el pico del sonido llega 1 fotograma DESPUÉS de la imagen
(se lee como causado por ella). Antes de la imagen, o más de 2 fotogramas después, se nota.

Uso:
  python3 -I sincronia-golpes.py <audio.wav|video.mp4> <cues.js|"t1 t2 …"> [--fps 30] [--ventana 0.12]
    Con cues.js lee el bloque hits: { nombre: segundos, … } (mismo formato que usa build.py).

Para cada golpe busca el ataque más fuerte (subida de la envolvente de 2 ms) entre t − ventana y t + ventana,
y da el desfase en fotogramas. OK = de 0 a +2 fotogramas, con +1 como ideal."""
import re, subprocess, sys
import numpy as np

a = sys.argv[1:]
if len(a) < 2: sys.exit(__doc__)
src, cues = a[0], a[1]
opt = lambda k, d: float(a[a.index(k) + 1]) if k in a else d
FPS, WIN, SR = opt("--fps", 30.0), opt("--ventana", 0.12), 48000
if cues.endswith(".js"):
    js = open(cues).read(); blk = js[js.index("hits:"):]; blk = blk[: blk.index("}")]
    hits = [(k, float(v)) for k, v in re.findall(r"(\w+):\s*([\d.]+)", blk)]
else:
    hits = [(f"g{i + 1}", float(v)) for i, v in enumerate(cues.split())]
raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, np.float32)
hop = int(SR * 0.002); n = len(x) // hop
env = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, 1) + 1e-12)
db = 20 * np.log10(env); flux = np.maximum(0, np.diff(db, prepend=db[0]))
fallos = 0
print(f"{'golpe':<12}{'imagen':>8}{'sonido':>9}{'desfase':>10}")
for k, t in hits:
    i0, i1 = int((t - WIN) / 0.002), int((t + WIN) / 0.002)
    if i1 >= n or i0 < 0: continue
    j = i0 + int(np.argmax(flux[i0:i1])); ts = j * 0.002
    if flux[j] < 3: print(f"{k:<12}{t:8.3f}{'—':>9}{'sin ataque claro':>18}"); continue
    off = (ts - t) * FPS; ok = -0.25 <= off <= 2.25; fallos += not ok
    print(f"{k:<12}{t:8.3f}{ts:9.3f}{off:+8.1f} f  {'OK' if ok else 'ANTES de la imagen' if off < 0 else 'TARDE'}")
print(f"\n{len(hits) - fallos}/{len(hits)} en su sitio" + ("" if not fallos else " · mueve esos efectos en build.py (place(..., t + 1/FPS))"))

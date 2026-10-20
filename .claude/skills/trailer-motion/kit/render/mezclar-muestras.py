"""Mezcla N capturas PNG por fotograma en luz lineal y saca RGB24 crudo por stdout (para ffmpeg).
Entrada por stdin: bloques [uint32 LE longitud][PNG]. Lo lanza render-suave.mjs.
Uso: python3 -I mezclar-muestras.py <ancho> <alto> <muestras> [grano]
grano: desviación del ruido en niveles de 8 bit (0 = solo dither). Ruido con semilla por fotograma: determinista."""
import io, struct, sys
import numpy as np
from PIL import Image

W, H, N = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
GRANO = float(sys.argv[4]) if len(sys.argv) > 4 else 0.6
inp, out = sys.stdin.buffer, sys.stdout.buffer
lut = np.where((x := np.arange(256) / 255.0) <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4).astype(np.float32)

def to_srgb(l):
    l = np.clip(l, 0, 1)
    return np.where(l <= 0.0031308, l * 12.92, 1.055 * np.power(l, 1 / 2.4) - 0.055)

def leer():
    h = inp.read(4)
    if len(h) < 4: return None
    n = struct.unpack("<I", h)[0]; return inp.read(n)

f = 0
while True:
    acc = np.zeros((H, W, 3), np.float32); k = 0
    for _ in range(N):
        png = leer()
        if png is None: break
        im = np.asarray(Image.open(io.BytesIO(png)).convert("RGB"))
        acc += lut[im]; k += 1
    if k == 0: break
    rng = np.random.default_rng(1000 + f)
    v = to_srgb(acc / k) * 255.0 + rng.uniform(-0.5, 0.5, acc.shape) + (rng.normal(0, GRANO, (H, W, 1)) if GRANO > 0 else 0)
    out.write(np.clip(np.rint(v), 0, 255).astype(np.uint8).tobytes()); f += 1
out.flush()

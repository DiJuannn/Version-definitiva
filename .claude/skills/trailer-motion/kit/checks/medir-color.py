"""Mide el color de marca en los fotogramas renderizados («mide, no adivines»).
En el Claw Machine el héroe debía leerse D97757 y medía C6775D / E58B68: se corrigió el albedo con números.

Uso:
  python3 -I medir-color.py <video> <hex_objetivo> <tiempos> [--caja x,y,w,h] [--tol 28] [--base hex_material]
    tiempos: "2.5 4.6 7.6"   caja: zona donde está el héroe (por defecto, todo el cuadro)
    --tol: distancia Lab máxima para contar un píxel como «del héroe» (por defecto 28)
    --base: color actual del material; propone el nuevo hex para que el render se acerque al objetivo

Salida por tiempo: mediana medida (hex), ΔE76 frente al objetivo y % de píxeles usados. Al final, la media y,
con --base, el material corregido (por canal en luz lineal: base × objetivo / medido).
ΔE < 3 ≈ indistinguible · 3–6 se nota al compararlo · > 6 ya no es el color de marca."""
import subprocess, sys
import numpy as np

def hex2rgb(h): h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)
def rgb2hex(c): return "#" + "".join(f"{int(round(np.clip(v, 0, 255))):02X}" for v in c)
def lin(c): c = c / 255.0; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def srgb(l): l = np.clip(l, 0, 1); return 255 * np.where(l <= 0.0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - 0.055)
def lab(c):
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin(c) @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

a = sys.argv[1:]
if len(a) < 3: sys.exit(__doc__)
video, target, times = a[0], hex2rgb(a[1]), [float(x) for x in a[2].split()]
opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
caja, tol, base = opt("--caja"), float(opt("--tol", 28)), opt("--base")
w, h = map(int, subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", video], capture_output=True, text=True).stdout.strip().split(","))
x0, y0, cw, ch = map(int, caja.split(",")) if caja else (0, 0, w, h)
tl = lab(target); meds = []
for t in times:
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", str(t), "-i", video, "-frames:v", "1", "-vf", f"crop={cw}:{ch}:{x0}:{y0}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    px = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(float)
    d = np.linalg.norm(lab(px) - tl, axis=1); sel = px[d < tol]
    if len(sel) < 50: print(f"{t:6.2f}s  sin píxeles del héroe (sube --tol o ajusta --caja)"); continue
    m = np.median(sel, 0); meds.append(m); de = float(np.linalg.norm(lab(m) - tl))
    print(f"{t:6.2f}s  medido {rgb2hex(m)}  ΔE {de:5.1f}  ({100 * len(sel) / len(px):4.1f} % del recorte)  {'OK' if de < 3 else 'se nota' if de < 6 else 'FUERA DE MARCA'}")
if meds:
    m = np.median(meds, 0); print(f"\nmediana global {rgb2hex(m)} · objetivo {rgb2hex(target)} · ΔE {np.linalg.norm(lab(m) - tl):.1f}")
    if base:
        nb = srgb(np.clip(lin(hex2rgb(base)) * lin(target) / np.maximum(lin(m), 1e-4), 0, 1))
        print(f"material {base.upper()} → prueba {rgb2hex(nb)} (luz lineal {', '.join(f'{v:.2f}' for v in lin(nb))}) y vuelve a medir")

"""¿El bucle tiene costura? Compara la diferencia último→primer fotograma con la de fotogramas vecinos (y lo mismo con
las muestras de audio). Si la costura está dentro del rango de los vecinos, el bucle es invisible.
Uso: python3 costura-bucle.py video.mp4"""
import subprocess, sys, numpy as np
f = sys.argv[1]
def frames(args):
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", *args, "-i", f, "-vf", "scale=192:108", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 108, 192).astype(float)
v = frames([]); d = [np.abs(v[i + 1] - v[i]).mean() for i in range(len(v) - 1)]; seam = np.abs(v[0] - v[-1]).mean()
print(f"vídeo: costura {seam:.1f} · vecinos {np.percentile(d, 5):.1f}–{np.percentile(d, 95):.1f} → {'OK' if seam <= np.percentile(d, 95) else 'SE NOTA'}")
raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", f, "-ac", "1", "-f", "f32le", "-"], capture_output=True).stdout
a = np.frombuffer(raw, np.float32)
if len(a):
    step = np.abs(np.diff(a)); print(f"audio: salto en la costura {abs(a[0] - a[-1]):.3f} · paso típico p99 {np.percentile(step, 99):.3f}")

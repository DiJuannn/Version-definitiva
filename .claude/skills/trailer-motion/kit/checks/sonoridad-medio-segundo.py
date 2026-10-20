"""Sonoridad (RMS en dBFS) cada medio segundo + LUFS integrado: comprueba que el drop cae donde explota la imagen
y que nada asoma por encima del groove. Uso: python3 sonoridad-medio-segundo.py audio_o_video [paso=0.5]"""
import subprocess, sys, re, numpy as np
f = sys.argv[1]; step = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", f, "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, np.float32); n = int(48000 * step)
for i in range(0, len(x), n):
    seg = x[i:i + n]; db = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
    print(f"{i / 48000:6.2f} s  {db:6.1f} dBFS  {'#' * max(0, int((db + 60) / 2))}")
r = subprocess.run(["ffmpeg", "-nostdin", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
print("LUFS integrado:", re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1], "· pico real:", re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])

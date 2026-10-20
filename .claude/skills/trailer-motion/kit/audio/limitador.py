"""Master con informe (método Claw Machine): normaliza a −14 LUFS con un limitador con anticipación y dice cuánto ha
tenido que apretar. Regla: el limitador nunca quita más de 3 dB. Si quita más, los golpes están demasiado por encima
de la cama: no se arregla en el master, se re-equilibra la mezcla (sube música/ambiente, baja los golpes) y se repite.

Uso como script:   python3 -I limitador.py entrada.wav salida.wav [--lufs -14] [--techo -3.0]
Uso en build.py:   from limitador import masterizar;  y, inf = masterizar(mix, SR, lufs=-14, techo_dbtp=-3.0)

El techo va a −3 dBTP en el WAV porque el AAC sube el pico: en el Claw Machine −3,0 dBTP en el WAV dio −1,9 en el AAC,
y hubo que bajarlo a −3,4 para quedar por debajo de −2 dBTP en el MP4 final. Mide siempre el archivo entregado."""
import re, subprocess, sys, tempfile, os
import numpy as np, soundfile as sf

def medir(x, sr):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f: p = f.name
    sf.write(p, x, sr, subtype="FLOAT")
    r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    os.unlink(p)
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1]), float(re.findall(r"Peak:\s+(-?[\d.inf]+) dBFS", r)[-1])

def pico_verdadero(x, k=4):
    """Pico por muestra con sobremuestreo ×k por FFT (aproxima el true peak entre muestras)."""
    x2 = x if x.ndim == 2 else x[:, None]; n = len(x2)
    X = np.fft.rfft(x2, axis=0); Y = np.zeros((n * k // 2 + 1, x2.shape[1]), complex); Y[: len(X)] = X
    u = np.fft.irfft(Y, n * k, axis=0) * k
    return np.abs(u).max(1).reshape(n, k).max(1)

def limitar(x, sr, techo_db, anticipacion=0.005, suelta=0.08):
    """Limitador de pico con anticipación (picos sobremuestreados ×4 para aproximar true peak). Devuelve y, reducción máx. en dB."""
    techo = 10 ** (techo_db / 20)
    up = pico_verdadero(x)
    need = np.minimum(1.0, techo / np.maximum(up, 1e-9))
    la = max(1, int(anticipacion * sr))
    g = np.minimum.accumulate(np.lib.stride_tricks.sliding_window_view(np.pad(need, (0, la - 1), constant_values=1), la), axis=1)[:, -1]
    a = np.exp(-1 / (suelta * sr)); out = np.empty_like(g); s = 1.0
    for i, v in enumerate(g):                       # ataque instantáneo (ya anticipado), suelta exponencial
        s = v if v < s else a * s + (1 - a) * v; out[i] = s
    y = x * (out[:, None] if x.ndim == 2 else out)
    return np.clip(y, -techo, techo), float(-20 * np.log10(out.min()))

def masterizar(mix, sr, lufs=-14.0, techo_dbtp=-3.0):
    I0, _ = medir(mix, sr); y = mix * 10 ** ((lufs - I0) / 20)
    for _ in range(4):                              # el limitador baja la sonoridad: se compensa y se repite
        z, gr = limitar(y, sr, techo_dbtp); I, tp = medir(z, sr)
        if abs(I - lufs) < 0.15: break
        y = y * 10 ** ((lufs - I) / 20)
    inf = {"LUFS_crudo": round(I0, 1), "LUFS": round(I, 1), "pico_dBTP": round(tp, 1), "reduccion_max_dB": round(gr, 2),
           "veredicto": "OK" if gr <= 3.0 else "EL LIMITADOR APRIETA DEMASIADO: re-equilibra la mezcla (golpes −2/−3 dB, cama +3 dB)"}
    return z, inf

if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2: sys.exit(__doc__)
    opt = lambda k, d: float(a[a.index(k) + 1]) if k in a else d
    x, sr = sf.read(a[0], always_2d=True)
    y, inf = masterizar(x, sr, opt("--lufs", -14.0), opt("--techo", -3.0))
    sf.write(a[1], y, sr, subtype="PCM_24"); print(inf)

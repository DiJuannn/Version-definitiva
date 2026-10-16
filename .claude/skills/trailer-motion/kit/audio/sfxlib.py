"""sfxlib: síntesis determinista de música y SFX de tráiler con numpy (sin scipy).
Todo es estéreo (N, 2) a 48 kHz. Semilla fija: mismo WAV en cada build.
"""
import numpy as np

SR = 48000
RNG = np.random.default_rng(20261016)


def T(d):
    return np.arange(int(d * SR)) / SR


def perc(n, a=0.002, decay=0.08):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / decay)


def pan(mono, p=0.0):
    """p en [-1, 1], ley de potencia constante."""
    th = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(th), mono * np.sin(th)], 1)


def pan_sweep(mono, p0, p1):
    p = np.linspace(p0, p1, len(mono))
    th = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(th), mono * np.sin(th)], 1)


def place(buf, sig, t, gain=1.0):
    i = int(round(t * SR))
    if sig.ndim == 1:
        sig = pan(sig)
    j = min(len(buf), i + len(sig))
    if j > i >= 0:
        buf[i:j] += sig[: j - i] * gain


def stft_filter(x, gain_fn, nfft=2048, hop=512):
    """Filtro variable en el tiempo: gain_fn(freqs, t_centro) -> ganancia por bin. Overlap-add con ventana Hann."""
    w = np.hanning(nfft)
    pad = np.concatenate([np.zeros(nfft), x, np.zeros(nfft)])
    out = np.zeros_like(pad)
    norm = np.zeros_like(pad)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    for s in range(0, len(pad) - nfft, hop):
        tc = (s + nfft / 2 - nfft) / SR
        X = np.fft.rfft(pad[s : s + nfft] * w)
        out[s : s + nfft] += np.fft.irfft(X * gain_fn(f, tc)) * w
        norm[s : s + nfft] += w * w
    out = out / np.maximum(norm, 1e-6)
    return out[nfft : nfft + len(x)]


def bp_gain(fc, q):
    """Campana logarítmica centrada en fc con ancho ~ 1/q octavas."""
    return lambda f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) * q) ** 2)


def lowpass_static(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / fc) ** 4), len(x))


def highpass_static(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * (f / fc) ** 2 / np.sqrt(1 + (f / fc) ** 4), len(x))


def norm(x, peak=1.0):
    m = np.abs(x).max()
    return x * (peak / m) if m > 0 else x


# ------------------------------------------------------------------ SFX
def whoosh(d=0.5, f0=250, f1=4000, p0=-0.8, p1=0.8, q=1.4):
    """Ruido filtrado cuyo centro sube y baja (pico de velocidad a mitad), con paneo que sigue a la cámara."""
    n = int(d * SR)
    x = RNG.standard_normal(n)
    peak = 0.55
    def g(f, tc):
        u = np.clip(tc / d, 0, 1)
        k = np.sin(np.pi * u) ** 1.5  # "velocidad"
        fc = f0 * (f1 / f0) ** k
        return bp_gain(fc, q)(f)
    y = stft_filter(x, g, nfft=1024, hop=256)
    u = np.arange(n) / n
    e = np.where(u < peak, (u / peak) ** 2.2, ((1 - u) / (1 - peak)) ** 1.4)
    return pan_sweep(norm(y) * e * 0.6, p0, p1)


def riser(d=5.0, f0=200, f1=7000):
    """Ruido + seno con glissando exponencial, volumen exponencial: tensión hasta el corte."""
    n = int(d * SR)
    t = np.arange(n) / SR
    u = t / d
    noise = stft_filter(RNG.standard_normal(n), lambda f, tc: bp_gain(f0 * (f1 / f0) ** np.clip(tc / d, 0, 1) ** 1.6, 1.1)(f), 2048, 512)
    fi = 110 * (8 ** (u ** 1.8))  # 110 -> 880 Hz
    tone = np.sin(2 * np.pi * np.cumsum(fi) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(fi * 1.5) / SR)
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(2 + 14 * u ** 2) / SR)  # trémolo que acelera
    y = (norm(noise) * 0.7 + tone * 0.25) * (u ** 2.5) * trem
    return np.stack([y, np.roll(y, 240)], 1) * 0.8  # 5 ms de Haas = ancho


def boom(d=2.2, f0=58, f1=31):
    """Impacto de tráiler: sub con caída de tono + golpe de ruido + 'braam' de sierras graves."""
    n = int(d * SR)
    t = np.arange(n) / SR
    fi = f1 + (f0 - f1) * np.exp(-t / 0.35)
    sub = np.sin(2 * np.pi * np.cumsum(fi) / SR) * np.exp(-t / 0.9)
    hit = lowpass_static(RNG.standard_normal(n), 1800) * perc(n, 0.001, 0.05)
    braam = sum(np.sin(2 * np.pi * h * f * t) / h for f in (55, 82.4, 110.0) for h in range(1, 9))
    braam = lowpass_static(braam, 700) * np.minimum(1, t / 0.03) * np.exp(-t / 0.7)
    y = norm(sub) * 0.9 + norm(hit) * 0.5 + norm(braam) * 0.35
    return np.stack([y, y], 1) * 0.9


def reverse_cymbal(d=1.2):
    n = int(d * SR)
    x = highpass_static(RNG.standard_normal(n), 5000) * np.exp(-np.arange(n) / SR / 0.35)
    y = norm(x[::-1]) * 0.45
    return np.stack([y, np.roll(y, 360)], 1)


def ping(f=1318.5, d=0.35, bright=1.0):
    """Notificación: dos parciales FM, ataque seco. Mismo sonido = motivo del guion (estrés al inicio, alivio al final)."""
    t = T(d)
    mod = np.sin(2 * np.pi * f * 2.0 * t) * 1.2 * bright * np.exp(-t / 0.05)
    y = np.sin(2 * np.pi * f * t + mod) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)
    return y * perc(len(t), 0.002, 0.09) * 0.35


def pop(d=0.12, f0=320, f1=1500):
    """Burbuja: seno con glissando ascendente rapidísimo + clic."""
    t = T(d)
    fi = f0 + (f1 - f0) * (1 - np.exp(-t / 0.012))
    y = np.sin(2 * np.pi * np.cumsum(fi) / SR) * perc(len(t), 0.001, 0.035)
    y[:48] += RNG.standard_normal(48) * 0.3
    return y * 0.5


def ui_click(f=3200):
    t = T(0.03)
    y = highpass_static(RNG.standard_normal(len(t)), 2500) * perc(len(t), 0.0003, 0.004) + np.sin(2 * np.pi * f * t) * perc(len(t), 0.0005, 0.006)
    return y * 0.35


def clapper(gain=1.0):
    """Claqueta: dos transitorios (palos que chocan, 9 ms de separación) + cuerpo de madera modal + sala."""
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for off, g in ((0.0, 0.6), (0.009, 1.0)):
        i = int(off * SR)
        m = n - i
        tt = np.arange(m) / SR
        crack = stft_filter(RNG.standard_normal(m), lambda f, tc: bp_gain(2600, 0.9)(f), 512, 128) * perc(m, 0.0002, 0.012)
        body = sum(a * np.sin(2 * np.pi * fr * tt) * np.exp(-tt / dec) for fr, a, dec in ((212, 0.6, 0.05), (487, 0.4, 0.035), (1130, 0.25, 0.02)))
        y[i:] += g * (norm(crack) + body * 0.8)
    y = norm(y) * gain
    return reverb(np.stack([y, y], 1), 0.6, 0.12)


def sparkle(d=0.9, n_notes=14, f_lo=2200, f_hi=7000):
    """Brillo: racimo ascendente de senos agudos con caídas cortas, paneo alterno."""
    out = np.zeros((int(d * SR) + SR // 2, 2))
    for k in range(n_notes):
        u = k / max(1, n_notes - 1)
        f = f_lo * (f_hi / f_lo) ** (u + RNG.uniform(-0.04, 0.04))
        t0 = u * d * 0.8 + RNG.uniform(0, 0.03)
        tt = T(0.25)
        s = np.sin(2 * np.pi * f * tt) * perc(len(tt), 0.001, 0.05) * 0.12
        place(out, pan(s, (-1) ** k * 0.6), t0)
    return reverb(out, 0.9, 0.25)


def stamp():
    t = T(0.4)
    y = np.sin(2 * np.pi * (70 + 40 * np.exp(-t / 0.02)) * t) * perc(len(t), 0.001, 0.07)
    y += lowpass_static(RNG.standard_normal(len(t)), 3000) * perc(len(t), 0.001, 0.02) * 0.6
    return norm(y) * 0.7


def marker_swipe(d=0.28):
    """Rotulador: ruido 2-5 kHz con modulación de fibra a 32 Hz."""
    n = int(d * SR)
    t = np.arange(n) / SR
    y = stft_filter(RNG.standard_normal(n), lambda f, tc: bp_gain(3400, 1.2)(f), 512, 128)
    y *= (0.6 + 0.4 * np.sin(2 * np.pi * 32 * t)) * np.sin(np.pi * t / d) ** 0.6
    return pan_sweep(norm(y) * 0.25, -0.4, 0.4)


def pencil(d=1.6):
    n = int(d * SR)
    t = np.arange(n) / SR
    am = np.abs(np.sin(2 * np.pi * 6.5 * t)) ** 0.5 * (0.6 + 0.4 * np.sin(2 * np.pi * 47 * t + RNG.uniform(0, 6)))
    y = stft_filter(RNG.standard_normal(n), lambda f, tc: bp_gain(4500, 1.0)(f), 512, 128) * am
    return norm(y) * 0.18


def shutter():
    a = ui_click(2100) * 1.4
    out = np.zeros(int(0.12 * SR))
    out[: len(a)] += a
    i = int(0.045 * SR)
    out[i : i + len(a)] += a * 0.8
    return out


def tape_stop(buf, t0, d=0.5):
    """Frena la mezcla como una cinta: re-muestreo con velocidad 1 -> 0 (cuadrática). Silencio después."""
    i0, n = int(t0 * SR), int(d * SR)
    speed = (1 - np.linspace(0, 1, n)) ** 2
    pos = i0 + np.cumsum(speed)
    for c in range(buf.shape[1]):
        buf[i0 : i0 + n, c] = np.interp(pos, np.arange(len(buf)), buf[:, c]) * np.linspace(1, 0.3, n)
    buf[i0 + n :] = 0
    return buf


def reverb(x, rt=1.2, wet=0.25):
    """Convolución FFT con IR sintética (ruido con decaimiento exponencial), L/R decorrelados."""
    n = int(rt * SR)
    t = np.arange(n) / SR
    ir = RNG.standard_normal((n, 2)) * np.exp(-6.9 * t / rt)[:, None]
    ir[:, 0] = lowpass_static(ir[:, 0], 6000)
    ir[:, 1] = lowpass_static(ir[:, 1], 6000)
    ir /= np.sqrt((ir ** 2).sum(0))
    L = len(x) + n
    out = np.zeros((L, 2))
    for c in range(2):
        out[:, c] = np.fft.irfft(np.fft.rfft(x[:, c], L) * np.fft.rfft(ir[:, c], L), L)
    dry = np.zeros((L, 2))
    dry[: len(x)] = x
    return dry * (1 - wet) + out * wet


# ------------------------------------------------------------------ música
def kick(gain=1.0):
    t = T(0.35)
    f = 48 + 110 * np.exp(-t / 0.03)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * perc(len(t), 0.001, 0.12)
    y[:96] += RNG.standard_normal(96) * 0.15
    return np.tanh(y * 1.6) * 0.6 * gain


def hat(open_=False):
    d = 0.25 if open_ else 0.05
    y = highpass_static(RNG.standard_normal(int(d * SR)), 7000) * perc(int(d * SR), 0.0005, d / 3)
    return y * 0.12


def pluck(midi, d=0.5, bright=0.6):
    f = 440 * 2 ** ((midi - 69) / 12)
    t = T(d)
    y = sum(np.sin(2 * np.pi * f * h * t) * (bright ** (h - 1)) * np.exp(-t * (6 + 4 * h)) for h in range(1, 7))
    return y * 0.18


def pad(midis, d, attack=0.6, cutoff=1800):
    t = T(d)
    y = np.zeros(len(t))
    for m in midis:
        f = 440 * 2 ** ((m - 69) / 12)
        for det in (-0.12, 0.0, 0.12):  # 3 voces desafinadas ±12 cents
            ff = f * 2 ** (det / 12)
            y += sum(np.sin(2 * np.pi * ff * h * t + det * 9) / h for h in range(1, 10) if ff * h < cutoff)
    e = np.minimum(1, t / attack) * np.minimum(1, (d - t) / 0.4)
    return y * e * 0.02


def sidechain(music, voice, depth_db=-8, att=0.03, rel=0.25):
    """Ducking causal: seguidor de envolvente de la voz (a 1 kHz) -> ganancia de la música."""
    v = np.abs(voice).max(1) if voice.ndim > 1 else np.abs(voice)
    hop = SR // 1000
    env = v[: len(v) // hop * hop].reshape(-1, hop).max(1)
    a, r = np.exp(-1 / (att * 1000)), np.exp(-1 / (rel * 1000))
    s, o = 0.0, np.zeros_like(env)
    for i, x in enumerate((env > 0.02).astype(float)):
        s = a * s + (1 - a) * x if x > s else r * s + (1 - r) * x
        o[i] = s
    g = 10 ** (depth_db * np.repeat(o, hop) / 20)
    g = np.concatenate([g, np.ones(len(music) - len(g))])[: len(music)]
    return music * g[:, None]


def master(mix, ceiling=0.93):
    """Saturación suave + limitador de pico simple (look-ahead 5 ms)."""
    y = np.tanh(mix * 1.15) / np.tanh(1.15)
    pk = np.abs(y).max(1)
    la = int(0.005 * SR)
    win = np.lib.stride_tricks.sliding_window_view(np.concatenate([pk, np.zeros(la)]), la + 1).max(1)
    g = np.minimum(1, ceiling / np.maximum(win, 1e-9))
    return y * g[: len(y), None]

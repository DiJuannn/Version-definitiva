"""Banda sonora del ajolote 3D (12,0 s, 120 BPM). Todo sintetizado (numpy + sfxlib), leído de assets/cues.js.
Música: antes del pop solo pad suave y hats que hacen tic-tac; en el pop entra el ritmo (kick, clap, hats, bajo, plucks)
en F–G–Am–C. En ¡ACCIÓN! acorde de metales en Do mayor y el acorde se queda sonando hasta el final.
Uso: python3 audio/build.py  →  assets/audio/banda.wav (48 kHz, estéreo, 24 bit, −14 LUFS)"""
import json, os, re, subprocess, sys
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from sfxlib import *  # noqa
import sfxlib as _sl
def pan(x, p=0.0):  # deja pasar lo que ya es estéreo
    return x if x.ndim == 2 else _sl.pan(x, p)

js = open(os.path.join(HERE, "..", "assets", "cues.js")).read()
H = {k: float(v) for k, v in re.findall(r"(\w+):\s*([\d.]+)", js[js.index("hits:"): js.index("spots:")])}
DUR = 12.0; B = 0.5; N = int((DUR + 2) * SR)
mus = np.zeros((N, 2)); fx = np.zeros((N, 2))
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

def tone(f, d, a=0.004, dec=0.2, kind="sine"):
    t = T(d); ph = 2 * np.pi * np.cumsum(np.full(len(t), f)) / SR if np.isscalar(f) else 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) if kind == "sine" else np.sign(np.sin(ph)) * 0.6 + np.sin(ph) * 0.4
    return y * np.minimum(1, t / a) * np.exp(-t / dec)

def boing(up=True):                       # despegue: seno con glissando y vibrato de muelle
    t = T(0.28); f = (320 if up else 700) * (2.2 if up else 0.5) ** (t / 0.28) * (1 + 0.08 * np.sin(2 * np.pi * 28 * t))
    return tone(f, 0.28, 0.003, 0.12) * 0.32
def pomf():                               # aterrizaje blando
    t = T(0.18); y = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t / 0.05) + 60) / SR) * np.exp(-t / 0.06)
    return y * 0.55 + lowpass_static(RNG.standard_normal(len(t)), 600) * perc(len(t), 0.001, 0.03) * 0.25
def knock():                              # nudillos sobre papel/cristal
    t = T(0.12); y = np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.012) + lowpass_static(RNG.standard_normal(len(t)), 2500) * perc(len(t), 0.0005, 0.01)
    return y * 0.5
def peel(d=0.45):                         # pegatina que se despega: ruido que sube
    n = int(d * SR); x = stft_filter(RNG.standard_normal(n), lambda f, tc: bp_gain(800 * 6 ** np.clip(tc / d, 0, 1), 2.5)(f), 1024, 256)
    return norm(x) * np.linspace(0.2, 1, n) ** 2 * 0.35
def ding(m, d=0.6):                       # glockenspiel
    t = T(d); f = hz(m); y = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.08)) * np.exp(-t / 0.35)
    return y * np.minimum(1, t / 0.002) * 0.28
def thunk():                              # tarjeta que cae en la columna
    t = T(0.14); return (np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.03) + lowpass_static(RNG.standard_normal(len(t)), 1200) * perc(len(t), 0.001, 0.02) * 0.4) * 0.45
def rustle(d=0.35):                       # papel que se dobla
    n = int(d * SR); return highpass_static(RNG.standard_normal(n), 2500) * (0.5 + 0.5 * np.sin(np.linspace(0, 9 * np.pi, n)) ** 2) * np.hanning(n) * 0.18
def zap():                                # panel que se apaga
    t = T(0.3); return tone(900 * 0.2 ** (t / 0.3), 0.3, 0.002, 0.15, "sq") * 0.12
def brass(midis, d=1.6):                  # metales: sierras con filtro que se abre
    t = T(d); y = sum(sum(np.sin(2 * np.pi * hz(m) * k * t + k) / k for k in range(1, 10)) for m in midis)
    y = lowpass_static(y, 2600) * np.minimum(1, t / 0.03) * np.exp(-t / 1.4) / len(midis)
    return np.stack([y, np.roll(y, 200)], 1) * 0.22
def chirp(f0):                            # «¡yay!»
    t = T(0.16); return tone(f0 * 1.6 ** (t / 0.16), 0.16, 0.003, 0.08) * 0.18

# ── música ───────────────────────────────────────────
CH = [[53, 57, 60], [55, 59, 62], [57, 60, 64], [48, 52, 55]]   # F G Am C
ROOT = [41, 43, 45, 36]
def chord(t): return CH[int(t / 2) % 4]
t = 0.0
while t < H["pop"] - 1e-6:                                       # intro: pad + tic-tac
    place(mus, pan(hat(), 0.3), t + 0.25, 0.7); t += 0.5
place(mus, pad([53, 57, 60, 65], 2.4, attack=0.8, cutoff=900), 0.0, 0.7)
t = H["pop"]
while t < H["accion"] - 1e-6:                                    # el ritmo cae en el pop
    k = round(t / B); inbar = k % 4
    place(mus, kick(0.95), t)
    if inbar in (1, 3): place(mus, pan(clapper(0.35), 0.0), t, 0.5)
    place(mus, pan(hat(), 0.35), t + B / 2, 0.8); place(mus, pan(hat(), -0.35), t + B / 4, 0.4); place(mus, pan(hat(), 0.35), t + 3 * B / 4, 0.4)
    tt = T(B * 0.9); bass = sum(np.sin(2 * np.pi * hz(ROOT[int(t / 2) % 4]) * h * tt) / h ** 1.5 for h in range(1, 5)) * np.exp(-tt / 0.35) * 0.18
    place(mus, pan(lowpass_static(bass, 420), 0), t)
    ch = chord(t); place(mus, pan(pluck(ch[k % 3] + 12, 0.35, 0.7), -0.3 + 0.6 * (k % 2)), t + B / 2, 0.8)
    if inbar == 0: place(mus, pad(ch, 2.2, attack=0.2, cutoff=1600), t, 0.5)
    t += B
place(mus, brass([48, 55, 60, 64, 67]), H["accion"], 1.0)        # ¡ACCIÓN!: Do mayor
place(mus, reverb(pan(pad([48, 55, 60, 64, 67, 72], DUR - H["accion"] + 0.5, attack=0.05, cutoff=3000)), 2.2, 0.4), H["accion"], 0.9)
place(mus, kick(1.2), H["accion"]); place(mus, kick(0.8), H["logo"])

# ── efectos (cada uno en su fotograma) ──────────────
for k in ("knock1", "knock2"): place(fx, pan(knock(), -0.3), H[k], 1.0); place(fx, pan(knock(), -0.3), H[k] + 0.11, 0.8)
place(fx, pan(peel(), -0.3), H["peel"], 1.0); place(fx, riser(0.5, 400, 5000), H["peel"], 0.35)
place(fx, pan(pop(0.14, 260, 1800), 0), H["pop"], 1.4); place(fx, boom(1.2), H["pop"], 0.5); place(fx, sparkle(0.8, 12), H["pop"] + 0.03, 0.6)
HOPS = [(2.12, "g1"), (2.62, "g2"), (3.12, "g3"), (4.62, "d1"), (5.12, "d2"), (5.62, "d3"), (7.12, "c1"), (7.62, "c2"), (8.62, "ride")]
for t0, land in HOPS:
    place(fx, pan(boing(), 0.2), t0, 1.0); place(fx, pan(pomf(), 0), H[land], 1.0)
for i, k in enumerate(("g1", "g2", "g3")):                       # desglose: clic + blip
    place(fx, pan(ui_click(2800 + 300 * i), -0.2), H[k] + 0.02, 0.9); place(fx, pan(ding(76 + [0, 2, 4][i], 0.3), 0.2), H[k] + 0.1, 0.8)
for lp, ld in (("leap1", "landPlan"), ("leap2", "landHoja")):    # saltos grandes
    place(fx, pan(boing(), 0), H[lp], 1.1); place(fx, whoosh(0.5, 300, 4500, -0.7, 0.7), H[lp] + 0.02, 0.8); place(fx, pan(pomf(), 0), H[ld], 1.2)
for i, k in enumerate(("d1", "d2", "d3")):                       # escenas que caen en los días: do-mi-sol
    place(fx, pan(thunk(), -0.4 + 0.4 * i), H[k] + 0.05, 1.0); place(fx, pan(ding([72, 76, 79][i]), -0.4 + 0.4 * i), H[k] + 0.1, 1.0)
for j, a in enumerate([H["c1"], H["c1"] + 0.08, H["c2"], H["c2"] + 0.08, H["c2"] + 0.16]):   # avisos ✓
    place(fx, pan(ding(79 + [0, 2, 4, 5, 7][j], 0.4), -0.5 + 0.25 * j), a + 0.05, 0.9)
place(fx, pan(rustle(), 0.4), H["fold"], 1.0); place(fx, pan(pop(0.1, 500, 1100), 0.4), H["fold"] + 0.25, 0.7)
place(fx, whoosh(0.8, 250, 3500, 0.7, -0.4), H["ride"], 0.9); place(fx, pan(boing(), 0), H["rideEnd"], 1.0)
place(fx, clapper(1.0), H["accion"], 1.2); place(fx, boom(1.6), H["accion"], 0.6); place(fx, sparkle(1.0, 14), H["accion"] + 0.05, 0.7)
for i in range(3): place(fx, pan(zap(), -0.5 + 0.5 * i), H["down"] + i * 0.12, 1.0); place(fx, whoosh(0.4, 2000, 300, 0, 0), H["down"] + i * 0.12 + 0.15, 0.4)
for i, f in enumerate((900, 1200, 1500)): place(fx, pan(chirp(f), 0.3), H["wave"] + i * 0.12, 1.0)

mix = (mus * 0.8 + fx * 0.9)[: int(DUR * SR)]
fade = np.ones(len(mix)); f0 = int((DUR - 0.5) * SR); fade[f0:] = np.linspace(1, 0, len(mix) - f0) ** 1.5; mix *= fade[:, None]
out = os.path.join(HERE, "..", "assets", "audio", "banda.wav"); g = 1.0
def lufs(p):
    r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1]), float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])
for it in range(5):
    y = master(mix * g, ceiling=10 ** (-1.5 / 20)); sf.write(out, y, SR, subtype="PCM_24"); I, tp = lufs(out)
    if abs(I + 14) < 0.2: break
    g *= 10 ** ((-14 - I) / 20)
print(json.dumps({"wav": out, "dur": round(len(y) / SR, 3), "LUFS": I, "peak": tp}))

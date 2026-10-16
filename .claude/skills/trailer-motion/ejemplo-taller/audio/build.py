"""Banda sonora del tráiler v2 + cues.js (única fuente de verdad de tiempos).
Rejilla 120 BPM: beat 0,5 s, compás 2 s. Ejecutar: python3 build.py
"""
import json, os, sys
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sfxlib import *

ROOT = os.path.dirname(HERE)
DUR = 65.5
BPM = 120; B = 60 / BPM; BAR = 4 * B
N = int(DUR * SR) + SR

# ---------- voz: una línea por WAV, en su tiempo ----------
VO = [
    ("L01", 0.50), ("L02", 6.50), ("L03", 10.50), ("L04", 13.50), ("L05", 18.50), ("L06", 21.00),
    ("L07", 24.50), ("L08", 29.50), ("L09", 34.50), ("L10", 37.00), ("L11", 41.50), ("L12", 47.00),
    ("L13a", 51.00), ("L13b", 52.90), ("L14", 56.00), ("L15", 58.50), ("L16", 63.50),
]
GAIN = {"L13a": 0.55, "L13b": 1.25}
voice = np.zeros((N, 2)); vo_info = {}
for vid, t in VO:
    w, sr = sf.read(f"{ROOT}/assets/vo/{vid}.wav")
    if w.ndim > 1: w = w.mean(1)
    assert sr == SR, sr
    place(voice, pan(w * GAIN.get(vid, 1.0) * 0.9, 0.0), t)
    vo_info[vid] = {"t": t, "d": round(len(w) / SR, 3)}

# ---------- golpes (visual y sonido leen esto) ----------
H = {
    "ping0": 0.0, "freeze": 5.0, "silence0": 5.5, "kick1": 8.0, "pop": 8.0,
    "title1": 9.0, "scan": 12.0, "fold": 18.0, "redcell": 21.0, "wink": 22.5,
    "title2": 23.0, "mark1": 25.0, "mark2": 26.0, "mark3": 27.5, "stamp": 29.0,
    "whip1": 29.0, "shot1": 30.0, "shot2": 30.5, "shot3": 31.0, "shot4": 31.5,
    "board": 32.5, "whip2": 36.5, "swatch": 38.0, "title3": 40.0, "pings": 44.0,
    "dark": 47.0, "dive": 47.6, "card1": 49.0, "card2": 49.5, "card3": 50.0,
    "clapOpen": 51.0, "silence": 52.0, "clac": 53.5, "drop": 54.0, "rewind": 56.0,
    "logo": 58.5, "button": 62.0, "stinger": 63.5, "miniclac": 65.0,
}

mus = np.zeros((N, 2)); fx = np.zeros((N, 2))
CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G, un acorde por compás

def sub(t, d=0.45, f=55, g=0.5):
    n = int(d * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.18) * g
    place(mus, pan(s, 0), t)

def groove(t0, t1, hats=1, arp=True, gain=1.0):
    t = t0
    while t < t1 - 1e-6:
        k = round((t - t0) / B)
        place(mus, kick(), t, gain)
        place(mus, pan(hat(), 0.3), t + B / 2, 0.8 * gain)
        if hats >= 2:
            place(mus, pan(hat(), -0.3), t + B / 4, 0.5 * gain); place(mus, pan(hat(), 0.3), t + 3 * B / 4, 0.5 * gain)
        if arp:
            ch = CH[int(t / BAR) % 4]
            for j in range(2):
                place(mus, pan(pluck(ch[(k * 2 + j) % 3] + 12), -0.4 + 0.8 * j), t + j * B / 2, 0.7 * gain)
        t += B

def pads(t0, t1, cutoff=1800, gain=1.0, octave=0):
    t = t0
    while t < t1 - 1e-6:
        ch = [m + octave for m in CH[int(t / BAR) % 4]]
        place(mus, pad(ch, min(BAR, t1 - t) + 0.4, attack=0.5, cutoff=cutoff), t, 0.55 * gain)
        place(mus, pad([ch[0] - 12], min(BAR, t1 - t) + 0.4, attack=0.3, cutoff=400), t, 0.6 * gain)
        t += BAR

# --- intro caos 0–5: drone + tic-tac + pings que se aceleran
n = int(5.0 * SR); tt = np.arange(n) / SR
drone = lowpass_static(sum(np.sign(np.sin(2 * np.pi * f * tt)) for f in (55, 55.4, 82.4)) * 0.12, 300)
drone *= np.minimum(1, tt / 1.5)
place(mus, pan(drone, 0), 0.0)
t = 0.25
while t < 5.0:
    place(fx, pan(ui_click(2200), 0.5 if int(t * 4) % 2 else -0.5), t, 0.35); t += B / 2
k = 0
while True:
    tk = 5.0 * (1 - 0.82 ** k)
    if tk >= 4.95: break
    place(fx, pan(ping(1318.5 * 2 ** (min(k, 14) * 40 / 1200)), np.sin(k * 1.7) * 0.8), tk, 0.55)
    k += 1
place(fx, pan(ping(1318.5), 0), H["ping0"], 0.8)
# tape-stop + silencio
mix_pre = mus + fx
tape_stop(mus, H["freeze"], 0.5); tape_stop(fx, H["freeze"], 0.5)
for b in (mus, fx): b[int(5.5 * SR):int(6.5 * SR)] = 0
# ternura 6.5–8: celesta E5 C5 A4 B4
for i, m in enumerate([76, 72, 69, 71]):
    place(mus, pan(pluck(m, 0.9, 0.9), -0.2 + 0.13 * i), 6.5 + i * 0.375, 0.9)
place(fx, pop(), H["pop"], 1.2); place(fx, sparkle(), H["pop"] + 0.05, 0.6)
for p, sgn in ((-0.8, 1), (0.8, -1)):
    place(fx, whoosh(0.5, p0=p, p1=-p), H["pop"] + 0.02, 0.6)

# --- A · orden 8–23
groove(8.0, 23.0, hats=1)
pads(8.0, 23.0, cutoff=1200, gain=0.8)
place(fx, boom(), H["title1"], 0.9)
place(fx, whoosh(0.4, p0=0.6, p1=-0.2), 10.35, 0.7)
place(fx, sparkle(1.4), H["scan"], 0.6)
for i in range(10): place(fx, pan(ui_click(2600 + 120 * i), -0.5 + i * 0.1), 12.6 + i * 0.09, 0.5)
place(fx, whoosh(0.9, f0=400, f1=2500, p0=-0.5, p1=0.5), H["fold"] - 0.1, 0.6)
for i in range(5): place(fx, pan(ui_click(2400), 0.2), 19.0 + i * 0.25, 0.45)
place(fx, pan(pop(0.1, 600, 300), 0.3), H["redcell"], 0.8)
place(fx, sparkle(0.6, 8), H["wink"], 0.5)

# --- B · capa 23–40
place(fx, boom(), H["title2"], 0.95)
groove(23.0, 40.0, hats=1)
groove(32.5, 40.0, hats=2, arp=False, gain=0.6)
pads(23.0, 40.0, cutoff=2500, gain=1.0)
for tm in (H["mark1"], H["mark2"], H["mark3"]): place(fx, marker_swipe(), tm, 0.8)
place(fx, stamp(), H["stamp"], 1.1)
place(fx, whoosh(0.45, p0=-0.2, p1=0.2, f0=300, f1=5000), H["whip1"] - 0.25, 0.9)
for k2 in ("shot1", "shot2", "shot3", "shot4"): place(fx, shutter(), H[k2], 0.8)
place(fx, pencil(1.8), H["board"], 0.7)
place(mus, pad([69, 72, 76, 81], 2.4, attack=1.5, cutoff=3200), H["board"], 0.5)
place(fx, sparkle(1.2), 34.2, 0.5)
place(fx, whoosh(0.45, p0=0.8, p1=-0.8, f0=300, f1=5000), H["whip2"] - 0.25, 0.9)
for i in range(5): place(fx, pan(ping(2093 + 200 * i, 0.5, 0.6), -0.6 + 0.3 * i), H["swatch"] + i * 0.25, 0.4)
place(fx, reverse_cymbal(1.0), 39.0, 0.8)

# --- C · magia 40–47
place(fx, boom(), H["title3"], 0.95)
groove(40.0, 47.0, hats=2)
pads(40.0, 47.0, cutoff=3000, gain=1.1)
t = 40.0
while t < 47.0:
    place(mus, pan(ping(880, 1.2, 0.4), 0), t, 0.35); t += BAR
place(fx, whoosh(0.8, p0=-0.7, p1=0.7, f0=500, f1=3000), 43.2, 0.6)
for i, m in enumerate([81, 84, 88, 93, 96]):  # pings del caos, ahora afinados y a tempo (callback)
    place(fx, pan(ping(440 * 2 ** ((m - 69) / 12)), -0.6 + 0.3 * i), H["pings"] + i * 0.25, 0.6)

# --- build-up 47–52: pulso sub + riser + redoble que acelera
t = 47.0
while t < 52.0 - 1e-6: sub(t, g=0.55); t += B
place(fx, riser(5.0), 47.0, 0.9)
for tm in (H["card1"], H["card2"], H["card3"]): place(fx, boom(1.0), tm, 0.7)
t = 49.0
for div, until in ((2, 50.0), (4, 51.0), (8, 52.0)):
    while t < until - 1e-6:
        place(fx, pan(highpass_static(RNG.standard_normal(2400), 1200) * perc(2400, 0.001, 0.03) * 0.3 * (0.5 + (t - 49) / 3), 0.1), t); t += B / div
# silencio total 52.0–53.5 (salvo la voz)
for b in (mus, fx): b[int(52.0 * SR):int(53.5 * SR)] = 0
place(fx, clapper(), H["clac"], 1.2)

# --- DROP 54–62
place(fx, boom(2.6), H["drop"], 1.0)
groove(54.0, 62.0, hats=2)
pads(54.0, 62.0, cutoff=3500, gain=1.2, octave=0)
for i, m in enumerate([88, 84, 81, 83, 88, 84, 81, 79]):  # motivo una octava arriba
    place(mus, pan(pluck(m, 0.5, 0.8), 0.2 * np.sin(i)), 54.0 + i * 0.5, 0.6)
for i in range(8): place(fx, pan(ui_click(3000), -0.4 + 0.1 * i), 54.25 + i * 0.25, 0.4)
place(fx, whoosh(1.2, f0=4000, f1=300, p0=0.8, p1=-0.8), H["rewind"], 0.8)
place(fx, sparkle(1.4), H["logo"], 0.7)
# final: acorde largo + button
final = pad([57, 64, 69, 71, 72], 3.5, attack=0.05, cutoff=3000)
place(mus, reverb(pan(final, 0), 2.5, 0.4), H["button"], 0.8)
place(fx, boom(2.0), H["button"], 0.6)
place(fx, clapper(0.5), H["miniclac"], 0.5)

music = sidechain(mus * 0.85, voice, depth_db=-8)
mix = music + fx * 0.75 + voice
fade = np.ones(len(mix)); f0 = int((DUR - 0.3) * SR); fade[f0:] = np.linspace(1, 0, len(fade) - f0)
mix = master(mix * fade[:, None] * 0.8)[: int(DUR * SR)]
sf.write(f"{ROOT}/assets/audio/banda.wav", mix, SR)

# envolvente de voz a 30 fps para el lipsync
FPS = 30; hop = SR // FPS; vm = voice.mean(1)
rms = np.array([np.sqrt(np.mean(vm[i * hop:(i + 1) * hop] ** 2)) for i in range(int(DUR * FPS))])
ref = np.percentile(rms[rms > 0.004], 90)
lv = np.clip(np.round(rms / ref * 3), 0, 3).astype(int).tolist()
cues = {"dur": DUR, "bpm": BPM, "beat": B, "hits": H, "vo": vo_info, "env": {"fps": FPS, "lv": lv}}
open(f"{ROOT}/assets/cues.js", "w").write("window.CUES=" + json.dumps(cues) + ";")
print("ok peak", float(np.abs(mix).max()), "rms_db", round(float(20 * np.log10(np.sqrt((mix ** 2).mean()))), 1))

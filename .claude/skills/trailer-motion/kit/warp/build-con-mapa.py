"""Banda sonora del reel «7 OFICIOS. 1 FIRMA.» (JD Molina) + tabla de golpes.

100 % sintetizado con numpy (sfxlib.py del tráiler aprobado). Sin samples. Sin voz.
Rejilla 120 BPM: beat 0,5 s = 15 f a 30 fps, compás 2 s = 60 f. Duración 36,0 s.
Tonalidad: Re menor, i–VI–III–VII (Dm Bb F C), un acorde por compás.

Ejecutar:  python3 build_reel_audio.py [carpeta_salida]
Escribe:   ../assets/audio/banda.wav (48 kHz, estéreo, 24 bit, −14 LUFS) · ../assets/cues.js · cues.json + golpes.tsv (aquí)
           cues.js        window.CUES = {dur, bpm, beat, fps, hits:{nombre: s}, frames:{nombre: f}, sections}
           golpes.tsv     tabla legible: t, fotograma, compás.beat, nombre, SFX
El showrunner sólo toca DUR, H y SECTIONS; todo lo demás cuelga de ahí.
"""
import json, os, subprocess, sys, re
import numpy as np, soundfile as sf

LIB = os.path.dirname(os.path.abspath(__file__))  # sfxlib.py copiado aquí
sys.path.insert(0, LIB)
from sfxlib import *  # noqa: E402,F401  (SR, RNG, place, pan, whoosh, riser, boom, ...)
import sfxlib as _sl
def place(buf, sig, t, gain=1.0):  # t en tiempo de partitura → tiempo real
    return _sl.place(buf, sig, t * K, gain)

OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
os.makedirs(OUT, exist_ok=True)

K = 1.25  # estiramiento v2: la partitura se escribe a 120 BPM y suena a 96 (todo ×1,25)
SCORE_DUR = 36.0
# v3: mapa partitura → tiempo real. Tramos (s0, s1) que suenan a ×K; entre tramos, PAUSA (hold, la imagen se congela)
# o CORTE (se salta partitura). Cortes de pulso entero (0,5 · n) para no perder el groove.
HOLD_JDM = 0.8                                   # el logo JDM se queda 0,8 s más, animado (encuadre que entra y se cierra)
WARP_S = [(0.0, 1.98), (1.98, 5.00), (6.00, SCORE_DUR)]   # v5: corte 5,0–6,0 (ESCRIBO acaba en la portada del guion)
WARP = []; _r = 0.0
for i, (a, b) in enumerate(WARP_S):
    if i == 1: _r += HOLD_JDM
    WARP.append({"s0": a, "s1": b, "r0": round(_r, 6)}); _r += (b - a) * K
DUR = _r
def R(sv):  # tiempo de partitura → tiempo real final
    for w in WARP:
        if sv < w["s1"] + 1e-9 or w is WARP[-1]:
            return w["r0"] + (max(sv, w["s0"]) - w["s0"]) * K
BPM = 120; B = 60 / BPM; BAR = 4 * B; FPS = 30
N = int(DUR * SR) + 2 * SR
TARGET_LUFS = -14.0

# ------------------------------------------------------------------ tabla de golpes (única fuente de verdad)
H = {
    # gancho
    "hook": 0.00, **{f"flash{i+1}": round(i * 0.1, 2) for i in range(6)},
    "oficios": 0.75, "tachon": 1.00, "hookOut": 1.50,
    # 01 escribo
    "escribo": 2.00, "typeStart": 2.25, "typeEnd": 3.875, "iris": 4.00,
    # 02 dirijo
    "dirijo": 6.00, "cutParque": 7.00, "marks": 7.25, "quieta": 9.00,
    # 03 ruedo
    "ruedo": 10.00, "shot1": 10.00, "shot2": 11.00, "shot3": 12.00,
    # 04 monto
    "monto": 13.00, "scrub": 13.25, "corte": 14.00, "lcut": 15.00, "jcut": 16.00, "tapeStop": 16.75,
    # 05 animo
    "animo": 17.00, "keyframe": 17.00, "visor": 17.50, "accion": 19.50, "dropTaller": 19.65,  # v2: caos del tráiler 3,875→, sale el ajolote  # = clac (53,5) y drop (54,0) del tráiler, clip 53,25→ en 18,25
    # 06 produzco
    "produzco": 20.00, "check1": 20.00, "check2": 20.50, "check3": 21.00, "check4": 21.50,
    # 07 programo
    "programo": 22.00, "compila": 22.75, "riser": 23.00, "herramientas": 23.50,
    # build + silencio
    "build": 25.00, "silence": 25.50,
    # clímax: 8 planos a corchea
    "drop": 26.00, **{f"verb{i+1}": 26.00 + i * 0.25 for i in range(8)},
    # colapso + logo
    "collapse": 28.00, "jIn": 29.00, "mIn": 29.25, "dIn": 29.50,
    "logo": 30.00, "rol": 30.25, "cta": 31.50, "button": 34.50, "end": 36.00,
}
BUILD_SECTIONS = [("secA", 0.0, 6.0), ("secB", 6.0, 13.0), ("secC", 13.0, 20.0), ("secD", 20.0, 36.0)]  # slots del root
SECTIONS = [  # beats del guion (nombre, inicio, fin)
    ("gancho", 0.0, 2.0), ("escribo", 2.0, 6.0), ("dirijo", 6.0, 10.0), ("ruedo", 10.0, 13.0),
    ("monto", 13.0, 17.0), ("animo", 17.0, 20.0), ("produzco", 20.0, 22.0), ("programo", 22.0, 25.0),
    ("build", 25.0, 26.0), ("climax", 26.0, 28.0), ("colapso", 28.0, 30.0), ("firma", 30.0, 36.0),
]
SFX = {}  # nombre de golpe -> descripción (para la tabla)
def mark(name, desc):
    SFX[name] = (SFX[name] + " + " + desc) if name in SFX else desc

# ------------------------------------------------------------------ armonía
CH = [[62, 65, 69], [58, 62, 65], [53, 57, 60], [60, 64, 67]]  # Dm Bb F C
ROOT = [38, 34, 41, 36]                                       # D2 Bb1 F2 C2
def chord(t): return CH[int(t / BAR + 1e-6) % 4]
def root(t): return ROOT[int(t / BAR + 1e-6) % 4]
def hz(m): return 440 * 2 ** ((m - 69) / 12)

# ------------------------------------------------------------------ SFX nuevos (sólo numpy, sobre sfxlib)
def key_tap(bright=1.0):
    """Tecla de máquina de escribir: clic agudo + 'thock' de cuerpo a ~180 Hz."""
    t = T(0.06)
    body = np.sin(2 * np.pi * (180 + 60 * np.exp(-t / 0.004)) * t) * perc(len(t), 0.0005, 0.012) * 0.25
    c = ui_click(2600 + RNG.uniform(-300, 300)) * bright
    body[: len(c)] += c
    return body

def cut_tick():
    """Corte de montaje: transitorio seco + 'tic' de cuchilla a 4,2 kHz con cola cortísima."""
    t = T(0.08)
    y = np.sin(2 * np.pi * 4200 * t) * perc(len(t), 0.0003, 0.008) * 0.6
    y += highpass_static(RNG.standard_normal(len(t)), 3000) * perc(len(t), 0.0002, 0.003)
    y += np.sin(2 * np.pi * 95 * t) * perc(len(t), 0.001, 0.02) * 0.5
    return y * 0.45

def scrub(d=0.75, f0=900, f1=2400):
    """Arrastre del cabezal: granos de ruido filtrado cuya densidad y tono suben (timeline scrub)."""
    out = np.zeros(int(d * SR) + 2400)
    t, k = 0.0, 0
    while t < d:
        u = t / d
        g = stft_filter(RNG.standard_normal(1200), lambda f, tc: bp_gain(f0 * (f1 / f0) ** u, 2.0)(f), 256, 64)
        out[int(t * SR):int(t * SR) + 1200] += g * perc(1200, 0.0005, 0.006) * (0.4 + 0.6 * np.sin(np.pi * u))
        t += 0.045 - 0.03 * u + RNG.uniform(0, 0.006); k += 1
    return pan_sweep(norm(out) * 0.3, -0.5, 0.5)

def roll_hit(gain=1.0):
    return highpass_static(RNG.standard_normal(2400), 1200) * perc(2400, 0.001, 0.03) * 0.3 * gain

def tape_stop_seg(buf, t0, d):
    """Frenazo de cinta sólo dentro de [t0, t0+d] y silencio después (para un buffer de sección)."""
    tape_stop(buf, t0, d)
    return buf

def bass(t, d, m, g=1.0):
    tt = T(d)
    f = hz(m)
    y = sum(np.sin(2 * np.pi * f * h * tt) / h ** 1.3 for h in range(1, 6))
    y = lowpass_static(y, 380) * np.minimum(1, tt / 0.01) * np.exp(-tt / 0.6) * np.minimum(1, (d - tt) / 0.03)
    return y * 0.16 * g

# ------------------------------------------------------------------ buses
mus = np.zeros((N, 2)); fx = np.zeros((N, 2))

def groove(buf, t0, t1, kick_on="bar", hats=1, arp=False, bassline=True, gain=1.0):
    """kick_on: None | 'bar' (1 del compás) | 'half' (1 y 3) | 'beat' (cuatro al suelo)."""
    t = t0
    while t < t1 - 1e-6:
        k = round(t / B); inbar = k % 4
        if kick_on == "beat" or (kick_on == "half" and inbar in (0, 2)) or (kick_on == "bar" and inbar == 0):
            place(buf, kick(), t, gain)
        if hats >= 1: place(buf, pan(hat(), 0.3), t + B / 2, 0.8 * gain)
        if hats >= 2:
            place(buf, pan(hat(), -0.3), t + B / 4, 0.5 * gain); place(buf, pan(hat(), 0.3), t + 3 * B / 4, 0.5 * gain)
        if bassline:
            place(buf, pan(bass(t, B * 0.95 * K, root(t) + (12 if inbar == 3 else 0), gain), 0), t)
        if arp:
            ch = chord(t)
            for j in range(2):
                place(buf, pan(pluck(ch[(k * 2 + j) % 3] + 12), -0.4 + 0.8 * j), t + j * B / 2, 0.6 * gain)
        t += B

def pads(buf, t0, t1, cutoff=1800, gain=1.0):
    t = t0
    while t < t1 - 1e-6:
        d = min(BAR, t1 - t)
        place(buf, pad(chord(t), (d + 0.4) * K, attack=0.5, cutoff=cutoff), t, 0.55 * gain)
        place(buf, pad([chord(t)[0] - 12], (d + 0.4) * K, attack=0.3, cutoff=400), t, 0.6 * gain)
        t += BAR

def pulse(buf, t0, t1, gain=1.0):
    """Pulso en negras sin bombo: sub corto en la raíz."""
    t = t0
    while t < t1 - 1e-6:
        tt = T(0.4); s = np.sin(2 * np.pi * hz(root(t)) * tt) * np.exp(-tt / 0.15) * 0.45 * gain
        place(buf, pan(s, 0), t); t += B

# ===== 0 · GANCHO 0–2 =====================================================
place(fx, clapper(1.0), H["hook"], 1.1); mark("hook", "clapper() + boom(2.2)")
place(fx, boom(2.2), H["hook"], 0.95)
for i in range(6):
    place(fx, pan(ui_click(2400 + 300 * i), -0.5 + 0.2 * i), H[f"flash{i+1}"] + 0.02, 0.6); mark(f"flash{i+1}", "ui_click (destello de foto, 3 f)")
place(mus, kick(1.2), H["oficios"]); mark("oficios", "kick")
place(mus, kick(1.2), H["tachon"]); mark("tachon", "kick + marker_swipe")
place(fx, marker_swipe(0.3), H["tachon"], 1.0)
place(fx, whoosh(0.5, f0=300, f1=4500, p0=0.0, p1=0.0), H["hookOut"], 0.8); mark("hookOut", "whoosh(0.5) + riser(0.5)")
place(fx, riser(0.5, 400, 6000), H["hookOut"], 0.5)

# ===== 01 · ESCRIBO 2–6: pad + pulso en negras, sin bombo; teclas a semicorcheas ====
pads(mus, 2.0, 6.0, cutoff=1100, gain=0.8)
pulse(mus, 2.0, 6.0, 0.8); mark("escribo", "entra pad Dm + pulso sub en negras (sin bombo)")
t = H["typeStart"]
while t <= H["typeEnd"] + 1e-6:
    if RNG.uniform() > 0.12:  # alguna pausa humana
        place(fx, pan(key_tap(), RNG.uniform(-0.25, 0.25)), t + RNG.uniform(0, 0.012), 0.55)
    t += B / 4
place(fx, pan(np.sin(2 * np.pi * 1800 * T(0.25)) * perc(int(0.25 * SR), 0.002, 0.07) * 0.2, 0.3), H["typeEnd"] + 0.06, 0.6)  # «ding» de carro
mark("typeStart", "key_tap() a semicorcheas hasta 3,875 + ding de carro")
place(fx, pan(ping(hz(81)), 0), H["iris"], 0.6); mark("iris", "ping(A5) + whoosh suave (iris revela hero.jpg)")
place(fx, whoosh(0.6, f0=200, f1=2500, p0=-0.3, p1=0.3), H["iris"] - 0.25, 0.4)
def page_flick():
    t = T(0.07)
    return highpass_static(RNG.standard_normal(len(t)), 2500) * perc(len(t), 0.002, 0.025) * 0.35
for i in range(5):  # v5: páginas que pasan
    place(fx, pan(page_flick(), -0.3 + 0.15 * i), H["iris"] + 0.12 + i * 0.09, 0.9)
place(fx, pan(stamp() * 0.6, 0), H["iris"] + 0.12 + 5 * 0.09 + 0.1, 0.8); mark("iris", "iris + 5 páginas + golpe de portada")

# ===== 02 · DIRIJO 6–10: bombo en el 1, sube el bajo, lápiz =====
groove(mus, 6.0, 10.0, kick_on="bar", hats=0, bassline=True, gain=0.9)
pads(mus, 6.0, 10.0, cutoff=1500, gain=0.85); mark("dirijo", "corte: kick en el 1 de cada compás + entra el bajo")
place(fx, whoosh(0.35, f0=500, f1=5000, p0=0.6, p1=-0.6), H["cutParque"] - 0.18, 0.5); mark("cutParque", "whoosh corto")
place(fx, pan(ui_click(2600), -0.3), H["dirijo"] + 0.32, 0.6); place(fx, pan(ui_click(3000), 0.3), H["dirijo"] + 0.42, 0.6)  # v5: A y B en la planta
place(fx, pencil(0.35), H["dirijo"] + 0.5, 0.5)
place(fx, pencil(1.6), H["marks"], 0.8); mark("marks", "pencil(1.6) mientras se dibujan marcas")
place(fx, pencil(0.5), H["marks"] + 1.75, 0.6)
place(fx, pan(stamp() * 0.5, 0), H["quieta"], 0.6); mark("quieta", "stamp() suave (cámara quieta)")

# ===== 03 · RUEDO 10–13: groove completo, hats en corcheas, obturador por corte =====
groove(mus, 10.0, 13.0, kick_on="half", hats=1, arp=True, gain=1.0)
pads(mus, 10.0, 13.0, cutoff=2200, gain=0.9)
place(fx, whoosh(0.5, f0=250, f1=4000, p0=-0.8, p1=0.8), H["ruedo"] - 0.3, 0.8); mark("ruedo", "whoosh (giro 90°) + groove completo")
for k in ("shot1", "shot2", "shot3"):
    place(fx, pan(shutter(), 0.15), H[k], 1.1); mark(k, "shutter()")
for i in range(6):  # parpadeo del REC: tic muy bajo en cada negra
    place(fx, pan(ui_click(5200), 0.6), 10.5 + i * 0.5, 0.15)

# ===== 04 · MONTO 13–17: respira; scrub, tic de corte, frenazo de cinta en 16,75 =====
sec = np.zeros_like(mus)
groove(sec, 13.0, 17.0, kick_on="bar", hats=1, arp=False, gain=0.9)
pads(sec, 13.0, 17.0, cutoff=1800, gain=0.8)
tape_stop_seg(sec, H["tapeStop"] * K, 0.25 * K)  # la música de este oficio frena y calla en 17,0
mus += sec
place(fx, scrub(0.7), H["scrub"], 0.8); mark("scrub", "scrub() cabezal corriendo")
for k, lab in (("corte", "CORTE"), ("lcut", "L-CUT"), ("jcut", "J-CUT")):
    place(fx, pan(cut_tick(), 0), H[k], 1.2); mark(k, f"cut_tick() [{lab}]")
place(fx, scrub(0.35, 1400, 700), H["lcut"] + 0.05, 0.4)
place(fx, scrub(0.35, 700, 1400), H["jcut"] - 0.4, 0.4)
mark("tapeStop", "tape_stop(0,25 s) de la música del tramo")

# ===== 05 · ANIMO 17–20: hats dobles; pop del keyframe; clac de «¡ACCIÓN!» re-sintetizado =====
groove(mus, 17.0, 20.0, kick_on="half", hats=2, arp=True, gain=1.0)
pads(mus, 17.0, 20.0, cutoff=2600, gain=1.0)
place(fx, pop(0.12, 300, 1600), H["keyframe"], 1.3); mark("keyframe", "pop() rombo de keyframe + hats dobles")
place(fx, whoosh(0.7, f0=300, f1=3500, p0=-0.6, p1=0.6), H["keyframe"] + 0.1, 0.5)
place(fx, sparkle(0.5, 7), H["visor"], 0.4); mark("visor", "sparkle corto (arranca tráiler a color)")
place(fx, pop(0.14, 250, 1400), H["accion"], 1.2); place(fx, sparkle(0.6, 9), H["accion"] + 0.05, 0.5); mark("accion", "pop + sparkle (sale el ajolote del caos)")
place(fx, boom(1.0), H["dropTaller"], 0.6); mark("dropTaller", "boom(1.0) corto")

# ===== 06 · PRODUZCO 20–22: sello por ✓ =====
groove(mus, 20.0, 22.0, kick_on="beat", hats=1, arp=False, gain=0.9)
pads(mus, 20.0, 22.0, cutoff=2400, gain=0.9)
for i in range(4):
    place(fx, pan(stamp(), -0.3 + 0.2 * i), H[f"check{i+1}"], 1.0); mark(f"check{i+1}", "stamp() ✓")
    place(fx, marker_swipe(0.12), H[f"check{i+1}"] + 0.06, 0.5)

# ===== 07 · PROGRAMO 22–25: teclas rápidas, compila, riser hasta el silencio =====
groove(mus, 22.0, 25.5, kick_on="beat", hats=2, arp=True, gain=1.0)
pads(mus, 22.0, 25.5, cutoff=3000, gain=1.0)
t = 22.0
while t < H["compila"] - 1e-6:
    place(fx, pan(key_tap(1.2), RNG.uniform(-0.3, 0.3)), t + RNG.uniform(0, 0.008), 0.6); t += B / 8
mark("programo", "key_tap() a fusas (código)")
place(fx, sparkle(0.9), H["compila"], 0.7); mark("compila", "sparkle() compila")
place(fx, riser(2.5 * K, 200, 7000), H["riser"], 1.0); mark("riser", "riser(2,5 s) 23,0 → 25,5")
place(fx, pop(0.1, 500, 1200), H["herramientas"], 0.7); mark("herramientas", "pop (sube 06-movil.png)")
# build 25–25,5: redoble que acelera + tics del contador
t = 25.0
for div, until in ((4, 25.25), (8, 25.5)):
    while t < until - 1e-6:
        place(fx, pan(roll_hit(0.8 + (t - 25.0) * 1.6), 0.1), t); t += B / div
for i in range(7):
    place(fx, pan(ui_click(2000 + 250 * i), -0.6 + 0.2 * i), 25.0 + i * (0.5 / 7), 0.5)
mark("build", "redoble 16→32 avos + tic de contador 01..07")
place(fx, reverse_cymbal(0.5 * K), 25.0, 0.6)

# ===== CLÍMAX 26–28: drop, 8 golpes a corchea =====
groove(mus, 26.0, 28.0, kick_on="beat", hats=2, arp=True, gain=1.15)
pads(mus, 26.0, 28.0, cutoff=3800, gain=1.25)
place(fx, boom(2.6), H["drop"], 1.0); mark("drop", "boom(2,6) + kick: DROP")
melody = [74, 77, 81, 79, 77, 74, 72, 74]  # motivo una octava arriba, una nota por verbo
for i in range(8):
    tv = H[f"verb{i+1}"]
    place(mus, kick(0.9), tv) if i % 2 else None
    place(fx, pan(cut_tick(), (-1) ** i * 0.35), tv, 0.9)
    place(mus, pan(pluck(melody[i] + 12, 0.4, 0.85), (-1) ** i * 0.2), tv, 0.7)
    mark(f"verb{i+1}", "cut_tick + nota del motivo" + (" + kick" if i % 2 else ""))

# ===== COLAPSO 28–30 =====
groove(mus, 28.0, 30.0, kick_on="bar", hats=1, arp=False, gain=0.8)
pads(mus, 28.0, 30.0, cutoff=2500, gain=1.0)
place(fx, whoosh(0.9, f0=4000, f1=300, p0=0.0, p1=0.0), H["collapse"], 0.9); mark("collapse", "whoosh(0,9) descendente (las bandas se comprimen)")
place(fx, reverse_cymbal(0.9 * K), H["jIn"] - 0.9, 0.5)
place(mus, kick(1.3), H["jIn"]); mark("jIn", "kick seco (J cierra esquina)")
place(mus, kick(1.3), H["mIn"]); mark("mIn", "kick seco (M cierra esquina)")
place(fx, boom(1.2), H["dIn"], 0.8); mark("dIn", "boom(1,2) corto (cae la D)")

# ===== LOGO + CTA + BUTTON 30–36 =====
resol = pad([50, 62, 65, 69, 76], 4.6 * K, attack=0.05, cutoff=3200)  # Dm(add9) resuelto
place(mus, reverb(pan(resol, 0), 2.5, 0.4), H["logo"], 0.9); mark("logo", "acorde Dm(add9) + ping afinado D6")
place(fx, pan(ping(hz(86)), 0), H["logo"], 0.7)
place(fx, sparkle(1.0, 10), H["logo"] + 0.05, 0.4)
for i in range(16):  # la línea de rol se escribe en mono
    place(fx, pan(key_tap(0.7), 0.2), H["rol"] + i * 0.0625, 0.3)
mark("rol", "key_tap() suave (FILMMAKER & EDITOR · BARCELONA)")
pulse(mus, 31.5, 34.5, 0.5)
pads(mus, 32.0, 34.5, cutoff=1400, gain=0.6)
place(fx, pop(0.1, 400, 900), H["cta"], 0.6); mark("cta", "pop + pad bajo y pulso suave (hold de lectura)")
place(fx, clapper(0.5), H["button"], 0.6); mark("button", "clapper() mini + boom corto")
place(fx, boom(1.4), H["button"], 0.45)
place(mus, reverb(pan(pad([50, 57, 62, 69], 1.6, 0.05, 2500), 0), 1.5, 0.35), H["button"], 0.6)
mark("silence", "SILENCIO TOTAL 25,50–26,00 (15 f, −180 dB)")
mark("end", "fin; cola cortada con fundido de 40 ms")
for k in H: SFX.setdefault(k, "(visual; sin SFX propio)")

# ------------------------------------------------------------------ mezcla
mix = mus * 0.85 + fx * 0.75
s0, s1 = int(H["silence"] * K * SR), int(H["drop"] * K * SR)
mix[s0:s1] = 0                              # silencio duro antes del drop
mix[s0 - 192:s0] *= np.linspace(1, 0, 192)[:, None]  # 4 ms de rampa: corte seco pero sin clic
# --- v3: ediciones de forma de onda (de atrás adelante) sobre la mezcla en tiempo ×K ---
XF = int(0.025 * SR)
def cut(x, a, b):  # quita [a, b) (s reales ×K) con fundido cruzado de 25 ms
    i, j = int(a * SR), int(b * SR)
    w = np.linspace(1, 0, XF)[:, None]
    x[i - XF:i] = x[i - XF:i] * w + x[j - XF:j] * (1 - w)
    return np.concatenate([x[:i], x[j:]])
for a, b in ((5.00, 6.00),):
    mix = cut(mix, a * K, b * K)
hold = np.zeros((int(HOLD_JDM * SR), 2))
place_real = _sl.place
place_real(hold, pan(ping(hz(86)), 0), 0.0, 0.45)                 # la firma suena: ping afinado + golpe grave corto
place_real(hold, boom(1.0), 0.0, 0.35)
place_real(hold, reverb(pan(pad([50, 57, 62], HOLD_JDM + 0.3, attack=0.05, cutoff=1400), 0), 1.2, 0.3), 0.0, 0.35)
place_real(hold, pan(ui_click(3200), -0.4), 0.15, 0.5); place_real(hold, pan(ui_click(3400), 0.4), 0.17, 0.5)  # esquinas del encuadre
place_real(hold, whoosh(0.3, f0=3800, f1=400, p0=0.0, p1=0.0), HOLD_JDM - 0.3, 0.5)   # el encuadre se cierra
place_real(hold, pan(cut_tick(), 0), HOLD_JDM - 0.02, 0.8)                            # corte a ESCRIBO
ip = int(1.98 * K * SR); fo = np.linspace(1, 0, XF)[:, None]
pre = mix[:ip].copy(); pre[-XF:] *= fo
post = mix[ip:].copy(); post[:XF] *= fo[::-1]
mix = np.concatenate([pre, hold, post])
s0, s1 = int(R(H["silence"]) * SR), int(R(H["drop"]) * SR)
mix = mix[: int(DUR * SR)]
fade = np.ones(len(mix)); f0 = int((DUR - 0.04) * SR); fade[f0:] = np.linspace(1, 0, len(mix) - f0)
mix *= fade[:, None]

def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1]); tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])
    lra = float(re.findall(r"LRA:\s+(-?[\d.]+) LU", r)[-1])
    return I, tp, lra

def master_tp(x, ceiling):
    """Saturación suave + limitador de PICO REAL (sobremuestreo 4x por FFT, look-ahead 5 ms, ganancia suavizada)."""
    y = np.tanh(x * 1.15) / np.tanh(1.15)
    L = len(y); env = np.zeros(L)
    for c in range(y.shape[1]):
        X = np.fft.rfft(y[:, c]); u = np.fft.irfft(np.concatenate([X, np.zeros(3 * len(X) - 3)]), 4 * L) * 4
        env = np.maximum(env, np.abs(u).reshape(L, 4).max(1))
    la = int(0.005 * SR)
    g = np.minimum(1, ceiling / np.maximum(env, 1e-9))
    gp = np.concatenate([np.ones(la), g, np.ones(la)])
    gmin = np.lib.stride_tricks.sliding_window_view(gp, 2 * la + 1).min(1)   # mínimo centrado ±la
    k = np.ones(la) / la
    gs = np.convolve(np.concatenate([gmin, np.ones(la)]), k, mode="full")[la: la + L]  # media móvil: rampa de 5 ms
    gs = np.minimum(gs, gmin[:L] if len(gmin) >= L else gs)
    return y * gs[:, None]

# master a −14 LUFS: ganancia lineal + saturación suave + limitador (techo −1,2 dBFS), iterado
os.makedirs(f"{OUT}/audio", exist_ok=True); wav = f"{OUT}/audio/banda.wav"; g = 1.0
for it in range(5):
    y = master_tp(mix * g, ceiling=10 ** (-1.5 / 20)); y[s0:s1] = 0
    sf.write(wav, y, SR, subtype="PCM_24")
    I, tp, lra = lufs(wav)
    if abs(I - TARGET_LUFS) < 0.15: break
    g *= 10 ** ((TARGET_LUFS - I) / 20)

# ------------------------------------------------------------------ cues.js + tabla
frames = {k: int(np.floor(v * FPS + 1e-6)) for k, v in H.items()}  # suelo: la imagen nunca va detrás del sonido
cues = {"dur": SCORE_DUR, "K": K, "realDur": round(DUR, 6), "warp": WARP, "bpm": BPM, "beat": B, "fps": FPS, "hits": H, "frames": frames,
        "sections": [{"id": n, "start": a, "end": b, "dur": round(b - a, 3)} for n, a, b in BUILD_SECTIONS],
        "beats": [{"id": n, "start": a, "end": b} for n, a, b in SECTIONS]}
open(f"{OUT}/cues.js", "w").write("window.CUES=" + json.dumps(cues) + ";\n")
json.dump(cues, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cues.json"), "w"), indent=1)
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "golpes.tsv"), "w") as f:
    f.write("t_s\tframe\tcompas_beat\tgolpe\tsonido\n")
    for k, v in sorted(H.items(), key=lambda kv: (kv[1], kv[0])):
        bar, beat = int(v // BAR) + 1, (v % BAR) / B + 1
        f.write(f"{v:.3f}\t{frames[k]}\tc{bar} b{beat:.2f}\t{k}\t{SFX[k]}\n")

# ------------------------------------------------------------------ verificación
sil = y[s0 + 10: s1 - 10]
sil_db = -180.0 if not np.any(sil) else float(20 * np.log10(np.abs(sil).max()))
bad = []
for k in ("oficios", "tachon", "iris", "shot1", "shot2", "shot3", "corte", "lcut", "jcut", "keyframe", "accion",
          "check1", "check2", "check3", "check4", "drop", "jIn", "mIn", "dIn", "logo", "button"):
    i = int(R(H[k]) * SR); a = np.sqrt(np.mean(y[max(0, i - 960):i] ** 2) + 1e-12); b = np.sqrt(np.mean(y[i:i + 960] ** 2) + 1e-12)
    if 20 * np.log10(b / a) < 2.0: bad.append((k, round(float(20 * np.log10(b / a)), 1)))
print(json.dumps({"wav": wav, "dur_s": round(len(y) / SR, 3), "LUFS_I": I, "truePeak_dBFS": tp, "LRA": lra,
                  "silence_25.5-26.0_dB": sil_db, "onsets_debiles(<2dB)": bad, "iter": it + 1}, ensure_ascii=False))

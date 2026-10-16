#!/usr/bin/env bash
# Genera una línea de voz con Kokoro (local) y la pasa por el filtro "voz 2" (pitch +20 %, tempo compensado, silencios recortados).
# Uso: kit/tts/voz.sh "texto" salida.wav [velocidad=1.0] [voz=ef_dora]
# Requiere: pip install kokoro-onnx soundfile ; kokoro.onnx y voices.bin junto a say.py (ver SKILL.md §5.1)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TXT="$1"; OUT="$2"; SP="${3:-1.0}"; VOICE="${4:-ef_dora}"
TMP="$(mktemp --suffix=.wav)"
(cd "$DIR" && python3 say.py "$TXT" "$VOICE" "$TMP" "$SP") </dev/null >/dev/null
ffmpeg -nostdin -v error -i "$TMP" -af "asetrate=24000*1.2,aresample=48000,atempo=0.86,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse" -y "$OUT" </dev/null
rm -f "$TMP"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"

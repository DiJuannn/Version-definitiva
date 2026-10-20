#!/usr/bin/env bash
# Hoja de contactos de un vídeo: un fotograma en cada tiempo indicado, en una rejilla.
# Uso: hoja-contactos.sh video.mp4 "0.5 2 4.5 7 10" salida.jpg [columnas=5] [ancho=320]
set -euo pipefail
V=$1; T=$2; OUT=$3; COLS=${4:-5}; W=${5:-320}
TMP=$(mktemp -d); i=0
for t in $T; do ffmpeg -nostdin -v error -ss "$t" -i "$V" -frames:v 1 -vf "scale=$W:-1,drawtext=text='$t s':fontcolor=yellow:fontsize=18:x=6:y=6:box=1:boxcolor=black@0.6" -y "$TMP/$(printf %03d $i).png"; i=$((i+1)); done
ffmpeg -nostdin -v error -framerate 1 -i "$TMP/%03d.png" -vf "tile=${COLS}x$(( (i+COLS-1)/COLS ))" -frames:v 1 -y "$OUT"
rm -rf "$TMP"; echo "$OUT ($i fotogramas)"

#!/usr/bin/env bash
# Fotogramas CONSECUTIVOS alrededor de una transición rápida (donde un agente de solo texto no ve los fallos).
# Uso: tira-transicion.sh video.mp4 inicio_s n_fotogramas salida.jpg
set -euo pipefail
ffmpeg -nostdin -v error -ss "$2" -i "$1" -frames:v "$3" -vf "scale=300:-1,tile=${3}x1" -y "$4" && echo "$4"

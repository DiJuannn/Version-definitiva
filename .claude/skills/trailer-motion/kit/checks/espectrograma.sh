#!/usr/bin/env bash
# Espectrograma para ver si los graves son un muro (motor/808 tapando el kick) o si falta el hueco del slow-mo.
# Uso: espectrograma.sh audio_o_video salida.png
ffmpeg -nostdin -v error -i "$1" -lavfi "showspectrumpic=s=1600x600:legend=1:scale=log:fscale=log" -y "$2" && echo "$2"

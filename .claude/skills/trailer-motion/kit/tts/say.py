import sys, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("kokoro.onnx", "voices.bin")
text, voice, out = sys.argv[1], sys.argv[2], sys.argv[3]
speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
samples, sr = k.create(text, voice=voice, speed=speed, lang="es")
sf.write(out, samples, sr)
print(out, len(samples)/sr)

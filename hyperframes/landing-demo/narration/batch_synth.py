"""Batch-synthesize per-scene narration with Kokoro, single model load."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import kokoro_onnx
import soundfile as sf

CACHE = Path.home() / ".cache" / "hyperframes" / "tts"
model_path = CACHE / "models" / "kokoro-v1.0.onnx"
voices_path = CACHE / "voices" / "voices-v1.0.bin"
voice = "af_heart"
speed = 1.0
out_dir = Path(__file__).parent

lines_path = out_dir / "lines.txt"
lines = [ln.strip() for ln in lines_path.read_text().splitlines() if ln.strip()]

model = kokoro_onnx.Kokoro(str(model_path), str(voices_path))

results = []
for i, text in enumerate(lines, start=1):
    samples, sample_rate = model.create(text, voice=voice, speed=speed)
    out_path = out_dir / f"s{i:02d}.wav"
    sf.write(out_path, samples, sample_rate)
    duration = len(samples) / sample_rate
    results.append({"scene": i, "file": out_path.name, "duration": round(duration, 3)})

print(json.dumps(results, indent=2))

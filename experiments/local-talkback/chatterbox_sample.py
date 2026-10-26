"""Generate one local Chatterbox sample; never access a microphone or speaker."""
import os
import argparse
from pathlib import Path
import sys
import time
import wave

root = Path(__file__).resolve().parents[2] / '.skelly-build' / 'local-talkback'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=root.parent / 'voice-comparison-chatterbox.wav')
target = parser.parse_args().output.resolve()
if not target.is_relative_to(root.parent.resolve()) or target.suffix.lower() != '.wav':
    parser.error('Output must be a WAV under .skelly-build.')
os.environ['HF_HOME'] = str(root / 'chatterbox-cache')
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['XDG_CACHE_HOME'] = str(root / 'chatterbox-cache')
os.environ['NUMBA_CACHE_DIR'] = str(root / 'chatterbox-cache' / 'numba')
Path(os.environ['NUMBA_CACHE_DIR']).mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(root / 'chatterbox-5de7a54aa4e5e2baadb0182dde554908b48b85c2' / 'src'))
import numpy as np
import torch
from chatterbox.tts_turbo import ChatterboxTurboTTS

torch.set_num_threads(4)
started = time.monotonic()
model = ChatterboxTurboTTS.from_local(root / 'chatterbox-model', device='cpu', nano=True)
print('Model loaded in', round(time.monotonic() - started, 2), 'seconds', flush=True)
parts = []
for text in ('Why did the ghost wear glasses?', 'To improve its spook tacles! [chuckle]'):
    began = time.monotonic()
    with torch.inference_mode():
        audio = model.generate(text).squeeze().numpy()
    if audio.ndim != 1 or not len(audio) or not np.isfinite(audio).all():
        raise ValueError('Invalid sample')
    print('Segment synthesis:', round(time.monotonic() - began, 2), 'seconds; audio:',
          round(len(audio) / model.sr, 2), 'seconds', flush=True)
    parts.append(audio)
combined = np.concatenate([parts[0], np.zeros(round(model.sr * .7), dtype=np.float32), parts[1]])
if len(combined) > model.sr * 8:
    raise ValueError('Sample exceeds eight seconds; no audio was truncated')
samples = (np.clip(combined, -1, 1) * 32767).astype('<i2')
with wave.open(str(target), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(model.sr)
    output.writeframes(samples.tobytes())
print('Generated a bounded sample without recording or playback:', target, flush=True)

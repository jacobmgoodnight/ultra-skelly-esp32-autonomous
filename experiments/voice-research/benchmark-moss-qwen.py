"""Try the synthetic Qwen demo voice as a local MOSS reference, without visitor data."""
import json
import os
import sys
import time
from pathlib import Path

root = Path('.').resolve()
base = root / '.skelly-build/voice-research/moss'
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HOME'] = str(base / 'hf-cache')
sys.path.insert(0, str(base / 'MOSS-TTS-Nano-8b7bcc9341b3b4ef3a3a58ba1338a7d85ff133eb'))
sys.path.insert(0, str(root / 'experiments/local-talkback'))
sys.path.append(str(root / '.skelly-build/local-talkback/chatterbox-env/Lib/site-packages'))
import numpy as np
import psutil
import soundfile as sf
from scipy.signal import resample_poly
from onnx_tts_runtime import OnnxTtsRuntime
from replies import REPLIES
from voice import validate_reply_wave

if psutil.virtual_memory().available < 4 * 1024**3:
    raise SystemExit('Not started: fewer than 4 GiB of available system memory.')
psutil.Process().nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
samples = root / '.skelly-build/voice-research/samples'
source, source_rate = sf.read(samples / 'qwen-demo-spooky-2.wav', dtype='float64')
if source_rate != 24000 or source.ndim != 1 or not np.isfinite(source).all():
    raise ValueError('Unexpected synthetic reference format.')
reference = resample_poly(source, 147, 160)
peak = float(np.max(np.abs(reference)))
if not len(reference) or len(reference) > 8 * 22050 or peak == 0:
    raise ValueError('Synthetic reference is empty or exceeds the reply bound.')
reference *= min(1, 0.95 / peak)
reference_path = base / 'out/qwen-synthetic-reference.wav'
sf.write(reference_path, reference, 22050, subtype='PCM_16')
validate_reply_wave(reference_path.read_bytes())

started = time.perf_counter()
tts = OnnxTtsRuntime(model_dir=base / 'models', thread_count=4, max_new_frames=150, output_dir=base / 'out')
load_seconds = time.perf_counter() - started
print('MOSS model loaded; generating one approved introduction.', flush=True)
start = time.perf_counter()
raw = base / 'out/moss-qwen-reference-intro-48000.wav'
result = tts.synthesize(text=REPLIES[9][0], output_audio_path=raw, prompt_audio_path=reference_path,
                        enable_wetext=False, streaming=True, seed=1, max_new_frames=150)
elapsed = time.perf_counter() - start
audio, rate = sf.read(raw, dtype='float64')
if rate != 48000 or audio.ndim != 2 or audio.shape[1] != 2 or not np.isfinite(audio).all():
    raise ValueError('Unexpected MOSS output.')
frames = int(result['audio_token_ids'].shape[0])
mono = resample_poly(np.mean(audio, axis=1), 147, 320)
if not len(mono) or len(mono) > 22050 * 8 or np.max(np.abs(mono)) > 1 or frames >= 150:
    raise ValueError('Audio exceeds limits or may be incomplete.')
output = samples / 'moss-qwen-reference-intro.wav'
sf.write(output, mono, 22050, subtype='PCM_16')
validate_reply_wave(output.read_bytes())
metrics = {'load_seconds': round(load_seconds, 3), 'synthesis_seconds': round(elapsed, 3),
           'working_set_mib': round(psutil.Process().memory_info().rss / 1048576, 1),
           'audio_seconds': round(len(mono) / 22050, 3), 'generated_frames': frames,
           'reference': 'synthetic Qwen theatrical ghost joke', 'output': str(output)}
(base / 'out/moss-qwen-reference-metrics.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
print(json.dumps(metrics), flush=True)

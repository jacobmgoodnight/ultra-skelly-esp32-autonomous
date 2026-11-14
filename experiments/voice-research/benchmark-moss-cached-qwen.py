"""Measure local MOSS with one in-memory encoding of a synthetic reference."""
import argparse
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
process = psutil.Process()
process.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
samples = root / '.skelly-build/voice-research/samples'
parser = argparse.ArgumentParser()
parser.add_argument('--self-reference', action='store_true',
                    help='Use the synthetic MOSS introduction as the reference.')
args = parser.parse_args()
reference = (samples / 'moss-qwen-reference-intro.wav' if args.self_reference
             else base / 'out/qwen-synthetic-reference.wav')
prefix = 'moss-self-cached' if args.self_reference else 'moss-qwen-cached'
validate_reply_wave(reference.read_bytes())
start = time.perf_counter()
tts = OnnxTtsRuntime(model_dir=base / 'models', thread_count=4, max_new_frames=150, output_dir=base / 'out')
load_seconds = time.perf_counter() - start
start = time.perf_counter()
codes = tts.encode_reference_audio(reference)
reference_seconds = time.perf_counter() - start
if not codes:
    raise ValueError('Synthetic reference produced no audio codes.')

# The research wrapper ordinarily encodes the reference each time. Only this
# fixed synthetic reference is accepted; the codes live in this process only.
def cached_reference(*, voice, prompt_audio_path):
    if voice is not None or Path(prompt_audio_path).resolve() != reference.resolve():
        raise ValueError('Unexpected voice reference.')
    return codes

tts.resolve_prompt_audio_codes = cached_reference
print('Loaded local model and encoded the fixed synthetic reference once.', flush=True)
metrics = {'reference_kind': 'synthetic MOSS introduction' if args.self_reference else 'synthetic Qwen joke',
           'load_seconds': round(load_seconds, 3), 'reference_encode_seconds': round(reference_seconds, 3), 'samples': []}
phrases = (('ghost', REPLIES[3][1]), ('skeleton', REPLIES[2][0])) if args.self_reference else (
    ('intro', REPLIES[9][0]), ('ghost', REPLIES[3][1]), ('skeleton', REPLIES[2][0]))
for key, text in phrases:
    raw = base / 'out' / f'{prefix}-{key}-48000.wav'
    start = time.perf_counter()
    result = tts.synthesize(text=text, output_audio_path=raw, prompt_audio_path=reference,
                            enable_wetext=False, streaming=True, seed=1, max_new_frames=150)
    elapsed = time.perf_counter() - start
    # Use the returned floating-point waveform: the upstream scratch WAV is
    # clipped to full scale before writing and cannot recover those peaks.
    audio = np.asarray(result['waveform'], dtype=np.float64)
    rate = int(result['sample_rate'])
    if rate != 48000 or audio.ndim != 2 or audio.shape[1] != 2 or not np.isfinite(audio).all():
        raise ValueError('Unexpected MOSS output.')
    frames = int(result['audio_token_ids'].shape[0])
    mono = resample_poly(np.mean(audio, axis=1), 147, 320)
    if not len(mono) or len(mono) > 22050 * 8 or frames >= 150:
        raise ValueError('Audio exceeds limits or may be incomplete.')
    peak = float(np.max(np.abs(mono)))
    if peak <= 0:
        raise ValueError('Audio contains no signal.')
    gain = min(1, 0.95 / peak)
    mono *= gain
    out = samples / f'{prefix}-{key}.wav'
    sf.write(out, mono, 22050, subtype='PCM_16')
    validate_reply_wave(out.read_bytes())
    row = {'phrase': key, 'synthesis_seconds': round(elapsed, 3),
           'audio_seconds': round(len(mono) / 22050, 3), 'frames': frames,
           'working_set_mib': round(process.memory_info().rss / 1048576, 1),
           'peak_before_gain': round(peak, 4), 'gain': round(gain, 4)}
    metrics['samples'].append(row)
    print(json.dumps(row), flush=True)
(base / 'out' / f'{prefix}-metrics.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')

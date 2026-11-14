import hashlib
import json
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import psutil
import soundfile as sf
from scipy.signal import resample_poly

root = Path('.').resolve()
work = root / '.skelly-build/voice-research'
expected = 'b14b1da8a018aa4db6ca8cbb927c32590bfc889b49116ea344c56e8351d94279'
if hashlib.sha256((work / 'helper.py').read_bytes()).hexdigest() != expected:
    raise ValueError('Downloaded inference source does not match the recorded hash')
sys.path.insert(0, str(work))
sys.path.insert(0, str(root / 'experiments/local-talkback'))
import helper
from companion import TOOLS
from replies import REPLIES
from voice import LocalVoice, validate_reply_wave

phrases = [REPLIES[3][1], REPLIES[2][0], REPLIES[9][0]]
process = psutil.Process()
load_start = time.perf_counter()
tts = helper.load_text_to_speech(str(work / 'assets/onnx'))
style = helper.load_voice_style([str(work / 'assets/voice_styles/M1.json')])
load = time.perf_counter() - load_start
out = work / 'samples'
out.mkdir(exist_ok=True)
metrics = {'load_seconds': load, 'source_rate': tts.sample_rate, 'samples': []}
voice = LocalVoice(TOOLS)
if not voice.neural: raise RuntimeError('Piper Joe is missing')
for i, phrase in enumerate(phrases):
    started = time.perf_counter(); cpu_start = time.process_time()
    audio, duration = tts(phrase, 'en', style, 8, 1.05)
    elapsed, cpu = time.perf_counter()-started, time.process_time()-cpu_start
    samples = np.asarray(audio[0, :int(tts.sample_rate * duration[0])], dtype=np.float64)
    if not np.isfinite(samples).all() or len(samples) == 0: raise ValueError('Invalid audio')
    samples = resample_poly(samples, 1, 2)
    if tts.sample_rate != 44100 or len(samples) > 22050 * 8 or np.max(np.abs(samples)) > 1:
        raise ValueError('Unexpected sample rate, oversized audio, or clipping')
    sample_path = out / f'supertonic-{i+1}.wav'
    sf.write(sample_path, samples, 22050, subtype='PCM_16')
    validate_reply_wave(sample_path.read_bytes())
    with tempfile.TemporaryDirectory() as tmp:
        start_piper = time.perf_counter(); piper = voice.synthesize(phrase, tmp); piper_time = time.perf_counter()-start_piper
    (out / f'piper-{i+1}.wav').write_bytes(piper)
    metrics['samples'].append({'text': phrase, 'supertonic_seconds': round(elapsed,3), 'supertonic_cpu_seconds': round(cpu,3), 'output_seconds': round(len(samples)/22050,3), 'piper_seconds': round(piper_time,3), 'working_set_mib': round(process.memory_info().rss/1048576,1)})
    print(json.dumps(metrics['samples'][-1]), flush=True)
(out / 'metrics.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
print('Model load seconds:', round(load,3), flush=True)

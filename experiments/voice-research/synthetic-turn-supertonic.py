"""Time a synthetic local turn. Never opens a microphone or plays audio."""
import hashlib
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

root = Path('.').resolve()
work = root / '.skelly-build/voice-research'
expected = 'b14b1da8a018aa4db6ca8cbb927c32590bfc889b49116ea344c56e8351d94279'
if hashlib.sha256((work / 'helper.py').read_bytes()).hexdigest() != expected:
    raise ValueError('Downloaded inference source does not match the recorded hash')
sys.path.insert(0, str(work)); sys.path.insert(0, str(root / 'experiments/local-talkback'))
import helper
from companion import Engines, approved_reply, literal_topic, validate_wave
from replies import ReplyDeck
from voice import validate_reply_wave

tts = helper.load_text_to_speech(str(work / 'assets/onnx'))
style = helper.load_voice_style([str(work / 'assets/voice_styles/M1.json')])
engine = Engines()
if not engine.whisper: raise RuntimeError('Whisper runtime is missing')
with tempfile.TemporaryDirectory() as folder:
    tmp = Path(folder)
    spoken = engine.voice.synthesize('Tell me a ghost joke.', tmp)
    (tmp / 'synthetic-source.wav').write_bytes(spoken)
    input_samples, input_rate = sf.read(tmp / 'synthetic-source.wav', dtype='float64')
    if input_rate != 22050: raise ValueError('Expected Piper 22.05 kHz')
    sf.write(tmp / 'input.wav', resample_poly(input_samples, 320, 441), 16000, subtype='PCM_16')
    validate_wave((tmp / 'input.wav').read_bytes())
    start = time.perf_counter()
    subprocess.run([str(engine.whisper), '-m', str(root / '.skelly-build/local-talkback/ggml-tiny.en.bin'),
                    '-f', str(tmp / 'input.wav'), '-l', 'en', '-t', '4', '-nt', '-np', '-otxt',
                    '-of', str(tmp / 'recognized')], check=True, timeout=20,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    recognized = time.perf_counter()
    transcript = (tmp / 'recognized.txt').read_text(encoding='utf-8').strip()[:500]
    if literal_topic(transcript) != 3: raise ValueError('Synthetic ghost topic was not recognized')
    result = engine.choose(transcript)  # Recognized literal topic avoids the Qwen endpoint.
    card, text = approved_reply(transcript, result, ReplyDeck(), include_name=False)
    selected = time.perf_counter()
    wav, duration = tts(text, 'en', style, 8, 1.05)
    samples = np.asarray(wav[0, :int(tts.sample_rate * duration[0])], dtype=np.float64)
    if tts.sample_rate != 44100 or not len(samples) or not np.isfinite(samples).all(): raise ValueError('Invalid sample')
    samples = resample_poly(samples, 1, 2)
    if len(samples) > 22050 * 8 or np.max(np.abs(samples)) > 1: raise ValueError('Oversized or clipping audio')
    sf.write(tmp / 'reply.wav', samples, 22050, subtype='PCM_16')
    validate_reply_wave((tmp / 'reply.wav').read_bytes())
    end = time.perf_counter()
    print(json.dumps({'recognition_seconds': round(recognized-start, 3),
        'selection_seconds': round(selected-recognized, 3), 'synthesis_and_validation_seconds': round(end-selected, 3),
        'input_complete_to_reply_ready_seconds': round(end-start, 3), 'card': card,
        'synthetic_input': transcript, 'approved_reply': text}, indent=2))

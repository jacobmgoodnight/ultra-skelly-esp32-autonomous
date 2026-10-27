"""Time three synthetic, name-free direct-topic turns with cached MOSS reference."""
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import psutil
import soundfile as sf
from scipy.signal import resample_poly

root = Path('.').resolve()
base = root / '.skelly-build/voice-research/moss'
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HOME'] = str(base / 'hf-cache')
sys.path.insert(0, str(base / 'MOSS-TTS-Nano-8b7bcc9341b3b4ef3a3a58ba1338a7d85ff133eb'))
sys.path.insert(0, str(root / 'experiments/local-talkback'))
sys.path.append(str(root / '.skelly-build/local-talkback/chatterbox-env/Lib/site-packages'))
from onnx_tts_runtime import OnnxTtsRuntime
from companion import Engines, approved_reply, literal_topic, validate_wave
from replies import ReplyDeck
from voice import validate_reply_wave

if psutil.virtual_memory().available < 4 * 1024**3:
    raise SystemExit('Not started: fewer than 4 GiB of available system memory.')
psutil.Process().nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
engine = Engines()
reference = base / 'out/qwen-synthetic-reference.wav'
validate_reply_wave(reference.read_bytes())
start = time.perf_counter()
tts = OnnxTtsRuntime(model_dir=base / 'models', thread_count=4, max_new_frames=150, output_dir=base / 'out')
codes = tts.encode_reference_audio(reference)
if not codes:
    raise ValueError('No synthetic reference codes.')
load_seconds = time.perf_counter() - start

def cached_reference(*, voice, prompt_audio_path):
    if voice is not None or Path(prompt_audio_path).resolve() != reference.resolve():
        raise ValueError('Unexpected voice reference.')
    return codes

tts.resolve_prompt_audio_codes = cached_reference
print('Loaded MOSS and prepared the fixed synthetic reference.', flush=True)
rows = []
deck = ReplyDeck()
with tempfile.TemporaryDirectory() as folder:
    tmp = Path(folder)
    for index, (phrase, expected_card) in enumerate((('Tell me a ghost joke.', 3),
                                                       ('Tell me a skeleton joke.', 2),
                                                       ('Tell me a pumpkin joke.', 6)), 1):
        spoken = engine.voice.synthesize(phrase, tmp)
        src = tmp / f'piper-{index}.wav'
        src.write_bytes(spoken)
        input_samples, input_rate = sf.read(src, dtype='float64')
        if input_rate != 22050 or input_samples.ndim != 1:
            raise ValueError('Expected mono Piper input.')
        input_path = tmp / f'input-{index}.wav'
        sf.write(input_path, resample_poly(input_samples, 320, 441), 16000, subtype='PCM_16')
        validate_wave(input_path.read_bytes())
        begin = time.perf_counter()
        output_base = tmp / f'recognized-{index}'
        subprocess.run([str(engine.whisper), '-m', str(root / '.skelly-build/local-talkback/ggml-tiny.en.bin'),
                        '-f', str(input_path), '-l', 'en', '-t', '4', '-nt', '-np', '-otxt',
                        '-of', str(output_base)], check=True, timeout=20,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       creationflags=subprocess.CREATE_NO_WINDOW)
        recognized_at = time.perf_counter()
        transcript = output_base.with_suffix('.txt').read_text(encoding='utf-8').strip()[:500]
        row = {'expected': phrase, 'recognized': transcript,
               'recognition_seconds': round(recognized_at - begin, 3)}
        if literal_topic(transcript) != expected_card:
            row['status'] = 'direct topic not recognized; synthesis not run'
            rows.append(row)
            print(json.dumps(row), flush=True)
            continue
        card, text = approved_reply(transcript, engine.choose(transcript), deck, include_name=False)
        selected_at = time.perf_counter()
        result = tts.synthesize(text=text, output_audio_path=tmp / f'raw-{index}.wav',
                                prompt_audio_path=reference, enable_wetext=False,
                                streaming=True, seed=1, max_new_frames=150)
        synth_at = time.perf_counter()
        audio = np.asarray(result['waveform'], dtype=np.float64)
        rate = int(result['sample_rate'])
        frames = int(result['audio_token_ids'].shape[0])
        if rate != 48000 or audio.ndim != 2 or audio.shape[1] != 2 or not np.isfinite(audio).all() or frames >= 150:
            raise ValueError('Unexpected or potentially incomplete audio.')
        mono = resample_poly(np.mean(audio, axis=1), 147, 320)
        if not len(mono) or len(mono) > 22050 * 8:
            raise ValueError('Output duration exceeds the current reply bound.')
        peak = float(np.max(np.abs(mono)))
        if not peak:
            raise ValueError('No output signal.')
        mono *= min(1, 0.95 / peak)
        output = tmp / f'reply-{index}.wav'
        sf.write(output, mono, 22050, subtype='PCM_16')
        validate_reply_wave(output.read_bytes())
        done = time.perf_counter()
        row.update({'status': 'validated', 'card': card, 'approved_reply': text,
                    'selection_seconds': round(selected_at - recognized_at, 3),
                    'synthesis_seconds': round(synth_at - selected_at, 3),
                    'input_complete_to_ready_seconds': round(done - begin, 3),
                    'audio_seconds': round(len(mono) / 22050, 3),
                    'within_synthesis_limit': synth_at - selected_at <= 10})
        rows.append(row)
        print(json.dumps(row), flush=True)
metrics = {'load_and_reference_seconds': round(load_seconds, 3), 'turns': rows}
(base / 'out/moss-synthetic-turn-matrix.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')

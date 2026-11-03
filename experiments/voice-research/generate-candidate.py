"""Generate one unreviewed catalog performance using the local Qwen Base research setup."""
import argparse
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import psutil
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'experiments/local-talkback'))
from recordings import catalog_text
from review_library import DEFAULT_LIBRARY, stage
from recordings import Library

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('topic', type=int); parser.add_argument('variant', type=int)
parser.add_argument('--reference', required=True, type=Path, help='Existing synthetic reference WAV; never visitor audio')
parser.add_argument('--reference-text', required=True, type=Path, help='Exact words in the synthetic reference')
parser.add_argument('--voice', required=True); parser.add_argument('--delivery', required=True)
args = parser.parse_args()
phrase = catalog_text(args.topic, args.variant)
research = ROOT / '.skelly-build/voice-research'
exe = research / 'qwentts-ninja/qwen-tts.exe'
models = research / 'qwen-design-models'
model = models / 'qwen-talker-1.7b-base-Q4_K_M.gguf'
codec = models / 'qwen-tokenizer-12hz-Q4_K_M.gguf'
for file in (exe, model, codec, args.reference, args.reference_text):
    if not file.is_file():
        raise SystemExit('Missing research executable, model, or synthetic reference: ' + str(file))
if psutil.virtual_memory().available < 4.5 * 1024**3:
    raise SystemExit('Not started: fewer than 4.5 GiB available memory.')
output_dir = research / 'candidates'
output_dir.mkdir(parents=True, exist_ok=True)
raw = output_dir / f'{args.topic}-{args.variant}-raw.wav'
wav = output_dir / f'{args.topic}-{args.variant}.wav'
log = output_dir / f'{args.topic}-{args.variant}.log'
raw.unlink(missing_ok=True); wav.unlink(missing_ok=True)
command = [str(exe), '--model', str(model), '--codec', str(codec), '--device', 'CPU',
           '--ref-wav', str(args.reference), '--ref-text', str(args.reference_text), '--lang', 'English',
           '--seed', '42', '--max-new', '120', '--format', 'wav16', '-o', str(raw)]
started = time.monotonic()
with log.open('wb') as stream:
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=stream, stderr=subprocess.STDOUT,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0) | getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0))
    try:
        process.stdin.write(phrase.encode('utf-8')); process.stdin.close()
        low = 0
        while process.poll() is None:
            low = low + 1 if psutil.virtual_memory().available < 1.25 * 1024**3 else 0
            if low >= 3 or time.monotonic() - started > 200:
                raise TimeoutError('Generation stopped by the memory or time guard.')
            time.sleep(.1)
    finally:
        if process.poll() is None:
            process.kill(); process.wait()
if process.returncode or '[Pipeline] EOS at step' not in log.read_text(encoding='utf-8', errors='replace') or not raw.is_file():
    raise SystemExit('Incomplete generation; candidate not staged. Inspect the local log.')
audio, rate = sf.read(raw, dtype='float64')
if rate != 24000 or audio.ndim != 1 or not 0 < len(audio) <= 24000 * 8 or not np.isfinite(audio).all():
    raise SystemExit('Incompatible generated audio; candidate not staged.')
audio = resample_poly(audio, 147, 160)
peak = float(np.max(np.abs(audio)))
if peak < 1e-5:
    raise SystemExit('Silent generation; candidate not staged.')
sf.write(wav, audio * min(1, .95 / peak), 22050, subtype='PCM_16')
entry = stage(Library(DEFAULT_LIBRARY), args.topic, args.variant, wav, args.voice, args.delivery)
print(f"Unreviewed candidate {args.topic}/{args.variant}; {time.monotonic() - started:.2f}s; SHA-256 {entry['audio_sha256']}")
print(f'Expected: {phrase}\nListen to the entire staged WAV before approving it.')

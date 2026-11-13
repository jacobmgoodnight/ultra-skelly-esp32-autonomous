"""Bounded offline Qwen Base comparison using only a synthetic reference."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import time
import wave
import numpy as np
import psutil
import soundfile as sf
from scipy.signal import resample_poly

root = Path('.skelly-build/voice-research')
exe = root / 'qwentts-ninja/qwen-tts.exe'
models = root / 'qwen-design-models'
samples = root / 'samples'
parser = argparse.ArgumentParser()
parser.add_argument('--large-moss-reference', action='store_true',
                    help='Test 1.7B Base with the locally generated MOSS introduction.')
parser.add_argument('--ghost-only', action='store_true',
                    help='Generate only the ghost joke for the larger MOSS-reference test.')
args = parser.parse_args()
if args.ghost_only and not args.large_moss_reference:
    parser.error('--ghost-only requires --large-moss-reference')
if psutil.virtual_memory().available < 4.5 * 1024**3:
    raise SystemExit('Not started: fewer than 4.5 GiB of available system memory.')
if args.large_moss_reference:
    source, rate = sf.read(samples / 'moss-qwen-reference-intro.wav', dtype='float64')
    if rate != 22050 or source.ndim != 1 or not len(source) or not np.isfinite(source).all():
        raise ValueError('Invalid synthetic MOSS reference.')
    audio = resample_poly(source, 160, 147)
    peak = float(np.max(np.abs(audio)))
    if not peak or len(audio) > 24000 * 8:
        raise ValueError('Synthetic reference is empty or too long.')
    reference = samples / 'moss-intro-reference-24k.wav'
    sf.write(reference, audio * min(1, 0.95 / peak), 24000, subtype='PCM_16')
    transcript = root / 'moss-intro-reference.txt'
    transcript.write_text('I am Skelly, the friendly skeleton. Chief officer of silly Halloween jokes!', encoding='utf-8')
    model = models / 'qwen-talker-1.7b-base-Q4_K_M.gguf'
    if args.ghost_only:
        tasks = [('large-moss-ghost', 'Why did the ghost wear glasses? To improve its spook tacles!', True)]
        metrics_path = root / 'qwen-large-moss-ghost-metrics.json'
    else:
        tasks = [('large-moss-skeleton', 'Why did the skeleton skip the party? He had no body to go with!', True)]
        metrics_path = root / 'qwen-large-moss-clone-metrics.json'
else:
    reference = samples / 'qwen-demo-spooky-2.wav'
    transcript = root / 'qwen-theatrical-reference.txt'
    transcript.write_text('Why did the ghost wear glasses? To improve its spook tacles!', encoding='utf-8')
    model = models / 'qwen-talker-0.6b-base-Q4_K_M.gguf'
    tasks = [
        ('xvector-intro', 'I am Skelly, the friendly skeleton. Chief officer of silly Halloween jokes!', False),
        ('icl-intro', 'I am Skelly, the friendly skeleton. Chief officer of silly Halloween jokes!', True),
        ('icl-skeleton', 'Why did the skeleton skip the party? He had no body to go with!', True),
    ]
    metrics_path = root / 'qwen-clone-metrics.json'
metrics = []
for name, phrase, use_transcript in tasks:
    if psutil.virtual_memory().available < 4.5 * 1024**3:
        print('Stopped before next sample: fewer than 4.5 GiB available.', flush=True)
        break
    output = samples / f'qwen-clone-{name}-raw.wav'
    log = root / f'qwen-clone-{name}.log'
    command = [str(exe), '--model', str(model),
               '--codec', str(models / 'qwen-tokenizer-12hz-Q4_K_M.gguf'), '--device', 'CPU',
               '--ref-wav', str(reference), '--lang', 'English', '--seed', '42',
               '--max-new', '120', '--format', 'wav16', '-o', str(output)]
    if use_transcript:
        command.extend(['--ref-text', str(transcript)])
    started = time.monotonic()
    peak = 0
    min_free = psutil.virtual_memory().available
    low_count = 0
    reason = None
    with log.open('wb') as f:
        proc = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=f, stderr=subprocess.STDOUT,
                                creationflags=subprocess.CREATE_NO_WINDOW | subprocess.BELOW_NORMAL_PRIORITY_CLASS)
        proc.stdin.write(phrase.encode('utf-8'))
        proc.stdin.close()
        child = psutil.Process(proc.pid)
        while proc.poll() is None:
            free = psutil.virtual_memory().available
            min_free = min(min_free, free)
            try:
                peak = max(peak, child.memory_info().rss)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
            low_count = low_count + 1 if free < 1.25 * 1024**3 else 0
            if low_count >= 3:
                reason = 'memory guard'
            elif time.monotonic() - started > 200:
                reason = '200-second timeout'
            if reason:
                proc.kill()
                proc.wait()
                break
            time.sleep(0.1)
    text = log.read_text(encoding='utf-8', errors='replace')
    match = re.search(r'\[Perf\] Total ([\d.]+) ms', text)
    row = {'name': name, 'process_seconds': round(time.monotonic() - started, 3),
           'pipeline_seconds': round(float(match.group(1)) / 1000, 3) if match else None,
           'working_set_peak_mib': round(peak / 1024**2), 'minimum_available_mib': round(min_free / 1024**2),
           'exit_code': proc.returncode, 'stop_reason': reason, 'eos_seen': '[Pipeline] EOS at step' in text}
    if proc.returncode == 0 and output.is_file():
        with wave.open(str(output), 'rb') as wav:
            row['wav'] = {'rate': wav.getframerate(), 'channels': wav.getnchannels(),
                          'sample_width': wav.getsampwidth(), 'seconds': round(wav.getnframes() / wav.getframerate(), 3)}
        with output.open('rb') as source:
            row['sha256'] = hashlib.file_digest(source, 'sha256').hexdigest()
    metrics.append(row)
    print(json.dumps(row), flush=True)
    if reason:
        break
metrics_path.write_text(json.dumps(metrics, indent=2), encoding='utf-8')

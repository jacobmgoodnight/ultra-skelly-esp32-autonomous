"""Compare a pre-encoded synthetic MOSS reference with the existing Qwen run."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import time
import wave
import psutil

root = Path('.skelly-build/voice-research').resolve()
models = root / 'qwen-design-models'
reference = root / 'samples/moss-intro-reference-24k.wav'
transcript = root / 'moss-intro-reference.txt'
cache = root / 'qwen-synthetic-cache'
cache.mkdir(exist_ok=True)
wav = cache / 'synthetic-moss-intro.wav'
shutil.copyfile(reference, wav)
speaker, codes = wav.with_suffix('.spk'), wav.with_suffix('.rvq')
output = root / 'samples/qwen-large-moss-cached-skeleton-raw.wav'

def run_bounded(name, command, text=None):
    if psutil.virtual_memory().available < 4.5 * 1024**3:
        raise RuntimeError('Not started: fewer than 4.5 GiB of available memory.')
    log = root / f'{name}.log'
    start = time.monotonic()
    low_count, peak, minimum, reason = 0, 0, psutil.virtual_memory().available, None
    with log.open('wb') as f:
        proc = subprocess.Popen(command, stdin=subprocess.PIPE if text else subprocess.DEVNULL,
                                stdout=f, stderr=subprocess.STDOUT,
                                creationflags=subprocess.CREATE_NO_WINDOW | subprocess.BELOW_NORMAL_PRIORITY_CLASS)
        if text:
            proc.stdin.write(text.encode('utf-8'))
            proc.stdin.close()
        child = psutil.Process(proc.pid)
        while proc.poll() is None:
            free = psutil.virtual_memory().available
            minimum = min(minimum, free)
            try:
                peak = max(peak, child.memory_info().rss)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
            low_count = low_count + 1 if free < 1.25 * 1024**3 else 0
            if low_count >= 3:
                reason = 'memory guard'
            elif time.monotonic() - start > 200:
                reason = '200-second limit'
            if reason:
                proc.kill()
                proc.wait()
                break
            time.sleep(0.1)
    contents = log.read_text(encoding='utf-8', errors='replace')
    match = re.search(r'\[Perf\] Total ([\d.]+) ms', contents)
    row = {'name': name, 'process_seconds': round(time.monotonic() - start, 3),
           'pipeline_seconds': round(float(match.group(1)) / 1000, 3) if match else None,
           'peak_working_set_mib': round(peak / 1024**2), 'min_available_mib': round(minimum / 1024**2),
           'exit_code': proc.returncode, 'stop_reason': reason,
           'eos_seen': '[Pipeline] EOS at step' in contents}
    print(json.dumps(row), flush=True)
    if proc.returncode != 0 or reason:
        raise RuntimeError('Bounded research process did not complete: ' + name)
    return row

codec = root / 'qwentts-ninja/qwen-codec.exe'
tts = root / 'qwentts-ninja/qwen-tts.exe'
talker = models / 'qwen-talker-1.7b-base-Q4_K_M.gguf'
tokenizer = models / 'qwen-tokenizer-12hz-Q4_K_M.gguf'
print('Extracting codes from the fixed, synthetic reference.', flush=True)
extraction = run_bounded('qwen-cached-extraction', [str(codec), '--model', str(tokenizer),
                                                    '--talker', str(talker), '--device', 'CPU', '-i', str(wav)])
if not speaker.is_file() or not codes.is_file() or not speaker.stat().st_size or not codes.stat().st_size:
    raise RuntimeError('Synthetic reference encoding did not produce both files.')
print('Generating one fixed approved joke from the cached synthetic reference.', flush=True)
generation = run_bounded('qwen-cached-generation', [str(tts), '--model', str(talker), '--codec', str(tokenizer),
    '--device', 'CPU', '--ref-spk', str(speaker), '--ref-rvq', str(codes), '--ref-text', str(transcript),
    '--lang', 'English', '--seed', '42', '--max-new', '120', '--format', 'wav16', '-o', str(output)],
    'Why did the skeleton skip the party? He had no body to go with!')
if not generation['eos_seen'] or not output.is_file():
    raise RuntimeError('Generation did not report completion.')
with wave.open(str(output), 'rb') as wf:
    generation['wav'] = {'rate': wf.getframerate(), 'channels': wf.getnchannels(),
                         'width': wf.getsampwidth(), 'seconds': round(wf.getnframes() / wf.getframerate(), 3)}
baseline = root / 'samples/qwen-clone-large-moss-skeleton-raw.wav'
generation['byte_identical_to_baseline'] = hashlib.sha256(output.read_bytes()).digest() == hashlib.sha256(baseline.read_bytes()).digest()
(root / 'qwen-cached-moss-metrics.json').write_text(json.dumps({'extraction': extraction, 'generation': generation}, indent=2), encoding='utf-8')
print('Reference-output equality:', generation['byte_identical_to_baseline'], flush=True)

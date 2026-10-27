"""One isolated, resource-bounded, fixed-text CPU voice-design preview."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import sys
import time
import wave
import psutil

root = Path('.skelly-build/voice-research')
exe = root / 'qwentts-ninja/qwen-tts.exe'
models = root / 'qwen-design-models'
parser = argparse.ArgumentParser()
parser.add_argument('--style', choices=('baseline', 'spooky', 'playful', 'raspy', 'phantom'), default='baseline')
args = parser.parse_args()
stem = 'qwen-spooky-1' if args.style == 'baseline' else f'qwen-design-{args.style}-intro'
output = root / 'samples' / f'{stem}-raw.wav'
log = root / f'{stem}.log'
metrics_path = root / f'{stem}-metrics.json'
phrase = ('Why did the ghost wear glasses? To improve its spook tacles!' if args.style == 'baseline'
          else 'I am Skelly, the friendly skeleton. Chief officer of silly Halloween jokes!')
directions = {
    'baseline': ('A deep resonant raspy male voice for a theatrical Halloween skeleton, '
                 'mischievous and playfully sinister, with suspenseful pauses and a gleeful '
                 'punchline; clear American English, spooky but family friendly.'),
    'spooky': ('An adult male Halloween skeleton with a deep, dry, hollow, slightly raspy voice, '
               'clear American English, haunting but playful and family friendly, '
               'with measured theatrical storytelling and a mischievous grin.'),
    'playful': ('A lively animated male skeleton with a low, resonant gravelly voice, '
                'spooky and mischievous, slyly humorous, clear expressive American English, '
                'theatrical pauses and exaggerated surprise, family friendly.'),
    'raspy': ('A low-pitched adult male Halloween skeleton with a dry, slightly raspy voice '
              'and spooky playful energy, clear American English, theatrical storytelling, '
              'sly humor and gentle warmth; family friendly.'),
    'phantom': ('A deep hollow adult male skeletal ghost voice with a gravelly whisper at the edges, '
                'eerie and mysterious but mischievous and friendly, clear American English '
                'with expressive dramatic pauses; a family-friendly Halloween story character.'),
}
direction = directions[args.style]
start_free = psutil.virtual_memory().available
if start_free < 4.5 * 1024**3:
    raise SystemExit('Preview not started: less than 4.5 GiB of available system memory.')
if not exe.is_file() or not models.is_dir():
    raise SystemExit('The experimental CPU executable or model directory is missing; see the research README.')
command = [str(exe), '--model', str(models / 'qwen-talker-1.7b-voicedesign-Q4_K_M.gguf'),
           '--codec', str(models / 'qwen-tokenizer-12hz-Q4_K_M.gguf'), '--device', 'CPU',
           '--instruct', direction, '--lang', 'English', '--seed', '42', '--max-new', '120',
           '--format', 'wav16', '-o', str(output)]
start = time.monotonic()
peak = 0
min_free = start_free
low_count = 0
stop_reason = None
cpu_seconds = None
print('Starting one local CPU preview; five-minute and memory bounds are active.', flush=True)
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
            times = child.cpu_times()
            cpu_seconds = times.user + times.system
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
        low_count = low_count + 1 if free < 1.25 * 1024**3 else 0
        if low_count >= 3:
            stop_reason = 'stopped to preserve available memory'
        elif time.monotonic() - start > 300:
            stop_reason = 'stopped at the five-minute preview limit'
        if stop_reason:
            proc.kill()
            proc.wait()
            break
        time.sleep(0.1)
elapsed = time.monotonic() - start
result = {'elapsed_s': round(elapsed, 2), 'peak_working_set_mib': round(peak / 1024**2),
          'min_available_mib': round(min_free / 1024**2), 'cpu_seconds': cpu_seconds,
          'exit_code': proc.returncode, 'stop_reason': stop_reason, 'direction': direction,
          'phrase': phrase, 'eos_seen': '[Pipeline] EOS at step' in log.read_text(encoding='utf-8', errors='replace')}
if proc.returncode == 0 and output.exists():
    with wave.open(str(output), 'rb') as wav:
        result['wav'] = {'channels': wav.getnchannels(), 'sample_width_bytes': wav.getsampwidth(),
                         'sample_rate': wav.getframerate(),
                         'duration_s': round(wav.getnframes() / wav.getframerate(), 3)}
    with output.open('rb') as stream:
        result['sha256'] = hashlib.file_digest(stream, 'sha256').hexdigest()
metrics_path.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result), flush=True)
sys.exit(0 if proc.returncode == 0 and 'wav' in result and result['eos_seen'] else 1)

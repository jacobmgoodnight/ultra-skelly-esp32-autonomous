"""One isolated, resource-bounded, fixed-text CPU voice-design preview."""
from pathlib import Path
import json
import subprocess
import sys
import time
import wave
import psutil

root = Path('.skelly-build/voice-research')
exe = root / 'qwentts-ninja/qwen-tts.exe'
models = root / 'qwen-design-models'
output = root / 'samples/qwen-spooky-1-raw.wav'
log = root / 'qwen-spooky-1.log'
metrics_path = root / 'qwen-spooky-1-metrics.json'
phrase = 'Why did the ghost wear glasses? To improve its spook tacles!'
direction = ('A deep resonant raspy male voice for a theatrical Halloween skeleton, '
             'mischievous and playfully sinister, with suspenseful pauses and a gleeful '
             'punchline; clear American English, spooky but family friendly.')
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
          'phrase': phrase}
if proc.returncode == 0 and output.exists():
    with wave.open(str(output), 'rb') as wav:
        result['wav'] = {'channels': wav.getnchannels(), 'sample_width_bytes': wav.getsampwidth(),
                         'sample_rate': wav.getframerate(),
                         'duration_s': round(wav.getnframes() / wav.getframerate(), 3)}
metrics_path.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result), flush=True)
sys.exit(0 if proc.returncode == 0 and 'wav' in result else 1)

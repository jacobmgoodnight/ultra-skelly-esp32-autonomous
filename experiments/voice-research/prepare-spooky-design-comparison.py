"""Compare two designed synthetic voices against the liked MOSS introduction."""
import hashlib
import html
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

root = Path('.').resolve()
research = root / '.skelly-build/voice-research'
samples = research / 'samples'
sys.path.insert(0, str(root / 'experiments/local-talkback'))
from voice import validate_reply_wave

sources = [('moss', 'MOSS introduction you liked', 'moss-qwen-reference-intro.wav')]
for key, label in (('spooky', 'Designed voice A · deep and hollow requested'),
                   ('playful', 'Designed voice B · lively and gravelly requested'),
                   ('raspy', 'Designed voice C · dry and raspy requested'),
                   ('phantom', 'Designed voice D · deep and whispery requested')):
    stem = f'qwen-design-{key}-intro'
    metrics_path = research / f'{stem}-metrics.json'
    if key in ('raspy', 'phantom') and not metrics_path.is_file():
        continue
    row = json.loads(metrics_path.read_text(encoding='utf-8'))
    raw = samples / f'{stem}-raw.wav'
    if (row.get('exit_code') != 0 or not row.get('eos_seen') or
            hashlib.sha256(raw.read_bytes()).hexdigest() != row.get('sha256')):
        raise ValueError(f'Generation was incomplete or its WAV changed: {key}')
    sources.append((key, label, raw.name))
items = []
for key, label, filename in sources:
    audio, rate = sf.read(samples / filename, dtype='float64')
    if audio.ndim != 1 or not len(audio) or not np.isfinite(audio).all():
        raise ValueError(f'Invalid audio: {filename}')
    if rate == 24000:
        audio = resample_poly(audio, 147, 160)
    elif rate != 22050:
        raise ValueError(f'Unexpected sample rate: {filename}')
    if len(audio) > 22050 * 8:
        raise ValueError(f'Audio exceeds current duration bound: {filename}')
    rms, peak = float(np.sqrt(np.mean(audio * audio))), float(np.max(np.abs(audio)))
    if rms < 1e-5 or peak <= 0:
        raise ValueError(f'No audible signal: {filename}')
    items.append((key, label, audio, rms, peak))
target = min(min(item[3] for item in items), min(item[3] * 0.95 / item[4] for item in items))
labels = []
for key, label, audio, rms, _ in items:
    output = samples / f'spooky-design-comparison-{key}.wav'
    sf.write(output, audio * (target / rms), 22050, subtype='PCM_16')
    validate_reply_wave(output.read_bytes())
    labels.append(f'<label>{html.escape(label)}<audio controls preload="none" src="{output.name}"></audio></label>')

page = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skelly spooky character designs</title>
<style>body{font:18px system-ui;background:#171324;color:#f8f4ff;max-width:58rem;margin:auto;padding:1.5rem}
section{padding:1rem;margin:1rem 0;border:1px solid #a491ca;border-radius:.7rem}
label{display:block;margin:1rem 0}audio{display:block;width:min(100%,34rem);margin-top:.4rem}</style>
<h1>Spookier skeleton voice designs</h1>
<p>Start at low volume. Each sample uses the same introduction. The labels
describe the requested voices, not guaranteed results. Average levels were
matched by turning louder recordings down.</p>
<p>Both new designs were generated locally from fictional descriptions, without
visitor recordings. An automatic speech check had trouble with one name; listen
to the actual words before any use around children. The page only plays saved
files; it does not open the microphone or connect to Skelly.</p>
<section><h2>Same introduction</h2>
<p>I am Skelly, the friendly skeleton. Chief officer of silly Halloween jokes!</p>'''
page += ''.join(labels) + '</section></html>'
(samples / 'compare-spooky-designs.html').write_text(page, encoding='utf-8')
print(f'Prepared {len(labels)} validated, matched-level previews.')

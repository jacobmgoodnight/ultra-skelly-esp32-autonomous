"""Prepare a focused comparison from existing synthetic local voice clips."""
import hashlib
import html
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

root = Path('.').resolve()
samples = root / '.skelly-build/voice-research/samples'
sys.path.insert(0, str(root / 'experiments/local-talkback'))
from voice import validate_reply_wave

metrics = json.loads((root / '.skelly-build/voice-research/qwen-large-moss-clone-metrics.json').read_text(encoding='utf-8'))
matches = [row for row in metrics if row.get('name') == 'large-moss-skeleton']
raw = samples / 'qwen-clone-large-moss-skeleton-raw.wav'
if (len(matches) != 1 or matches[0].get('exit_code') != 0 or not matches[0].get('eos_seen')
        or hashlib.sha256(raw.read_bytes()).hexdigest() != matches[0].get('sha256')):
    raise ValueError('The large-model generation was incomplete or its WAV hash changed.')
sources = [
    ('reference', 'Liked MOSS voice · introduction', 'moss-qwen-reference-intro.wav'),
    ('moss', 'MOSS original reference · skeleton joke', 'moss-qwen-cached-skeleton.wav'),
    ('large', 'Larger local Qwen matching MOSS · skeleton joke', raw.name),
]
ghost_metrics = root / '.skelly-build/voice-research/qwen-large-moss-ghost-metrics.json'
if ghost_metrics.is_file():
    ghost_rows = json.loads(ghost_metrics.read_text(encoding='utf-8'))
    ghost = [row for row in ghost_rows if row.get('name') == 'large-moss-ghost']
    ghost_raw = samples / 'qwen-clone-large-moss-ghost-raw.wav'
    if (len(ghost) != 1 or ghost[0].get('exit_code') != 0 or not ghost[0].get('eos_seen')
            or hashlib.sha256(ghost_raw.read_bytes()).hexdigest() != ghost[0].get('sha256')):
        raise ValueError('The large-model ghost joke was incomplete or its WAV hash changed.')
    sources.extend([
        ('mossghost', 'MOSS original reference · ghost joke', 'moss-qwen-cached-ghost.wav'),
        ('largeghost', 'Larger local Qwen matching MOSS · ghost joke', ghost_raw.name),
    ])
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
    output = samples / f'qwen-large-moss-comparison-{key}.wav'
    sf.write(output, audio * (target / rms), 22050, subtype='PCM_16')
    validate_reply_wave(output.read_bytes())
    labels.append(f'<label>{html.escape(label)}<audio controls preload="none" src="{output.name}"></audio></label>')

page = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skelly character consistency</title>
<style>body{font:18px system-ui;background:#171324;color:#f8f4ff;max-width:58rem;margin:auto;padding:1.5rem}
section{padding:1rem;margin:1rem 0;border:1px solid #a491ca;border-radius:.7rem}
label{display:block;margin:1rem 0}audio{display:block;width:min(100%,34rem);margin-top:.4rem}</style>
<h1>Can the liked MOSS character stay consistent?</h1>
<p>Start at low volume. Listen to the introduction, then compare the two versions
of the skeleton joke. The larger local Qwen model was asked to match the
introduction's voice. Average levels were matched by turning louder clips down.</p>
<p>The reference was the locally generated fictional MOSS introduction, not a
visitor's recording. These are previews; listen to the actual words before use
around children. This page only plays saved files; it does not open the microphone
or connect to Skelly.</p><section><h2>Reference character</h2>
<p>I am Skelly, the friendly skeleton. Chief officer of silly Halloween jokes!</p>'''
page += labels[0] + '</section><section><h2>Same skeleton joke</h2>'
page += '<p>Why did the skeleton skip the party? He had no body to go with!</p>'
page += ''.join(labels[1:3]) + '</section>'
if len(labels) > 3:
    page += '<section><h2>Same ghost joke</h2>'
    page += '<p>Why did the ghost wear glasses? To improve its spook tacles!</p>'
    page += ''.join(labels[3:]) + '</section>'
page += '</html>'
(samples / 'compare-qwen-large-moss.html').write_text(page, encoding='utf-8')
print(f'Prepared {len(labels)} validated, matched-level previews.')

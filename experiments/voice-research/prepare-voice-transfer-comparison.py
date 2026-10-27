"""Compare the synthetic theatrical reference with local introductory clips."""
import html
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

root = Path('.').resolve()
samples = root / '.skelly-build/voice-research/samples'
sys.path.insert(0, str(root / 'experiments/local-talkback'))
from voice import validate_reply_wave

sources = [
    ('qwen', 'Qwen theatrical reference · ghost joke', 'qwen-comparison-qwen2.wav'),
    ('mossqwen', 'MOSS using the synthetic Qwen reference · introduction', 'moss-qwen-reference-intro.wav'),
]
cached_samples = [
    ('mossghost', 'MOSS original reference · ghost joke', 'moss-qwen-cached-ghost.wav'),
    ('mossskeleton', 'MOSS original reference · skeleton joke', 'moss-qwen-cached-skeleton.wav'),
]
if all((samples / source[2]).is_file() for source in cached_samples):
    sources.extend(cached_samples)
self_samples = [
    ('selfghost', 'MOSS self-reference · ghost joke', 'moss-self-cached-ghost.wav'),
    ('selfskeleton', 'MOSS self-reference · skeleton joke', 'moss-self-cached-skeleton.wav'),
]
if len(sources) == 4 and all((samples / source[2]).is_file() for source in self_samples):
    sources.extend(self_samples)
items = []
for key, label, name in sources:
    audio, rate = sf.read(samples / name, dtype='float64')
    if rate != 22050 or audio.ndim != 1 or not len(audio) or len(audio) > 8 * rate or not np.isfinite(audio).all():
        raise ValueError(f'Invalid bounded mono preview: {name}')
    rms = float(np.sqrt(np.mean(audio * audio)))
    peak = float(np.max(np.abs(audio)))
    if rms < 1e-5 or peak == 0:
        raise ValueError(f'No audible signal: {name}')
    items.append((key, label, audio, rms, peak))
target = min(min(x[3] for x in items), min(x[3] * 0.95 / x[4] for x in items))
labels = []
for key, label, audio, rms, _ in items:
    out = samples / f'transfer-comparison-{key}.wav'
    sf.write(out, audio * (target / rms), 22050, subtype='PCM_16')
    validate_reply_wave(out.read_bytes())
    labels.append(f'<label>{html.escape(label)}<audio controls preload="none" src="{out.name}"></audio></label>')

page = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skelly character voice transfer</title>
<style>body{font:18px system-ui;background:#171324;color:#f8f4ff;max-width:58rem;margin:auto;padding:1.5rem}
section{padding:1rem;margin:1rem 0;border:1px solid #a491ca;border-radius:.7rem}
label{display:block;margin:1rem 0}audio{display:block;width:min(100%,34rem);margin-top:.4rem}</style>
<h1>Can a local voice keep Skelly's character?</h1>
<p>Start at low volume. Compare the Qwen ghost joke with the local MOSS samples,
then listen to the introduction. Average levels were matched by turning louder
clips down.</p>
<p>The voice reference is a synthetic sample from Qwen's public demo, not a
visitor's recording. The optional MOSS self-reference uses its own locally
generated introduction instead. These are previews;
listen to the actual words before any use around children. This page only plays
saved files; it does not open the microphone or connect to Skelly.</p>
<section><h2>Reference voice</h2>
<p>Why did the ghost wear glasses? To improve its spook tacles!</p>'''
page += labels[0] + (labels[2] if len(labels) > 2 else '') + (labels[4] if len(labels) > 4 else '')
page += '</section><section><h2>MOSS introduction</h2>'
page += '<p>I am Skelly, the friendly skeleton. Chief officer of silly Halloween jokes!</p>'
page += labels[1] + '</section>'
if len(labels) > 3:
    page += '<section><h2>Another local MOSS joke</h2>'
    page += '<p>Why did the skeleton skip the party? He had no body to go with!</p>'
    if len(labels) > 5:
        page += ('<p>An automatic speech check struggled with the self-reference '
                 'version of this joke. Listen carefully to the actual words; '
                 'automatic recognition can also make mistakes.</p>')
    page += labels[3] + (labels[5] if len(labels) > 5 else '') + '</section>'
page += '</html>'
(samples / 'compare-voice-transfer.html').write_text(page, encoding='utf-8')
print(f'Prepared {len(labels)} validated, matched-level voice-transfer previews.')

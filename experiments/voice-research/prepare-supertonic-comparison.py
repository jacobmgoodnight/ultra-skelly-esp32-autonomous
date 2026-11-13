import html
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

root = Path('.').resolve()
folder = root / '.skelly-build/voice-research/samples'
sys.path.insert(0, str(root / 'experiments/local-talkback'))
from replies import REPLIES
from voice import validate_reply_wave

phrases = [REPLIES[3][1], REPLIES[2][0], REPLIES[9][0]]
data = []
for i in range(1, 4):
    for engine in ('piper', 'supertonic'):
        name = f'{engine}-{i}'
        audio, rate = sf.read(folder / (name + '.wav'), dtype='float64')
        if rate != 22050 or audio.ndim != 1 or not np.isfinite(audio).all():
            raise ValueError('Unexpected sample: ' + name)
        rms = np.sqrt(np.mean(audio * audio))
        if rms < 1e-5: raise ValueError('Silent sample: ' + name)
        data.append((name, audio, rms))
target = min(x[2] for x in data)
for name, audio, rms in data:
    adjusted = audio * min(1, target / rms)
    path = folder / ('matched-' + name + '.wav')
    sf.write(path, adjusted, 22050, subtype='PCM_16')
    validate_reply_wave(path.read_bytes())
sections = []
for i, phrase in enumerate(phrases, 1):
    sections.append(f'<section><h2>Phrase {i}</h2><p>{html.escape(phrase)}</p>' + ''.join(
        f'<label>{label}<audio controls preload="none" src="matched-{engine}-{i}.wav"></audio></label>'
        for engine, label in [('piper','Piper Joe'), ('supertonic','Supertonic 3 · M1')]) + '</section>')
page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Skelly voice comparison</title><style>body{font:18px system-ui;background:#171324;color:#f8f4ff;max-width:58rem;margin:auto;padding:1.5rem}section{padding:1rem;margin:1rem 0;border:1px solid #a491ca;border-radius:.7rem}label{display:block;margin:1rem 0}audio{display:block;width:min(100%,34rem);margin-top:.4rem}a{color:#d8b8ff}</style><h1>Skelly voice comparison</h1><p>Three identical reviewed lines, prepared locally. Select the Windows output you want, start at low volume, then play each sample. Volumes have been matched by reducing louder samples. This page does not use your microphone or connect to Skelly.</p><p>Supertonic is an experiment, not yet connected to live conversation. Listen for delivery, intelligibility and whether the voice suits Skelly. Generated speech may differ from the displayed text.</p>''' + ''.join(sections) + '</html>'
(folder / 'compare.html').write_text(page, encoding='utf-8')
print('Prepared six matched 22.05 kHz mono samples and comparison page.')

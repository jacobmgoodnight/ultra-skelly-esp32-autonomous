import html, sys
from pathlib import Path
import numpy as np
import soundfile as sf
root=Path('.').resolve();folder=root/'.skelly-build/voice-research/samples';moss=root/'.skelly-build/voice-research/moss/out'
sys.path.insert(0,str(root/'experiments/local-talkback'))
from replies import REPLIES
from voice import validate_reply_wave
phrases=[REPLIES[3][1],REPLIES[2][0],REPLIES[9][0]]
values=[]
for i in range(1,4):
    for engine in ('piper','supertonic','moss'):
        path=(moss if engine=='moss' else folder)/f'{engine}-{i}.wav'
        audio,rate=sf.read(path,dtype='float64');rms=np.sqrt(np.mean(audio*audio))
        if rate!=22050 or audio.ndim!=1 or not np.isfinite(audio).all() or rms<1e-5:raise ValueError('Invalid '+str(path))
        values.append((engine,i,audio,rms))
target=min(item[3] for item in values)
for engine,i,audio,rms in values:
    path=folder/f'matched-{engine}-{i}.wav'
    sf.write(path,audio*min(1,target/rms),22050,subtype='PCM_16');validate_reply_wave(path.read_bytes())
sections=[]
for i,text in enumerate(phrases,1):
    sections.append(f'<section><h2>Phrase {i}</h2><p>{html.escape(text)}</p>'+''.join(
        f'<label>{label}<audio controls preload="none" src="matched-{engine}-{i}.wav"></audio></label>'
        for engine,label in [('piper','Piper Joe'),('supertonic','Supertonic 3 · M1'),('moss','MOSS-TTS-Nano · Nathan')])+'</section>')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Skelly local voice comparison</title><style>body{font:18px system-ui;background:#171324;color:#f8f4ff;max-width:58rem;margin:auto;padding:1.5rem}section{padding:1rem;margin:1rem 0;border:1px solid #a491ca;border-radius:.7rem}label{display:block;margin:1rem 0}audio{display:block;width:min(100%,34rem);margin-top:.4rem}</style><h1>Skelly local voice comparison</h1><p>Three approved phrases generated locally by Piper Joe, Supertonic and MOSS. Select the Windows speaker you want, start at low volume and play one sample at a time. Volumes are matched by reducing louder samples. This page does not open the microphone or connect to Skelly.</p><p>Supertonic and MOSS are prepared research samples, not yet live conversation voices. Judge the character, clarity and timing. Generated audio may differ from the text.</p>'''+''.join(sections)+'</html>'
(folder/'compare-three.html').write_text(page,encoding='utf-8')
print('Prepared nine matched samples and three-voice page.')

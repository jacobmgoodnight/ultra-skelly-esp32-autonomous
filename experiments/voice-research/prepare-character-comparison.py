import html, sys
from pathlib import Path
import numpy as np
import soundfile as sf
root=Path('.').resolve();folder=root/'.skelly-build/voice-research/samples';moss=root/'.skelly-build/voice-research/moss/out'
sys.path.insert(0,str(root/'experiments/local-talkback'))
from replies import REPLIES
from voice import validate_reply_wave
phrases=[REPLIES[3][1],REPLIES[2][0],REPLIES[9][0]]
choices=[('supertonic','Supertonic · M1'),('nathan','MOSS · Nathan'),('adam','MOSS · Adam'),('reference','MOSS · Supertonic reference')]
values=[]
for i in range(1,4):
    for engine,label in choices:
        path=(folder/f'supertonic-{i}.wav' if engine=='supertonic' else moss/(f'moss-{i}.wav' if engine=='nathan' else f'moss-{engine}-{i}.wav'))
        audio,rate=sf.read(path,dtype='float64');rms=np.sqrt(np.mean(audio*audio))
        if rate!=22050 or audio.ndim!=1 or not np.isfinite(audio).all() or rms<1e-5:raise ValueError('Invalid '+str(path))
        values.append((engine,i,audio,rms))
target=min(item[3] for item in values)
for engine,i,audio,rms in values:
    path=folder/f'character-{engine}-{i}.wav';sf.write(path,audio*min(1,target/rms),22050,subtype='PCM_16');validate_reply_wave(path.read_bytes())
sections=[]
for i,text in enumerate(phrases,1):
    sections.append(f'<section><h2>Phrase {i}</h2><p>{html.escape(text)}</p>'+''.join(
        f'<label>{html.escape(label)}<audio controls preload="none" src="character-{engine}-{i}.wav"></audio></label>'
        for engine,label in choices)+'</section>')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Skelly character voice options</title><style>body{font:18px system-ui;background:#171324;color:#f8f4ff;max-width:58rem;margin:auto;padding:1.5rem}section{padding:1rem;margin:1rem 0;border:1px solid #a491ca;border-radius:.7rem}label{display:block;margin:1rem 0}audio{display:block;width:min(100%,34rem);margin-top:.4rem}</style><h1>Skelly character voice options</h1><p>Compare Supertonic, MOSS Nathan and Adam, and MOSS using a synthetic Supertonic reference. These are locally generated samples of the same reviewed phrases. Set your Windows output, start quietly, and play one sample at a time. Average levels were matched by turning louder samples down.</p><p>The reference is a generated Supertonic voice, not a visitor recording. These are previews; generated speech may differ from the written text. This page does not use the microphone or connect to Skelly.</p>'''+''.join(sections)+'</html>'
(folder/'compare-character.html').write_text(page,encoding='utf-8')
print('Prepared 12 matched character voice samples and comparison page.')

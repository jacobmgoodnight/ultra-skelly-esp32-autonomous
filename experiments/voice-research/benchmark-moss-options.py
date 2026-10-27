import json, os, sys, time
from pathlib import Path
root=Path('.').resolve(); base=root/'.skelly-build/voice-research/moss'
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1';os.environ['HF_HOME']=str(base/'hf-cache')
sys.path.insert(0,str(base/'MOSS-TTS-Nano-8b7bcc9341b3b4ef3a3a58ba1338a7d85ff133eb'))
sys.path.insert(0,str(root/'experiments/local-talkback'))
sys.path.append(str(root/'.skelly-build/local-talkback/chatterbox-env/Lib/site-packages'))
import numpy as np
import psutil, soundfile as sf
from scipy.signal import resample_poly
from onnx_tts_runtime import OnnxTtsRuntime
from voice import validate_reply_wave
from replies import REPLIES
t0=time.perf_counter();tts=OnnxTtsRuntime(model_dir=base/'models',thread_count=4,max_new_frames=150,output_dir=base/'out')
print('Loaded in',round(time.perf_counter()-t0,3),'seconds',flush=True)
reference=root/'.skelly-build/voice-research/samples/supertonic-3.wav'
validate_reply_wave(reference.read_bytes())
metrics=[]
for option in ('adam','reference'):
    for index,text in enumerate((REPLIES[3][1],REPLIES[2][0],REPLIES[9][0]),1):
        begin=time.perf_counter();out=base/'out'/f'moss-{option}-{index}-48000.wav'
        kwargs={'voice':'Adam'} if option=='adam' else {'prompt_audio_path':reference}
        res=tts.synthesize(text=text,output_audio_path=out,enable_wetext=False,streaming=True,seed=1,max_new_frames=150,**kwargs)
        elapsed=time.perf_counter()-begin; audio,rate=sf.read(out,dtype='float64')
        if rate!=48000 or audio.ndim!=2 or audio.shape[1]!=2 or not np.isfinite(audio).all():raise ValueError('Unexpected MOSS output')
        frames=int(res['audio_token_ids'].shape[0]);mono=resample_poly(np.mean(audio,axis=1),147,320)
        if not len(mono) or len(mono)>22050*8 or np.max(np.abs(mono))>1 or frames>=150:raise ValueError('Audio exceeds limits or may be incomplete')
        sample=base/'out'/f'moss-{option}-{index}.wav';sf.write(sample,mono,22050,subtype='PCM_16');validate_reply_wave(sample.read_bytes())
        row={'option':option,'phrase':index,'seconds':round(elapsed,3),'audio_seconds':round(len(mono)/22050,3),'working_set_mib':round(psutil.Process().memory_info().rss/1048576,1),'generated_frames':frames}
        metrics.append(row);print(json.dumps(row),flush=True)
(base/'out'/'options-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')

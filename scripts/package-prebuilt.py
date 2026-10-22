"""Package a compiled 4 MB ESP32 image; never flash or publish it."""
import argparse,hashlib,json,re,shutil
from pathlib import Path

def package(source, binary, output, revision, profile='head-only'):
    if not re.fullmatch(r'[0-9a-f]{40}',revision):raise ValueError('Use the full source commit SHA')
    data=binary.read_bytes()
    if len(data)!=4194304 or data[4096]!=0xe9 or data[65536]!=0xe9:
        raise ValueError('Expected the pinned ESP32 4 MB merged image with bootloader/app headers')
    code=source.read_text(encoding='utf-8')
    if profile not in ['head-only','universal']:raise ValueError('Unsupported installer profile')
    required=['const bool HEAD_ENABLED = true;','const uint8_t JAW_FOLLOWUP_MOTOR = 0;']
    if profile=='head-only':
        required+=['const uint32_t HEAD_MIN_INTERVAL_MS = 120000;','const uint32_t HEAD_MAX_INTERVAL_MS = 240000;']
        required+=['const bool '+flag+' = false;' for flag in ['MOUTH_ENABLED','ARM_ENABLED','TORSO_ENABLED','EYES_ENABLED','LIGHTS_ENABLED','COMPOUND_BODY_ENABLED','ALLOW_BODY_MOTOR_OVERLAP','REST_ENABLED','CLOCK_WINDOW_ENABLED','FAIR_BODY_TURNS','PLAYBACK_DIAGNOSTICS']]
        if '#define SKELLY_RUNTIME 1' in code:raise ValueError('Head-only package must not load saved runtime settings')
    else:
        required+=['#define SKELLY_RUNTIME 1','class RuntimeEngine']
        fields=re.search(r'enum RuntimeField \{(.*?)RF_COUNT',code,re.S).group(1)
        fields=re.findall(r'RF_(\w+)',fields)
        words=[int(n) for n in re.search(r'const uint32_t RUNTIME_SEED\[\] = \{([^}]+)\};',code).group(1).replace('UL','').split(',')]
        if words[:3]!=[1,1,0] or len(words)!=3+len(fields):raise ValueError('Universal installer needs one safe seed scene')
        config=dict(zip(fields,words[3:]))
        if config['headEnabled']!=1 or config['headMin']!=60 or config['headMax']!=120 or any(config[k] for k in ['jawEnabled','armEnabled','torsoEnabled','eyesEnabled','lightsEnabled','compoundEnabled','restEnabled','clockEnabled','fairBodyTurns','playbackDiagnostics']):raise ValueError('Universal seed must be Subtle with optional features OFF')
    for text in required:
        if text not in code:raise ValueError('Not the fixed head-only profile')
    output.mkdir(parents=True,exist_ok=True)
    filename='head-only.bin' if profile=='head-only' else 'universal.bin'
    shutil.copyfile(binary,output/filename)
    description='Head only, randomized 120–240 seconds; jaw, eyes, lights and other motors OFF' if profile=='head-only' else 'Universal USB settings and scenes; factory Subtle head 60–120 seconds, optional features OFF; saved settings take priority'
    metadata={'profile':profile,'binaryFile':filename,'chipFamily':'ESP32','core':'3.3.12','sourceCommit':revision,
      'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'binarySHA256':hashlib.sha256(data).hexdigest(),
      'bytes':len(data),'physicalStatus':'Untested','description':description}
    (output/'build.json').write_text(json.dumps(metadata,indent=2)+'\n')
    manifest={'name':'Ultra Skelly '+profile+' preview','version':revision[:12],
      'new_install_prompt_erase':True,'new_install_improv_wait_time':0,
      'builds':[{'chipFamily':'ESP32','parts':[{'path':filename,'offset':0}]}]}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return metadata

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['source','binary','output']:parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--revision',required=True);parser.add_argument('--profile',choices=['head-only','universal'],default='head-only');args=parser.parse_args()
    print(json.dumps(package(args.source,args.binary,args.output,args.revision,args.profile)))

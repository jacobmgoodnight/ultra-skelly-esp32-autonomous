"""Package a compiled 4 MB ESP32 image; never flash or publish it."""
import argparse,hashlib,json,re,shutil
from pathlib import Path

def package(source, binary, output, revision, profile='head-only', device='ultra'):
    if not re.fullmatch(r'[0-9a-f]{40}',revision):raise ValueError('Use the full source commit SHA')
    data=binary.read_bytes()
    if len(data)!=4194304 or data[4096]!=0xe9 or data[65536]!=0xe9:
        raise ValueError('Expected the pinned ESP32 4 MB merged image with bootloader/app headers')
    code=source.read_text(encoding='utf-8')
    if device not in ['ultra','skelly12'] or (device=='skelly12' and profile!='universal'):raise ValueError('Unsupported installer device/profile')
    experimental='#define SKELLY_DEVICE_12FT 1' in code
    if experimental != (device=='skelly12'):raise ValueError('Source device does not match package device')
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
        if words[:3]!=[12 if experimental else 1,1,0] or len(words)!=3+len(fields):raise ValueError('Universal installer needs one safe seed scene')
        config=dict(zip(fields,words[3:]))
        if config['headEnabled']!=1 or config['headMin']!=(90 if experimental else 60) or config['headMax']!=120 or any(config[k] for k in ['jawEnabled','armEnabled','torsoEnabled','eyesEnabled','lightsEnabled','compoundEnabled','restEnabled','clockEnabled','fairBodyTurns','playbackDiagnostics']):raise ValueError('Universal seed must be Subtle with optional features OFF')
    for text in required:
        if text not in code:raise ValueError('Not the fixed head-only profile')
    output.mkdir(parents=True,exist_ok=True)
    filename='head-only.bin' if profile=='head-only' else 'universal.bin'
    shutil.copyfile(binary,output/filename)
    description='Head only, randomized 120–240 seconds; jaw, eyes, lights and other motors OFF' if profile=='head-only' else 'Universal USB settings/scenes; full-image install resets ESP32 data; factory Subtle head 60–120 seconds, optional features OFF'
    if experimental:description='Experimental 2026 12-foot; Not Hardware Tested; head 90–120 seconds, all optional features OFF'
    metadata={'profile':profile,'deviceId':device,'binaryFile':filename,'chipFamily':'ESP32','core':'3.3.12','sourceCommit':revision,
      'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'binarySHA256':hashlib.sha256(data).hexdigest(),
      'bytes':len(data),'physicalStatus':'Untested','description':description}
    identity={}
    for key,pattern in [('firmwareRevision',r'const uint32_t FIRMWARE_REVISION = (\d+);'),('firmwareBuild',r'const uint32_t FIRMWARE_BUILD = (\d+)UL;'),('releaseVersion',r'const char \*FIRMWARE_RELEASE = "([^"]+)";')]:
        match=re.search(pattern,code)
        if match:identity[key]=match.group(1) if key=='releaseVersion' else int(match.group(1))
    metadata.update(identity)
    (output/'build.json').write_text(json.dumps(metadata,indent=2)+'\n')
    manifest={'name':('Experimental 12-foot Skelly' if experimental else 'Ultra Skelly')+' '+profile+' preview','version':revision[:12],
      'new_install_prompt_erase':False,'new_install_improv_wait_time':0,
      'builds':[{'chipFamily':'ESP32','parts':[{'path':filename,'offset':0}]}]}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return metadata

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['source','binary','output']:parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--revision',required=True);parser.add_argument('--profile',choices=['head-only','universal'],default='head-only')
    parser.add_argument('--device',choices=['ultra','skelly12'],default='ultra');args=parser.parse_args()
    print(json.dumps(package(args.source,args.binary,args.output,args.revision,args.profile,args.device)))

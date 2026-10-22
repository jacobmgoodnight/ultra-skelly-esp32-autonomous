"""Package a compiled 4 MB ESP32 image; never flash or publish it."""
import argparse,hashlib,json,re,shutil
from pathlib import Path

def package(source, binary, output, revision):
    if not re.fullmatch(r'[0-9a-f]{40}',revision):raise ValueError('Use the full source commit SHA')
    data=binary.read_bytes()
    if len(data)!=4194304 or data[4096]!=0xe9 or data[65536]!=0xe9:
        raise ValueError('Expected the pinned ESP32 4 MB merged image with bootloader/app headers')
    code=source.read_text(encoding='utf-8')
    for text in ['const bool MOUTH_ENABLED = false;','const bool HEAD_ENABLED = true;','const uint32_t HEAD_MIN_INTERVAL_MS = 120000;','const uint32_t HEAD_MAX_INTERVAL_MS = 240000;']:
        if text not in code:raise ValueError('Not the fixed head-only profile')
    output.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(binary,output/'head-only.bin')
    metadata={'profile':'head-only','chipFamily':'ESP32','core':'3.3.12','sourceCommit':revision,
      'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'binarySHA256':hashlib.sha256(data).hexdigest(),
      'bytes':len(data),'physicalStatus':'Untested','description':'Head only, randomized 120–240 seconds; jaw, eyes, lights and other motors OFF'}
    (output/'build.json').write_text(json.dumps(metadata,indent=2)+'\n')
    manifest={'name':'Ultra Skelly head-only preview','version':revision[:12],
      'new_install_prompt_erase':True,'new_install_improv_wait_time':0,
      'builds':[{'chipFamily':'ESP32','parts':[{'path':'head-only.bin','offset':0}]}]}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return metadata

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['source','binary','output']:parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--revision',required=True);args=parser.parse_args()
    print(json.dumps(package(args.source,args.binary,args.output,args.revision)))

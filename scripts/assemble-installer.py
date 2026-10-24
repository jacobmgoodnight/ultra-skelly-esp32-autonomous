"""Validate same-commit installer artifacts and add versioned packages to a Pages site."""
import argparse,hashlib,json,re,shutil,subprocess,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def assemble(packages,output,revision):
    if not re.fullmatch(r'[a-f0-9]{40}',revision):raise ValueError('Expected full reviewed source SHA')
    release=(ROOT/'studio/release.js').read_text(encoding='utf-8')
    version=re.search(r"VERSION='([^']+)'",release).group(1)
    identity={'releaseVersion':version,'firmwareRevision':int(re.search(r'REVISION=(\d+)',release).group(1)),
              'firmwareBuild':int(re.search(r'BUILD=(\d+)',release).group(1))}
    if not re.fullmatch(r'\d{4}\.\d{2}\.\d{2}-preview\.\d+',version):raise ValueError('Invalid release path')
    catalog={'schema':1,'sourceCommit':revision,**identity,'packages':{}}
    validated=[]
    for device,artifact in [('ultra','universal-usb-preview'),('skelly12','experimental-12ft-usb-preview')]:
        package=packages/artifact;meta=json.loads((package/'build.json').read_text())
        data=(package/'universal.bin').read_bytes()
        expected={'deviceId':device,'profile':'universal','binaryFile':'universal.bin','sourceCommit':revision,
                  'chipFamily':'ESP32','core':'3.3.12','bytes':4194304,'physicalStatus':'Untested',**identity}
        if any(meta.get(k)!=v for k,v in expected.items()):raise ValueError('Mixed or incorrect package metadata: '+device)
        if len(data)!=4194304 or data[4096]!=0xe9 or data[65536]!=0xe9 or hashlib.sha256(data).hexdigest()!=meta.get('binarySHA256'):raise ValueError('Damaged firmware: '+device)
        with tempfile.TemporaryDirectory() as temp:
            subprocess.run(['node',str(ROOT/'scripts/prepare-universal.cjs'),temp,device],check=True,capture_output=True)
            if hashlib.sha256((Path(temp)/'Universal.ino').read_bytes()).hexdigest()!=meta.get('sourceSHA256'):raise ValueError('Source hash mismatch: '+device)
        manifest=json.loads((package/'manifest.json').read_text())
        if manifest.get('builds')!=[{'chipFamily':'ESP32','parts':[{'path':'universal.bin','offset':0}]}] or manifest.get('new_install_prompt_erase') is not False or manifest.get('new_install_improv_wait_time')!=0:raise ValueError('Unexpected installer manifest')
        relative=f'{version}/{revision}/{device}'
        catalog['packages'][device]={'metadata':'./'+relative+'/build.json','binarySHA256':meta['binarySHA256']}
        validated.append((package,relative))
    # Validate both models before changing the output or its catalog.
    target=output/'studio/firmware'
    for package,relative in validated:
        destination=target/relative;destination.mkdir(parents=True,exist_ok=True)
        for name in ['universal.bin','build.json','manifest.json']:shutil.copyfile(package/name,destination/name)
    (target/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf-8')
    return catalog

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packages',required=True,type=Path);parser.add_argument('--output',required=True,type=Path);parser.add_argument('--revision',required=True)
    args=parser.parse_args();print(json.dumps(assemble(args.packages,args.output,args.revision)))

"""Compile canonical, generated, diagnostics, packs and fixed installer profile.
Uses one scratch sketch to reuse libraries. Never uploads; requires core 3.3.12.
"""
import argparse,hashlib,json,os,shutil,subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cli',default=os.environ.get('ARDUINO_CLI','arduino-cli'))
    args=parser.parse_args();cli=args.cli
    installed=json.loads(subprocess.check_output([cli,'core','list','--format','json'],text=True))
    if not any(p.get('id')=='esp32:esp32' and p.get('installed_version')=='3.3.12' for p in installed['platforms']):
        raise SystemExit('Install Arduino-ESP32 3.3.12 before compiling')
    build=ROOT/'.skelly-build/validation';build.mkdir(parents=True,exist_ok=True)
    env={**os.environ,'SKELLY_BUILD_ROOT':str(build/'matrix')}
    subprocess.run(['node','studio/tests/export-samples.cjs'],cwd=ROOT,env=env,check=True,stdout=subprocess.DEVNULL)
    for flags in [[],['--quick']]:subprocess.run(['node','scripts/export-attended-tests.cjs',*flags],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['node','scripts/prepare-prebuilt.cjs'],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['node','scripts/prepare-universal.cjs'],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['node','scripts/prepare-owner-tools.cjs','--wireless'],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    cases=[('Canonical',ROOT/'firmware/SkellyAutonomous/SkellyAutonomous.ino')]
    cases += [('WirelessStatusExperiment',ROOT/'.skelly-build/WirelessStatusExperiment/WirelessStatusExperiment.ino')]
    cases += [(p.parent.name,p) for p in sorted((build/'matrix').glob('*/*.ino'))]
    cases += [(p.parent.name,p) for p in sorted((ROOT/'experiments').glob('*/*.ino')) if p.parent.name!='SerialIdleTest']
    for pack in ['attended-tests','quick-tests']:cases += [(p.parent.name,p) for p in sorted((ROOT/'.skelly-build'/pack).glob('*/*.ino'))]
    cases += [('PrebuiltHeadOnly',ROOT/'.skelly-build/prebuilt/HeadOnly/HeadOnly.ino'),('PrebuiltUniversal',ROOT/'.skelly-build/prebuilt/Universal/Universal.ino'),('SerialIdleTest',ROOT/'experiments/SerialIdleTest/SerialIdleTest.ino')]
    scratch=build/'ValidationSketch';scratch.mkdir(exist_ok=True);results=[]
    for name,source in cases:
        data=source.read_bytes();(scratch/'ValidationSketch.ino').write_bytes(data)
        print('BUILD '+name,flush=True)
        subprocess.run([cli,'compile','--jobs','2','--fqbn','esp32:esp32:esp32','--build-path',str(build/'cache'),str(scratch)],check=True)
        results.append({'name':name,'source':str(source.relative_to(ROOT)), 'sha256':hashlib.sha256(data).hexdigest(),'result':'compiled'})
        (build/'results.json').write_text(json.dumps({'core':'3.3.12','results':results},indent=2))
        if name=='PrebuiltHeadOnly':shutil.copyfile(build/'cache/ValidationSketch.ino.merged.bin',ROOT/'.skelly-build/prebuilt/HeadOnly-tested.merged.bin')
        if name=='PrebuiltUniversal':shutil.copyfile(build/'cache/ValidationSketch.ino.merged.bin',ROOT/'.skelly-build/prebuilt/Universal-tested.merged.bin')
    print(f'PASS {len(results)} ESP32 3.3.12 builds',flush=True)
if __name__=='__main__':main()

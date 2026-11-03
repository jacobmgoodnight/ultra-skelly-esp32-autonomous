"""Download one pinned public conversation model, or verify/reuse its local file."""
import argparse
import hashlib
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'local-talkback'))
from local_brain import MODELS, SOURCES
from pocket_voice import ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', choices=tuple(MODELS), default='lfm')
    args = parser.parse_args()
    name, size, digest = MODELS[args.model]
    target = ROOT / '.skelly-build/conversation-brain' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file():
        if target.stat().st_size != size or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise ValueError('Existing model differs from the pinned file. Refusing to overwrite it.')
        print('Verified existing local model: ' + name)
        return
    import requests
    partial = target.with_suffix('.partial')
    downloaded, checksum = 0, hashlib.sha256()
    with requests.get(SOURCES[args.model] + name, stream=True, timeout=(20, 60)) as response:
        response.raise_for_status()
        with partial.open('wb') as output:
            for chunk in response.iter_content(1024 * 1024):
                downloaded += len(chunk)
                if downloaded > size:
                    raise ValueError('Download exceeded its pinned size.')
                output.write(chunk)
                checksum.update(chunk)
    if downloaded != size or checksum.hexdigest() != digest:
        raise ValueError('Downloaded model did not match the pinned hash.')
    partial.replace(target)
    print('Verified local model: ' + name)


if __name__ == '__main__':
    main()

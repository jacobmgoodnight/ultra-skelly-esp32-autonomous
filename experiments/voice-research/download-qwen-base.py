"""Download one pinned, public Qwen Base model into ignored research output."""
from pathlib import Path
import argparse
import hashlib
import os
import requests
import shutil

root = Path('.skelly-build/voice-research/qwen-design-models')
root.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--large', action='store_true', help='Download the 1.7B Base Q4 model instead.')
args = parser.parse_args()
name, size, expected = (
    ('qwen-talker-1.7b-base-Q4_K_M.gguf', 1219245248,
     'ea393ebaf2167ea23ce9fc18b093822851358a950d7075cd47ab4f6ce23e887d')
    if args.large else
    ('qwen-talker-0.6b-base-Q4_K_M.gguf', 628905056,
     '4b468ec7b1f62b90ef4ca316c0aa57deadfd54b2cf9651703ea753cedaf04226')
)
revision = 'b7ee2e8c7459c3bea99da23e3d178125a7d1713c'
dest = root / name
def sha256(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()
if dest.exists() and dest.stat().st_size == size and sha256(dest) == expected:
    print('Existing model verified.')
    raise SystemExit(0)
if shutil.disk_usage(root).free < size + 3 * 1024**3:
    raise SystemExit('Insufficient free disk space for model and reserve.')
partial = root / (name + '.part')
url = f'https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF/resolve/{revision}/{name}'
digest = hashlib.sha256()
count = 0
try:
    with requests.get(url, stream=True, timeout=(20, 120)) as response:
        response.raise_for_status()
        with partial.open('wb') as f:
            for chunk in response.iter_content(1024 * 1024):
                if chunk:
                    count += len(chunk)
                    if count > size:
                        raise ValueError('Download exceeds expected size.')
                    digest.update(chunk)
                    f.write(chunk)
    if count != size or digest.hexdigest() != expected:
        raise ValueError('Model size or publisher SHA-256 mismatch.')
    os.replace(partial, dest)
    print(f'Verified {name}: {count} bytes.')
finally:
    if partial.exists():
        partial.unlink()

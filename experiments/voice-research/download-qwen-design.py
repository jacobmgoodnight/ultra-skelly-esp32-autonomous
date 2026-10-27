"""Download the two pinned Q4 VoiceDesign files into ignored research output."""
from pathlib import Path
import hashlib
import os
import shutil
import requests

ROOT = Path('.skelly-build/voice-research/qwen-design-models')
REVISION = 'b7ee2e8c7459c3bea99da23e3d178125a7d1713c'
FILES = {
    'qwen-talker-1.7b-voicedesign-Q4_K_M.gguf': (1182630816, '7605ed0cc5e72059f27468c27f70c070e05d1cc0c7b1c76bfb9cba717a59eee3'),
    'qwen-tokenizer-12hz-Q4_K_M.gguf': (254974752, 'cf3788b4d50aaa665fb6e57c170396aae03a3555fea52d2b5d0cda902d658039'),
}


def hash_file(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


ROOT.mkdir(parents=True, exist_ok=True)
if shutil.disk_usage(ROOT).free < sum(size for size, _ in FILES.values()) + 3 * 1024**3:
    raise SystemExit('Not enough free space for the model plus a 3 GiB reserve.')
for name, (expected_size, expected_hash) in FILES.items():
    dest = ROOT / name
    if dest.is_file() and dest.stat().st_size == expected_size and hash_file(dest) == expected_hash:
        print(f'{name}: existing file verified', flush=True)
        continue
    temp = ROOT / (name + '.part')
    url = f'https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF/resolve/{REVISION}/{name}'
    print(f'Downloading {name}', flush=True)
    digest = hashlib.sha256()
    size = 0
    try:
        with requests.get(url, stream=True, timeout=(20, 120)) as response:
            response.raise_for_status()
            with temp.open('wb') as stream:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        size += len(chunk)
                        if size > expected_size:
                            raise ValueError('Download exceeds expected size')
                        digest.update(chunk)
                        stream.write(chunk)
        if size != expected_size or digest.hexdigest() != expected_hash:
            raise ValueError('Size or publisher SHA-256 did not match')
        os.replace(temp, dest)
        print(f'{name}: verified {size} bytes', flush=True)
    finally:
        if temp.exists():
            temp.unlink()

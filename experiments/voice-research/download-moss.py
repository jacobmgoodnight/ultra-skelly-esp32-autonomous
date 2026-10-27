"""Download pinned public MOSS research assets into the ignored build folder."""
import hashlib
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path('.skelly-build/voice-research/moss').resolve()
ROOT.mkdir(parents=True, exist_ok=True)
os.environ['HF_HOME'] = str(ROOT / 'hf-cache')
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
os.environ['HF_HUB_DISABLE_XET'] = '1'

from huggingface_hub import HfApi, snapshot_download

REPOS = (
    ('OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX', 'f52645cb467506d8e18e746ddd59482685b74e58'),
    ('OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX', 'ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae'),
)
SOURCE_REV = '8b7bcc9341b3b4ef3a3a58ba1338a7d85ff133eb'
SOURCE_SHA = '5e68ba847445e4406d7e6160241b1e5f6fc109d1660ca921a226075e9675f489'


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


for repository, revision in REPOS:
    destination = ROOT / 'models' / repository.split('/')[-1]
    info = HfApi().model_info(repository, revision=revision, files_metadata=True, token=False)
    entries = [item for item in info.siblings if item.rfilename.endswith(('.onnx', '.data', '.json', '.model'))]
    snapshot_download(repository, revision=revision, local_dir=destination,
                      allow_patterns=[item.rfilename for item in entries], token=False, max_workers=2)
    for item in entries:
        if item.lfs and sha256(destination / item.rfilename) != item.lfs.sha256:
            raise ValueError('Model hash mismatch: ' + item.rfilename)
    print('Verified model', repository, 'revision', revision, flush=True)

archive = ROOT / 'source.zip'
with urllib.request.urlopen('https://codeload.github.com/OpenMOSS/MOSS-TTS-Nano/zip/' + SOURCE_REV, timeout=60) as response, archive.open('wb') as output:
    for chunk in iter(lambda: response.read(1024 * 1024), b''):
        output.write(chunk)
if sha256(archive) != SOURCE_SHA:
    raise ValueError('Pinned source archive hash mismatch')
print('Pinned source matches the recorded hash.', flush=True)
sys.path.insert(0, str(Path('experiments/local-talkback').resolve()))
from chatterbox_extract import safe_extract
safe_extract(archive, ROOT)
print('Pinned source unpacked.', flush=True)

import hashlib
import os
from pathlib import Path
from urllib.request import urlopen

root = Path('.skelly-build/voice-research').resolve()
root.mkdir(parents=True, exist_ok=True)
os.environ['HF_HOME'] = str(root / 'hf-cache')
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
os.environ['HF_HUB_DISABLE_XET'] = '1'
from huggingface_hub import HfApi, snapshot_download

repo = 'supertone-oss-archive/supertonic-3'
revision = 'aafc6e32416a594460b32413efc49d7fe4ce6d46'
info = HfApi().model_info(repo, revision=revision, files_metadata=True, token=False)
names = ['onnx/duration_predictor.onnx', 'onnx/text_encoder.onnx', 'onnx/vector_estimator.onnx', 'onnx/vocoder.onnx', 'onnx/tts.json', 'onnx/unicode_indexer.json', 'voice_styles/M1.json']
assets = root / 'assets'
snapshot_download(repo, revision=revision, local_dir=assets, allow_patterns=names, token=False, max_workers=2)
for name in names:
    metadata = next(x for x in info.siblings if x.rfilename == name)
    if metadata.lfs:
        digest = hashlib.sha256((assets / name).read_bytes()).hexdigest()
        if digest != metadata.lfs.sha256:
            raise ValueError('Model file hash mismatch: ' + name)
print('Model revision verified; large files match publisher metadata.', flush=True)
source_url = 'https://raw.githubusercontent.com/supertone-oss-archive/supertonic/1e9799e964ea4c0dad7cde993b65c3c813a7b373/py/helper.py'
source_sha = 'b14b1da8a018aa4db6ca8cbb927c32590bfc889b49116ea344c56e8351d94279'
with urlopen(source_url, timeout=30) as response:
    source = response.read(100_001)
if len(source) > 100_000 or hashlib.sha256(source).hexdigest() != source_sha:
    raise ValueError('Unexpected source size or hash')
(root / 'helper.py').write_bytes(source)
print('Pinned source matches the recorded SHA-256.', flush=True)

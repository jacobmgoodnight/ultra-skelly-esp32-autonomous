"""Pinned playback-only synthetic comparisons. Never accepts a visitor path."""
import hashlib
import json
from pathlib import Path
from pocket_voice import ROOT
from voice import validate_reply_wave


def load_previews(root=ROOT, lock_path=None):
    root=Path(root).resolve()
    lock_path=lock_path or Path(__file__).with_name('haunt-preview.lock.json')
    lock=json.loads(Path(lock_path).read_text())
    if set(lock['clips']) != {'dry','croaky','crypt'}:
        raise ValueError('Unexpected preview set.')
    result={}
    for key,row in lock['clips'].items():
        path=(root/row['path']).resolve()
        if not path.is_relative_to(root) or not 44<path.stat().st_size<=352844:
            raise ValueError('Preview path/size is unsupported.')
        data=path.read_bytes()
        if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']:
            raise ValueError('Preview changed.')
        validate_reply_wave(data);result[key]=data
    return result

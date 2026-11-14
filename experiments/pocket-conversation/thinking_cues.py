"""Articulated synthetic-character interjections; all earlier sets are preserved."""
import base64
import hashlib
import io
import json
from pathlib import Path
import wave

HERE = Path(__file__).resolve().parent
TEXTS = {'thinking': 'Let me think.', 'moment': 'One moment.', 'well': 'Well now.'}
CUE_FOLDER = HERE / 'cues-v4'


def load_cues(folder=CUE_FOLDER):
    folder = Path(folder)
    lock = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    if set(lock['clips']) != set(TEXTS):
        raise ValueError('Unexpected thinking cue set.')
    result = []
    for identity, text in TEXTS.items():
        row = lock['clips'][identity]
        if row['text'] != text:
            raise ValueError('Unexpected thinking cue text.')
        path = folder / (identity + '.wav')
        if not 44 < path.stat().st_size <= 88244:
            raise ValueError('Thinking cue exceeds its limit.')
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != row['sha256']:
            raise ValueError('Thinking cue changed.')
        with wave.open(io.BytesIO(data)) as audio:
            frames = audio.getnframes()
            if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype()) != (1, 2, 22050, 'NONE') or not 0 < frames <= 44100 or len(audio.readframes(frames)) != frames * 2 or len(data) != 44 + frames * 2:
                raise ValueError('Invalid thinking cue audio.')
        result.append({'id': identity, 'text': text, 'audio': base64.b64encode(data).decode('ascii')})
    return result

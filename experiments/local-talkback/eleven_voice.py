"""Opt-in ElevenLabs synthesis restricted to the reviewed, name-free catalog."""
import io
import json
import os
import re
import subprocess
import sys
import time
import wave
from pathlib import Path

from replies import REPLIES
from voice import _combine_delivery, _delivery_parts, _remaining, validate_reply_wave
from eleven_worker import DEFAULT_VOICE, MAX_PCM

APPROVED = frozenset(line for group in REPLIES for line in group)


class ElevenVoice:
    def __init__(self, key, voice_id=DEFAULT_VOICE, runner=subprocess.run):
        if not isinstance(key, str) or not 1 <= len(key) <= 512 or any(ord(c) < 33 or ord(c) > 126 for c in key):
            raise ValueError('Invalid ElevenLabs key')
        if not re.fullmatch(r'[A-Za-z0-9]{10,50}', voice_id):
            raise ValueError('Invalid ElevenLabs voice ID')
        self.key, self.voice_id, self.runner = key, voice_id, runner
        self.label = 'ElevenLabs v3 · online, approved reply text only'

    def synthesize(self, text, work=None):
        if text not in APPROVED:
            raise ValueError('Only name-free reviewed replies can use the online voice.')
        deadline = time.monotonic() + 10
        pieces = []
        for part in _delivery_parts(text):
            env = os.environ.copy()
            env['SKELLY_ELEVENLABS_API_KEY'] = self.key
            env['SKELLY_ELEVENLABS_VOICE_ID'] = self.voice_id
            result = self.runner([sys.executable, str(Path(__file__).with_name('eleven_worker.py'))],
                                 input=json.dumps({'text': part}).encode('utf-8'), stdout=subprocess.PIPE,
                                 stderr=subprocess.DEVNULL, check=True, timeout=_remaining(deadline), env=env,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            pcm = result.stdout
            if not isinstance(pcm, bytes) or not 0 < len(pcm) <= MAX_PCM or len(pcm) % 2:
                raise ValueError('Invalid online speech audio.')
            output = io.BytesIO()
            with wave.open(output, 'wb') as audio:
                audio.setnchannels(1)
                audio.setsampwidth(2)
                audio.setframerate(22050)
                audio.writeframes(pcm)
            pieces.append(output.getvalue())
            _remaining(deadline)
        result = pieces[0] if len(pieces) == 1 else _combine_delivery(pieces)
        validate_reply_wave(result)
        _remaining(deadline)
        return result

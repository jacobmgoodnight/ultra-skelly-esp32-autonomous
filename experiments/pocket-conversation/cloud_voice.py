"""Explicitly selected cloud voice for checked conversational replies only.

No automatic fallback, network retry, model download, capture, or playback occurs
here. The default local path does not instantiate this adapter.
"""
import io
import os
import sys
import threading
import time
import wave
from pathlib import Path

from cloud_process import run_worker
from cloud_voice_worker import DELIVERIES, MAX_PCM, validate_config
from conversation_policy import validate_spoken_reply
from pocket_voice import check
from voice import validate_reply_wave


class CloudVoice:
    def __init__(self, key, voice_id, model='eleven_v3', runner=run_worker):
        validate_config(key, voice_id, model)
        self.key, self.voice_id, self.model, self.runner = key, voice_id, model, runner
        self._delivery = 'natural'
        self.fallback_reason = None
        self.label = 'ElevenLabs ' + model.removeprefix('eleven_') + ' · online, checked reply text only'

    @property
    def delivery(self):
        return self._delivery

    @delivery.setter
    def delivery(self, value):
        if not isinstance(value, str) or value not in DELIVERIES:
            raise ValueError('Invalid speech delivery.')
        self._delivery = value

    def synthesize(self, text, work=None, cancel=None, deadline=None):
        # Validate the actual untagged reply before starting any network worker.
        validate_spoken_reply(text)
        self.fallback_reason = None
        cancel = cancel if cancel is not None else threading.Event()
        deadline = min(deadline if deadline is not None else float('inf'), time.monotonic() + 10)
        check(cancel, deadline)
        payload = {'text': text, 'voice_id': self.voice_id, 'model': self.model,
                   'delivery': self.delivery, 'timeout': min(10, deadline - time.monotonic())}
        check(cancel, deadline)
        pcm = self.runner([sys.executable, str(Path(__file__).with_name('cloud_voice_worker.py'))],
            payload, {'SKELLY_ELEVENLABS_API_KEY': self.key}, cancel, deadline,
            max_output_bytes=MAX_PCM)
        check(cancel, deadline)
        if not isinstance(pcm, bytes) or not 0 < len(pcm) <= MAX_PCM or len(pcm) % 2:
            raise ValueError('Online speech audio rejected.')
        output = io.BytesIO()
        with wave.open(output, 'wb') as stream:
            stream.setnchannels(1)
            stream.setsampwidth(2)
            stream.setframerate(22050)
            stream.writeframes(pcm)
        audio = output.getvalue()
        validate_reply_wave(audio)
        check(cancel, deadline)
        return audio, 'elevenlabs-' + self.model.removeprefix('eleven_')


def from_env(environ=None):
    """Missing or invalid optional owner configuration leaves cloud unavailable."""
    source = os.environ if environ is None else environ
    try:
        return CloudVoice(source.get('SKELLY_ELEVENLABS_API_KEY', ''),
                          source.get('SKELLY_ELEVENLABS_VOICE_ID', ''),
                          source.get('SKELLY_ELEVENLABS_MODEL', 'eleven_v3'))
    except (TypeError, ValueError):
        return None

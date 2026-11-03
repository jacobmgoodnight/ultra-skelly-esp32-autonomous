"""Optional, explicitly selected Claude speech brain; local remains separate."""
import os
from pathlib import Path
import sys
import threading
import time

from cloud_process import run_worker
from cloud_worker import MODELS, build_request_body, parse_json, valid_key, validate_result
from conversation_policy import validate_spoken_reply
from followup_questions import split_followup
from pocket_voice import check


class CloudBrain:
    cloud = True
    loaded = True

    def __init__(self, key, model='claude-haiku-5-5'):
        if not valid_key(key) or model not in MODELS:
            raise ValueError('Cloud brain configuration is missing or invalid.')
        self._key, self.model = key, model
        name = 'Haiku 5.5' if model == 'claude-haiku-5-5' else 'Sonnet 5.5'
        self.label = 'Claude ' + name + ' · cloud · paid API'

    @classmethod
    def from_env(cls, environ=None):
        source = os.environ if environ is None else environ
        key = source.get('SKELLY_ANTHROPIC_API_KEY', '')
        if not key:
            return None
        return cls(key, source.get('SKELLY_ANTHROPIC_MODEL', 'claude-haiku-5-5'))

    def start(self, cancel=None, deadline=None):
        check(cancel if cancel is not None else threading.Event(),
              deadline if deadline is not None else time.monotonic() + 1)

    def close(self):
        pass

    def reply(self, messages, cancel, deadline, question=None):
        check(cancel, deadline)
        question = True if question is None else question
        payload = {'op': 'brain', 'model': self.model, 'messages': messages, 'question': question,
                   'timeoutSeconds': max(.001, min(30, deadline - time.monotonic()))}
        build_request_body(payload)
        raw = run_worker([sys.executable, str(Path(__file__).with_name('cloud_worker.py'))], payload,
            {'SKELLY_ANTHROPIC_API_KEY': self._key}, cancel, deadline, max_output_bytes=2048)
        check(cancel, deadline)
        value = parse_json(raw)
        if not isinstance(value, dict) or set(value) != {'reply'}:
            raise ValueError('Invalid cloud brain worker result.')
        spoken = value['reply']
        validate_spoken_reply(spoken)
        answer, followup = split_followup(spoken)
        fields = {'reply': answer, 'question': followup} if question else {'reply': spoken}
        if validate_result(fields, question) != spoken or spoken.count('?') != int(question):
            raise ValueError('Cloud brain worker cadence mismatch.')
        return spoken


def from_env(environ=None):
    """Invalid optional credentials/configuration must not block local mode."""
    try:
        return CloudBrain.from_env(environ)
    except (TypeError, ValueError):
        return None

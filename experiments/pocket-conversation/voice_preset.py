"""One optional, nonsecret voice substitution for an already configured worker.

Only the fixed repository-local preset is read in production. No request or
environment value can select a file; the path argument exists for isolated tests.
The preset cannot supply credentials, endpoints, delivery hints, or text.
"""
import json
from pathlib import Path
import re


PRESET_PATH = (Path(__file__).resolve().parents[2] / '.skelly-build' /
               'conversation-brain' / 'elevenlabs-voice-preset.json')
MAX_PRESET_BYTES = 2048
FIELDS = frozenset(('version', 'fromVoiceId', 'model', 'voiceId'))


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Invalid optional voice preset.')
        result[key] = value
    return result


def _valid_voice_id(value):
    return isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9]{10,50}', value) is not None


def resolve_voice_id(voice_id, model, allowed_models, *, path=PRESET_PATH):
    """Replace only an exact source-voice/model match after full validation.

    A missing preset leaves existing configuration unchanged. An unreadable or
    invalid present preset fails closed, including for a nonmatching request.
    Read one bounded snapshot so an atomic replacement cannot mix two versions.
    """
    try:
        try:
            source = path.open('rb')
        except FileNotFoundError:
            return voice_id
        with source:
            raw = source.read(MAX_PRESET_BYTES + 1)
        if len(raw) > MAX_PRESET_BYTES:
            raise ValueError('Invalid optional voice preset.')
        preset = json.loads(raw.decode('utf-8'), object_pairs_hook=_unique_object)
        if (not isinstance(preset, dict) or set(preset) != FIELDS or
                type(preset['version']) is not int or preset['version'] != 1 or
                not _valid_voice_id(preset['fromVoiceId']) or
                not _valid_voice_id(preset['voiceId']) or
                not isinstance(preset['model'], str) or preset['model'] not in allowed_models):
            raise ValueError('Invalid optional voice preset.')
        if voice_id == preset['fromVoiceId'] and model == preset['model']:
            return preset['voiceId']
        return voice_id
    except (OSError, UnicodeError, ValueError, TypeError):
        # Never expose paths, file content, or details from the parser or OS.
        raise ValueError('Invalid optional voice preset.') from None

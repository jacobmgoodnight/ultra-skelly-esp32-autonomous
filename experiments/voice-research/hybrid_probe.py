"""Isolated routing probe: no microphone, playback, persistence, or network.

This is not integrated with the companion. A human must listen to any real
recording before marking it approved; a hash only detects later changes.
"""
import hashlib
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'local-talkback'))
from companion import NAMES
from replies import REPLIES, ReplyDeck
from voice import validate_reply_wave


@dataclass(frozen=True)
class Recording:
    text: str
    wave: bytes
    sha256: str
    approved: bool = False


def route(topic, variant, recordings, name=''):
    """Return (source, approved text, optional WAV) for an existing reply ID.

    Personalized responses always go to live synthesis, keeping the complete
    greeting as one utterance. Missing, unapproved, damaged, stale, or changed
    recordings also fall back to the existing live voice, without accepting text
    from a manifest or visitor. The caller must enforce normal turn safeguards.
    """
    if type(topic) is not int or not 0 <= topic < len(REPLIES):
        raise ValueError('Invalid topic')
    if type(variant) is not int or not 0 <= variant < len(REPLIES[topic]):
        raise ValueError('Invalid variant')
    if not isinstance(name, str) or (name and name.casefold() not in NAMES):
        raise ValueError('Name is not allowlisted')
    text = REPLIES[topic][variant]
    if name:
        return 'live', 'Hi, ' + name.capitalize() + '! ' + text, None
    recording = recordings.get((topic, variant))
    if not isinstance(recording, Recording) or recording.approved is not True or recording.text != text:
        return 'live', text, None
    try:
        if hashlib.sha256(recording.wave).hexdigest() != recording.sha256:
            return 'live', text, None
        validate_reply_wave(recording.wave)
    except (TypeError, ValueError):
        return 'live', text, None
    return 'recorded', text, recording.wave


if __name__ == '__main__':
    deck = ReplyDeck()
    topic, variant, _ = deck.next(3)
    source, text, _ = route(topic, variant, {})
    print(f'Ghost reply {topic}/{variant}: {source} -> {text}')
    source, text, _ = route(topic, variant, {}, name='Emma')
    print(f'Allowlisted name: {source} -> {text}')

"""Local reviewed performance library. Nothing is approved by generation alone."""
import hashlib
import json
from pathlib import Path

from replies import REPLIES
from voice import MAX_REPLY_WAV, validate_reply_wave

MAX_MANIFEST = 128 * 1024
MAX_ENTRIES = 80


def digest(data):
    return hashlib.sha256(data).hexdigest()


def catalog_text(topic, variant):
    if type(topic) is not int or type(variant) is not int or not 0 <= topic < len(REPLIES) or not 0 <= variant < len(REPLIES[topic]):
        raise ValueError('Unknown reply ID.')
    return REPLIES[topic][variant]


class Library:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.manifest = self.directory / 'manifest.json'

    def entries(self):
        if not self.manifest.exists():
            return []
        if self.manifest.stat().st_size > MAX_MANIFEST:
            raise ValueError('Recording manifest is too large.')
        data = json.loads(self.manifest.read_text(encoding='utf-8'))
        if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('entries'), list) or len(data['entries']) > MAX_ENTRIES:
            raise ValueError('Invalid recording manifest.')
        return data['entries']

    def lookup(self, topic, variant, text):
        result = self.lookup_details(topic, variant, text)
        return result[0] if result is not None else None

    def lookup_details(self, topic, variant, text):
        """Read and revalidate each time; invalid or unreviewed data is never played."""
        expected = catalog_text(topic, variant)
        if text != expected:
            return None
        try:
            matches = [e for e in self.entries() if isinstance(e, dict) and type(e.get('topic')) is int and type(e.get('variant')) is int and e['topic'] == topic and e['variant'] == variant]
            if len(matches) != 1:
                return None
            entry = matches[0]
            if entry.get('review_status') != 'approved' or entry.get('text') != expected or entry.get('text_sha256') != digest(expected.encode('utf-8')):
                return None
            voice = entry.get('voice')
            if not isinstance(voice, str) or not voice.strip() or len(voice) > 80:
                return None
            name = entry.get('file')
            if not isinstance(name, str) or name != f'{topic}-{variant}.wav':
                return None
            path = self.directory / name
            if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_REPLY_WAV:
                return None
            data = path.read_bytes()
            if entry.get('audio_sha256') != digest(data):
                return None
            validate_reply_wave(data)
            return data, voice
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            return None

    def save(self, entries):
        self.directory.mkdir(parents=True, exist_ok=True)
        if len(entries) > MAX_ENTRIES:
            raise ValueError('Too many recordings.')
        content = json.dumps({'version': 1, 'entries': entries}, ensure_ascii=False, indent=2) + '\n'
        if len(content.encode('utf-8')) > MAX_MANIFEST:
            raise ValueError('Recording manifest is too large.')
        temp = self.directory / 'manifest.tmp'
        temp.write_text(content, encoding='utf-8')
        temp.replace(self.manifest)

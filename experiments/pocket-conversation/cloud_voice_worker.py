"""One bounded optional speech request; checked reply on stdin, key in the environment.

This worker is separate from the older reviewed-catalog ElevenLabs experiment.
It never receives microphone audio, history, or provider endpoint overrides.
"""
import json
import math
import os
import re
import sys
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

from conversation_policy import validate_spoken_reply
from voice_preset import resolve_voice_id

MAX_PCM = 22050 * 8 * 2
MAX_INPUT = 16384
MODELS = frozenset(('eleven_v3', 'eleven_v4'))
# These are owner-selected delivery hints, never text supplied by the visitor.
# Their audible result depends on the selected provider voice and needs audition.
DELIVERIES = {'natural': '', 'whispering': '[whispering] ',
              'dry': '[low, gravelly voice] '}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def validate_config(key, voice_id, model):
    if not isinstance(key, str) or not 1 <= len(key) <= 512 or any(not 33 <= ord(c) <= 126 for c in key):
        raise ValueError('Invalid optional speech configuration.')
    if not isinstance(voice_id, str) or not re.fullmatch(r'[A-Za-z0-9]{10,50}', voice_id):
        raise ValueError('Invalid optional speech configuration.')
    if not isinstance(model, str) or model not in MODELS:
        raise ValueError('Invalid optional speech configuration.')


def generate(text, key, voice_id, model='eleven_v3', delivery='natural', timeout=10, opener=None):
    """Return raw signed PCM only after one complete, bounded HTTPS response."""
    validate_spoken_reply(text)
    validate_config(key, voice_id, model)
    if not isinstance(delivery, str) or delivery not in DELIVERIES:
        raise ValueError('Invalid speech delivery.')
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not math.isfinite(timeout) or not 0 < timeout <= 10:
        raise ValueError('Invalid speech deadline.')
    url = 'https://api.elevenlabs.io/v1/text-to-speech/' + voice_id + '?output_format=pcm_22050'
    body = json.dumps({'text': DELIVERIES[delivery] + text, 'model_id': model}).encode('utf-8')
    request = Request(url, data=body, headers={
        'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/pcm'}, method='POST')
    client = opener if opener is not None else build_opener(ProxyHandler({}), NoRedirect())
    try:
        with client.open(request, timeout=timeout) as response:
            if response.status != 200:
                raise ValueError('Online speech response rejected.')
            content_type = response.headers.get('Content-Type', '').split(';', 1)[0].strip().lower()
            if content_type not in ('audio/pcm', 'audio/x-pcm', 'audio/raw', 'application/octet-stream'):
                raise ValueError('Online speech response rejected.')
            if response.headers.get('Content-Encoding', 'identity').lower() not in ('', 'identity'):
                raise ValueError('Online speech response rejected.')
            length = response.headers.get('Content-Length')
            if length is not None and (not length.isascii() or not length.isdecimal() or not 0 < int(length) <= MAX_PCM):
                raise ValueError('Online speech response rejected.')
            pcm = response.read(MAX_PCM + 1)
        if not isinstance(pcm, bytes) or not 0 < len(pcm) <= MAX_PCM or len(pcm) % 2:
            raise ValueError('Online speech audio rejected.')
        if length is not None and len(pcm) != int(length):
            raise ValueError('Online speech audio rejected.')
        return pcm
    except Exception:
        # Provider exceptions can contain URLs, response text, or the request key.
        # The parent receives only failure, never those details.
        raise RuntimeError('Online speech request failed.') from None


def main():
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT + 1)
        if len(raw) > MAX_INPUT:
            raise ValueError('Oversized speech request.')
        value = json.loads(raw)
        if not isinstance(value, dict) or set(value) != {'text', 'voice_id', 'model', 'delivery', 'timeout'}:
            raise ValueError('Invalid speech request.')
        voice_id = resolve_voice_id(value['voice_id'], value['model'], MODELS)
        pcm = generate(value['text'], os.environ.get('SKELLY_ELEVENLABS_API_KEY', ''),
                       voice_id, value['model'], value['delivery'], value['timeout'])
        sys.stdout.buffer.write(pcm)
    except Exception:
        # No provider response, credential, visitor text, or traceback is logged.
        sys.exit(1)


if __name__ == '__main__':
    main()

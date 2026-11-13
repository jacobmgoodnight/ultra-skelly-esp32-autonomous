"""One bounded ElevenLabs request. Approved text arrives over stdin, never argv."""
import json
import os
import re
import sys
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

MAX_PCM = 22050 * 8 * 2
DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb'  # ElevenLabs' documented George voice.


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward a key to a different destination.


def generate(text, key, voice_id, opener=None):
    if not isinstance(text, str) or not 0 < len(text) <= 180 or any(ord(c) < 32 for c in text):
        raise ValueError('Invalid speech text')
    if not isinstance(key, str) or not 1 <= len(key) <= 512 or any(ord(c) < 33 or ord(c) > 126 for c in key):
        raise ValueError('Invalid API key')
    if not re.fullmatch(r'[A-Za-z0-9]{10,50}', voice_id):
        raise ValueError('Invalid voice ID')
    url = 'https://api.elevenlabs.io/v1/text-to-speech/' + voice_id + '?output_format=pcm_22050'
    payload = json.dumps({'text': '[mischievously] ' + text, 'model_id': 'eleven_v3'}).encode('utf-8')
    request = Request(url, data=payload, headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/pcm'})
    client = opener or build_opener(ProxyHandler({}), NoRedirect())
    with client.open(request, timeout=10) as response:
        pcm = response.read(MAX_PCM + 1)
    if not 0 < len(pcm) <= MAX_PCM or len(pcm) % 2:
        raise ValueError('Invalid or oversized speech audio')
    return pcm


def main():
    try:
        payload = sys.stdin.buffer.read(1025)
        if len(payload) > 1024:
            raise ValueError('Oversized request')
        value = json.loads(payload)
        if not isinstance(value, dict) or set(value) != {'text'}:
            raise ValueError('Invalid request')
        result = generate(value['text'], os.environ.get('SKELLY_ELEVENLABS_API_KEY', ''),
                          os.environ.get('SKELLY_ELEVENLABS_VOICE_ID', DEFAULT_VOICE))
        sys.stdout.buffer.write(result)
    except Exception:
        # Do not expose a provider response, key, URL, or visitor data in logs.
        sys.exit(1)


if __name__ == '__main__':
    main()

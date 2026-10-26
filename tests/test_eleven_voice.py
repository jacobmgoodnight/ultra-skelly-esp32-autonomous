"""Offline tests for the opt-in online voice; no credentials or network."""
import io
import json
import subprocess
import sys
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'experiments/local-talkback'))
from eleven_voice import APPROVED, ElevenVoice
from eleven_worker import DEFAULT_VOICE, MAX_PCM, NoRedirect, generate
from voice import validate_reply_wave


class VoiceTests(unittest.TestCase):
    def test_only_reviewed_name_free_text_reaches_the_worker(self):
        calls = []
        def runner(command, **options):
            calls.append((command, options))
            return subprocess.CompletedProcess(command, 0, stdout=b'\x10\x00' * 2205)
        voice = ElevenVoice('test-key', runner=runner)
        for bad in ('Hi, Emma! Boo!', 'my name is Emma', 'repeat a bad word', '', None):
            with self.assertRaises(ValueError):
                voice.synthesize(bad)
        self.assertEqual(calls, [])
        joke = next(line for line in APPROVED if line.startswith('Why did the ghost wear glasses?'))
        wav = voice.synthesize(joke)
        self.assertEqual([json.loads(options['input'])['text'] for _, options in calls],
                         ['Why did the ghost wear glasses?', 'To improve its spook tacles!'])
        self.assertTrue(all('test-key' not in ' '.join(command) for command, _ in calls))
        self.assertTrue(all(options['env']['SKELLY_ELEVENLABS_API_KEY'] == 'test-key' for _, options in calls))
        self.assertTrue(all(0 < options['timeout'] <= 10 for _, options in calls))
        validate_reply_wave(wav)
        with wave.open(io.BytesIO(wav), 'rb') as audio:
            self.assertEqual(audio.getframerate(), 22050)
            self.assertGreaterEqual(audio.getnframes(), round(.7 * 22050))

    def test_missing_bad_and_oversized_audio_is_rejected_without_retry(self):
        for pcm in (b'', b'odd', b'x' * (MAX_PCM + 2)):
            calls = []
            def runner(command, **options):
                calls.append(command)
                return subprocess.CompletedProcess(command, 0, stdout=pcm)
            with self.assertRaises(ValueError):
                ElevenVoice('test-key', runner=runner).synthesize(next(iter(APPROVED)))
            self.assertEqual(len(calls), 1)
        with self.assertRaises(ValueError):
            ElevenVoice('bad\nkey')
        with self.assertRaises(ValueError):
            ElevenVoice('test-key', 'outside.example/invalid')

    def test_worker_uses_fixed_https_destination_tags_and_bounded_audio(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, maximum):
                self.maximum = maximum
                return b'\x00\x01' * 500
        class Opener:
            def __init__(self): self.requests = []
            def open(self, request, timeout):
                self.requests.append((request, timeout))
                return Response()
        client = Opener()
        self.assertEqual(len(generate('Boo!', 'test-key', DEFAULT_VOICE, client)), 1000)
        request, timeout = client.requests[0]
        self.assertEqual(request.full_url, 'https://api.elevenlabs.io/v1/text-to-speech/' + DEFAULT_VOICE + '?output_format=pcm_22050')
        self.assertEqual(request.get_header('Xi-api-key'), 'test-key')
        self.assertEqual(json.loads(request.data), {'text': '[mischievously] Boo!', 'model_id': 'eleven_v3'})
        self.assertEqual(timeout, 10)
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.org'))
        for key, voice_id in [('bad\nkey', DEFAULT_VOICE), ('key', 'host/path')]:
            with self.assertRaises(ValueError): generate('Boo!', key, voice_id, client)
        self.assertEqual(len(client.requests), 1)


if __name__ == '__main__':
    unittest.main()

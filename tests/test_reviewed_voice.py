import base64
import io
import json
import sys
import tempfile
import threading
import unittest
import wave
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'experiments/local-talkback'))
import companion
from recordings import Library, catalog_text
from review_library import stage, approve, STARTER


def sample():
    out = io.BytesIO()
    with wave.open(out, 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(22050)
        audio.writeframes(b'\x01\x00' * 2205)
    return out.getvalue()


class VoiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.library = Library(self.root / 'library')
        self.source = self.root / 'candidate.wav'
        self.source.write_bytes(sample())

    def tearDown(self): self.temp.cleanup()

    def make_approved(self, topic=1, variant=0):
        entry = stage(self.library, topic, variant, self.source, 'Qwen E', 'playful')
        self.assertIsNone(self.library.lookup(topic, variant, catalog_text(topic, variant)))
        approve(self.library, topic, variant, entry['audio_sha256'])
        return entry

    def test_review_and_tampering_fail_closed(self):
        entry = self.make_approved()
        text = catalog_text(1, 0)
        self.assertEqual(self.library.lookup(1, 0, text), sample())
        self.assertIsNone(self.library.lookup(1, 0, 'Hi, Emma! ' + text))
        self.assertIsNone(self.library.lookup(1, 1, catalog_text(1, 1)))
        for key, value in [('text', text + '!'), ('text_sha256', '0' * 64), ('audio_sha256', '0' * 64),
                           ('review_status', 'unreviewed'), ('file', '../candidate.wav')]:
            altered = dict(entry, review_status='approved'); altered[key] = value
            self.library.save([altered])
            self.assertIsNone(self.library.lookup(1, 0, text), key)
        self.library.save([dict(entry, review_status='approved')] * 2)
        self.assertIsNone(self.library.lookup(1, 0, text))
        self.library.save([dict(entry, review_status='approved')])
        (self.library.directory / '1-0.wav').write_bytes(sample() + b'x')
        self.assertIsNone(self.library.lookup(1, 0, text))
        (self.library.directory / '1-0.wav').unlink()
        self.assertIsNone(self.library.lookup(1, 0, text))

    def test_reapproval_and_invalid_audio(self):
        entry = stage(self.library, 1, 0, self.source, 'E', 'spooky')
        with self.assertRaises(ValueError): approve(self.library, 1, 0, '0' * 64)
        self.source.write_bytes(b'not a wav')
        with self.assertRaises(ValueError): stage(self.library, 1, 0, self.source, 'E', 'spooky')
        self.assertIsNone(self.library.lookup(1, 0, catalog_text(1, 0)))
        self.assertEqual(len(STARTER), 16)
        self.assertEqual(len(set(STARTER)), 16)
        self.assertTrue(all(catalog_text(*pair) for pair in STARTER))

    def test_route_exact_ids_and_fallback(self):
        self.make_approved(3, 1)
        class Synth:
            label = 'Piper Joe · local neural voice'
            def synthesize(self, text, work): return b'fallback:' + text.encode()
        engine = companion.Engines.__new__(companion.Engines)
        engine.recordings, engine.voice, engine.eleven_voice = self.library, Synth(), None
        text = catalog_text(3, 1)
        recorded = engine.render_reply(3, 1, text, 'local', self.root)
        self.assertEqual(base64.b64decode(recorded['audio']), sample())
        self.assertEqual(recorded['variant'], 1)
        self.assertIn('Qwen E', recorded['source'])
        for card, variant, spoken, mode in [(3, 0, catalog_text(3, 0), 'local'), (3, 1, 'Hi, Emma! ' + text, 'local'), (3, 1, text, 'fallback')]:
            result = engine.render_reply(card, variant, spoken, mode, self.root)
            self.assertTrue(base64.b64decode(result['audio']).startswith(b'fallback:'))

    def test_selection_keeps_deck_identity(self):
        class Deck:
            def next(self, topic): return topic, 3, catalog_text(topic, 3)
            def next_joke(self): return 2, 2, catalog_text(2, 2)
        self.assertEqual(companion.selected_reply('ghost', '{"card":3}', Deck()), (3, 3, catalog_text(3, 3)))
        self.assertEqual(companion.selected_reply('another joke', '{"card":3}', Deck()), (2, 2, catalog_text(2, 2)))

    def test_preview_requires_token_and_known_mode(self):
        class Engines:
            voice = None
            eleven_voice = None
            def preview(self, mode):
                if mode not in ('local', 'fallback'): raise ValueError('Choose a local voice for preview.')
                return {'card': 1, 'variant': 0, 'text': catalog_text(1, 0), 'source': mode, 'audio': base64.b64encode(sample()).decode()}
        with ThreadingHTTPServer(('127.0.0.1', 0), companion.make_handler(Engines(), 0)) as server:
            port = server.server_address[1]
            server.RequestHandlerClass = companion.make_handler(Engines(), port)
            thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
            def request(method, path, headers=None):
                conn = HTTPConnection('127.0.0.1', port, timeout=3)
                conn.request(method, path, headers=headers or {})
                response = conn.getresponse(); status, body = response.status, response.read(); conn.close()
                return status, json.loads(body)
            try:
                self.assertEqual(request('POST', '/api/preview')[0], 403)
                token = request('GET', '/api/status')[1]['token']
                headers = {'X-Skelly-Token': token}
                for mode in ('local', 'fallback'):
                    status, body = request('POST', '/api/preview', {**headers, 'X-Skelly-Voice': mode})
                    self.assertEqual(status, 200); self.assertEqual((body['card'], body['variant'], body['source']), (1, 0, mode))
                self.assertEqual(request('POST', '/api/preview', {**headers, 'X-Skelly-Voice': 'elevenlabs'})[0], 400)
                self.assertEqual(request('POST', '/api/preview', {**headers, 'Origin': 'https://evil.example'})[0], 403)
            finally:
                server.shutdown(); thread.join()


if __name__ == '__main__': unittest.main()

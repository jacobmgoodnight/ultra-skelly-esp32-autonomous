"""Local operator status reports configuration state without exposing secrets."""
import json
import os
import sys
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1] / 'experiments/pocket-conversation'
sys.path.insert(0, str(HERE))
import server
import chat_server


class StatusTests(unittest.TestCase):
    def test_account_free_voice_does_not_load_pocket_assets_and_keeps_guard(self):
        with patch.object(chat_server, 'load_assets', side_effect=AssertionError('Pocket assets must not load')):
            voice = chat_server.ConversationalVoice(HERE / 'missing-tools', pocket=False)
        self.assertEqual(voice.available_tones, ['natural'])
        voice.validate_text('Welcome to the party!')
        with self.assertRaises(ValueError):
            voice.validate_text('I will kill you.')

    def test_owner_identity_and_invalid_optional_config_are_reported(self):
        voice = SimpleNamespace(label='local', available_tones=['natural'])
        engine = SimpleNamespace(voice=voice, local_voice=voice, conversation=True,
            cloud_brain=None, cloud_voice=None, cloud_config_issue={'brain': True, 'voice': False},
            brain=SimpleNamespace(label='local', loaded=False))
        with ThreadingHTTPServer(('127.0.0.1', 0), server.make_handler(engine, 0)) as http:
            port = http.server_address[1]
            http.RequestHandlerClass = server.make_handler(engine, port)
            thread = threading.Thread(target=http.serve_forever, daemon=True)
            thread.start()
            try:
                connection = HTTPConnection('127.0.0.1', port, timeout=3)
                connection.request('GET', '/api/status')
                response = connection.getresponse()
                result = json.loads(response.read())
                self.assertEqual(response.status, 200)
                self.assertEqual(result['processId'], os.getpid())
                self.assertFalse(result['modelLoaded'])
                self.assertTrue(result['cloud']['brainIssue'])
                self.assertFalse(result['cloud']['voiceIssue'])
                connection.close()
            finally:
                http.shutdown()
                thread.join()


if __name__ == '__main__':
    unittest.main()

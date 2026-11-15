"""Opt-in cloud routing boundaries with synthetic HTTP and mocked engines only."""
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import sys
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import wave

HERE = Path(__file__).resolve().parents[1] / 'experiments/pocket-conversation'
sys.path[:0] = [str(HERE), str(HERE.parent / 'local-talkback')]
import chat_server
import cloud_worker
import conversation_policy
import server
from pocket_voice import Cancelled


def silent_wave():
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b'\x00\x00' * 1600)
    return output.getvalue()


class RoutingHTTPTests(unittest.TestCase):
    def setUp(self):
        self.local_voice = SimpleNamespace(label='Local synthetic test voice', available_tones=['haunt-dry', 'natural'])
        self.engines = SimpleNamespace(conversation=True, voice=self.local_voice, local_voice=self.local_voice,
            brain=SimpleNamespace(label='Local synthetic test brain'),
            cloud_brain=SimpleNamespace(label='Claude synthetic test', api_key='private-test-brain-key'),
            cloud_voice=SimpleNamespace(label='ElevenLabs synthetic test', api_key='private-test-voice-key', voice_id='private-test-voice-id'),
            memory=SimpleNamespace(forget=Mock()), phase='idle', thinking_cues=[],
            respond=Mock(return_value={'text': 'A synthetic reply.', 'source': 'pocket-haunt-dry'}))
        self.turns = server.Turns()
        self.http = ThreadingHTTPServer(('127.0.0.1', 0), BaseHTTPRequestHandler)
        self.http.RequestHandlerClass = server.make_handler(self.engines, self.http.server_port, self.turns)
        self.thread = threading.Thread(target=self.http.serve_forever, kwargs={'poll_interval': .02}, daemon=True)
        self.thread.start()
        self.addCleanup(self.close)
        status, data = self.request('/api/status', method='GET', token=False)
        self.assertEqual(status, 200)
        self.token = data['token']
        self.identity = 0

    def close(self):
        self.http.shutdown()
        self.thread.join(timeout=2)
        self.http.server_close()

    def request(self, path='/api/reply', *, method='POST', headers=None, token=True, body=None):
        values = {'Origin': 'http://127.0.0.1:' + str(self.http.server_port)}
        if token:
            values['X-Skelly-Token'] = self.token
        if path == '/api/reply':
            self.identity += 1
            values.update({'Content-Type': 'audio/wav', 'X-Skelly-Turn': f'synthetic-turn-{self.identity:016d}',
                'X-Skelly-Session': 'synthetic-session-0001', 'X-Skelly-Personality': 'friendly'})
            body = silent_wave() if body is None else body
        if headers:
            values.update(headers)
        connection = HTTPConnection('127.0.0.1', self.http.server_port, timeout=3)
        try:
            connection.request(method, path, body=body, headers=values)
            response = connection.getresponse()
            return response.status, json.loads(response.read())
        finally:
            connection.close()

    def test_configured_services_do_not_change_local_default_or_forward_cloud_kwargs(self):
        status, _ = self.request()
        self.assertEqual(status, 200)
        self.engines.respond.assert_called_once()
        self.assertEqual(self.engines.respond.call_args.kwargs,
            {'session': 'synthetic-session-0001', 'profile': 'friendly', 'tone': 'haunt-dry'})

    def test_status_checks_are_local_and_reveal_only_configured_labels(self):
        # A concurrent cloud turn must not make the default voice label cloud.
        self.engines.voice = self.engines.cloud_voice
        status, data = self.request('/api/status', method='GET')
        self.assertEqual(status, 200)
        self.assertEqual(data['voice'], self.local_voice.label)
        self.assertEqual(data['brain'], self.engines.brain.label)
        self.assertEqual(data['cloud'], {'brain': True, 'voice': True, 'brainIssue': False, 'voiceIssue': False,
            'brainLabel': 'Claude synthetic test', 'voiceLabel': 'ElevenLabs synthetic test'})
        for private in ('private-test-brain-key', 'private-test-voice-key', 'private-test-voice-id', 'api_key', 'voice_id'):
            self.assertNotIn(private, json.dumps(data))
        self.engines.respond.assert_not_called()

    def test_invalid_consent_or_modes_are_rejected_before_recognition_or_dispatch(self):
        cases = [
            {'X-Skelly-Brain': 'cloud'},
            {'X-Skelly-Voice': 'elevenlabs'},
            {'X-Skelly-Brain': 'cloud', 'X-Skelly-Cloud-Consent': 'true'},
            {'X-Skelly-Brain': 'cloud', 'X-Skelly-Cloud-Consent': 'Yes'},
            {'X-Skelly-Brain': 'remote', 'X-Skelly-Cloud-Consent': 'yes'},
            {'X-Skelly-Voice': 'cloud', 'X-Skelly-Cloud-Consent': 'yes'},
            {'X-Skelly-Delivery': 'screaming'},
        ]
        for headers in cases:
            with self.subTest(headers=headers):
                self.assertEqual(self.request(headers=headers)[0], 400)
        self.engines.respond.assert_not_called()
        self.assertIsNone(self.turns.active)

    def test_unconfigured_services_are_rejected_with_consent_before_recognition(self):
        self.engines.cloud_brain = self.engines.cloud_voice = None
        for headers in ({'X-Skelly-Brain': 'cloud'}, {'X-Skelly-Voice': 'elevenlabs'}):
            self.assertEqual(self.request(headers={**headers, 'X-Skelly-Cloud-Consent': 'yes'})[0], 400)
        self.engines.respond.assert_not_called()

    def test_cloud_text_and_cloud_voice_can_be_selected_independently(self):
        for brain, voice, delivery in (('cloud', 'local', 'natural'), ('local', 'elevenlabs', 'whispering'), ('cloud', 'elevenlabs', 'dry')):
            with self.subTest(brain=brain, voice=voice):
                status, _ = self.request(headers={'X-Skelly-Brain': brain, 'X-Skelly-Voice': voice,
                    'X-Skelly-Delivery': delivery, 'X-Skelly-Cloud-Consent': 'yes'})
                self.assertEqual(status, 200)
                self.assertEqual(self.engines.respond.call_args.kwargs, {'session': 'synthetic-session-0001',
                    'profile': 'friendly', 'tone': 'haunt-dry', 'brain_mode': brain, 'voice_mode': voice,
                    'cloud_consent': True, 'delivery': delivery})
        self.assertEqual(self.engines.respond.call_count, 3)

    def test_cloud_selection_preserves_token_origin_and_prearrival_cancellation(self):
        cloud = {'X-Skelly-Brain': 'cloud', 'X-Skelly-Cloud-Consent': 'yes'}
        for headers, token in (({'X-Skelly-Token': 'incorrect'}, True), ({}, False), ({'Origin': 'https://untrusted.invalid'}, True)):
            self.assertEqual(self.request(headers={**cloud, **headers}, token=token)[0], 403)
        identity = 'synthetic-prearrival-cancel'
        self.assertEqual(self.request('/api/cancel', headers={'X-Skelly-Turn': identity}, body=b'')[0], 200)
        self.assertEqual(self.request(headers={**cloud, 'X-Skelly-Turn': identity})[0], 409)
        self.engines.respond.assert_not_called()


class CloudSelectionTests(unittest.TestCase):
    def test_constructor_keeps_keys_in_cloud_clients_and_removes_them_before_local_initialization(self):
        settings = {'SKELLY_ANTHROPIC_API_KEY': 'synthetic-brain-key',
            'SKELLY_ELEVENLABS_API_KEY': 'synthetic-voice-key',
            'SKELLY_ELEVENLABS_VOICE_ID': 'SyntheticVoice1234567',
            'SKELLY_ANTHROPIC_MODEL': 'claude-haiku-5-5',
            'SKELLY_ELEVENLABS_MODEL': 'eleven_v3',
            'SKELLY_TEST_UNRELATED_SETTING': 'preserved'}
        initialized = []
        def local_init(name, result=None):
            def initialize(*args, **kwargs):
                self.assertNotIn('SKELLY_ANTHROPIC_API_KEY', os.environ)
                self.assertNotIn('SKELLY_ELEVENLABS_API_KEY', os.environ)
                self.assertEqual(os.environ['SKELLY_TEST_UNRELATED_SETTING'], 'preserved')
                initialized.append(name)
                return result
            return initialize
        with patch.dict(os.environ, settings), \
                patch.object(server.Engines, '__init__', side_effect=local_init('base')), \
                patch.object(chat_server, 'ConversationalVoice', side_effect=local_init('voice', Mock())), \
                patch.object(chat_server, 'LocalBrain', side_effect=local_init('brain', Mock())), \
                patch.object(chat_server, 'load_previews', return_value={}), \
                patch.object(chat_server, 'load_cues', return_value=[]), \
                patch('socket.socket', side_effect=AssertionError('No network in configuration checks')):
            engine = chat_server.Engines()
            self.assertIsNotNone(engine.cloud_brain)
            self.assertIsNotNone(engine.cloud_voice)
            self.assertEqual(engine.cloud_brain._key, settings['SKELLY_ANTHROPIC_API_KEY'])
            self.assertEqual(engine.cloud_voice.key, settings['SKELLY_ELEVENLABS_API_KEY'])
            self.assertNotIn('SKELLY_ANTHROPIC_API_KEY', os.environ)
            self.assertNotIn('SKELLY_ELEVENLABS_API_KEY', os.environ)
            self.assertEqual(os.environ['SKELLY_ELEVENLABS_VOICE_ID'], settings['SKELLY_ELEVENLABS_VOICE_ID'])
        self.assertEqual(initialized, ['base', 'voice', 'brain'])

    def engine(self):
        value = object.__new__(chat_server.Engines)
        value.local_voice = SimpleNamespace(available_tones=['haunt-dry', 'natural'], tone='haunt-dry')
        value.voice = value.local_voice
        value.brain = Mock(loaded=True)
        value.cloud_brain = Mock(loaded=True)
        value.cloud_voice = Mock()
        value.memory = conversation_policy.Memory()
        value.deck = chat_server.companion.ReplyDeck()
        value.phase = 'idle'
        return value

    def test_temporary_engine_selection_restores_after_success_or_error(self):
        for brain_mode, voice_mode in (('local', 'local'), ('cloud', 'local'), ('local', 'elevenlabs'), ('cloud', 'elevenlabs')):
            for fails in (False, True):
                with self.subTest(brain=brain_mode, voice=voice_mode, fails=fails):
                    engine = self.engine()
                    def dispatch(*args):
                        self.assertIs(engine.turn_brain, engine.cloud_brain if brain_mode == 'cloud' else engine.brain)
                        self.assertIs(engine.voice, engine.cloud_voice if voice_mode == 'elevenlabs' else engine.local_voice)
                        if voice_mode == 'elevenlabs':
                            self.assertEqual(engine.voice.delivery, 'dry')
                        if fails:
                            raise RuntimeError('synthetic failure')
                        return {'synthetic': True}
                    with patch.object(server.Engines, 'respond', side_effect=dispatch) as respond:
                        if fails:
                            with self.assertRaisesRegex(RuntimeError, 'synthetic failure'):
                                engine.respond(b'synthetic', threading.Event(), session='synthetic',
                                    brain_mode=brain_mode, voice_mode=voice_mode, cloud_consent=True, delivery='dry')
                        else:
                            self.assertEqual(engine.respond(b'synthetic', threading.Event(), session='synthetic',
                                brain_mode=brain_mode, voice_mode=voice_mode, cloud_consent=True, delivery='dry'), {'synthetic': True})
                        respond.assert_called_once()
                    self.assertIs(engine.voice, engine.local_voice)
                    self.assertIs(engine.turn_brain, engine.brain)
                    self.assertEqual(engine.phase, 'idle')

    def test_direct_unconfigured_unconsented_and_invalid_modes_fail_before_base_respond(self):
        cases = ({'brain_mode': 'cloud'}, {'voice_mode': 'elevenlabs'}, {'brain_mode': 'unknown'},
            {'voice_mode': 'unknown'}, {'delivery': 'unknown'})
        for kwargs in cases:
            with self.subTest(kwargs=kwargs):
                engine = self.engine()
                with patch.object(server.Engines, 'respond') as respond, self.assertRaises(ValueError):
                    engine.respond(b'synthetic', threading.Event(), **kwargs)
                respond.assert_not_called()
        for mode, name in (('brain_mode', 'cloud_brain'), ('voice_mode', 'cloud_voice')):
            engine = self.engine()
            setattr(engine, name, None)
            with patch.object(server.Engines, 'respond') as respond, self.assertRaises(ValueError):
                engine.respond(b'synthetic', threading.Event(), **{mode: 'cloud' if mode == 'brain_mode' else 'elevenlabs', 'cloud_consent': True})
            respond.assert_not_called()

    def test_model_source_records_actual_dispatch_and_reviewed_branches_avoid_provider(self):
        for cloud in (False, True):
            engine = self.engine()
            active = engine.cloud_brain if cloud else engine.brain
            engine.turn_brain = active
            active.reply.return_value = 'A robot could help your garden! What would you ask it to plant?'
            decision = engine.select_reply('I like building robots.', threading.Event(), time.monotonic() + 10, 'synthetic')
            self.assertEqual(decision['brainSource'], 'claude' if cloud else 'local')
            active.reply.assert_called_once()
            (engine.brain if cloud else engine.cloud_brain).reply.assert_not_called()
            active.reset_mock()
            reviewed = engine.select_reply('Goodbye.', threading.Event(), time.monotonic() + 10, 'synthetic')
            self.assertEqual(reviewed['brainSource'], 'reviewed')
            active.reply.assert_not_called()

    def test_failed_or_rejected_cloud_reply_never_retries_local_or_calls_paid_voice(self):
        for failure in (TimeoutError('synthetic timeout'), ValueError('synthetic output'), RuntimeError('private provider details')):
            engine = self.engine()
            engine.turn_brain = engine.cloud_brain
            engine.voice = engine.cloud_voice
            engine.cloud_brain.reply.side_effect = failure
            with self.assertRaisesRegex(RuntimeError, r'^Cloud conversation failed\. Nothing played\.$'):
                engine.select_reply('I like building robots.', threading.Event(), time.monotonic() + 10, 'synthetic')
            engine.cloud_brain.reply.assert_called_once()
            engine.brain.reply.assert_not_called()
            engine.cloud_voice.synthesize.assert_not_called()
            self.assertEqual(engine.memory.snapshot('synthetic')[1], [])
        engine = self.engine()
        engine.turn_brain = engine.cloud_brain
        engine.cloud_brain.reply.return_value = '<script>invalid</script>'
        with self.assertRaisesRegex(RuntimeError, 'Cloud conversation failed'):
            engine.select_reply('I like building robots.', threading.Event(), time.monotonic() + 10, 'synthetic')
        engine.brain.reply.assert_not_called()
        engine.cloud_voice.synthesize.assert_not_called()

    def test_cloud_cancellation_propagates_without_fallback(self):
        engine = self.engine()
        engine.turn_brain = engine.cloud_brain
        engine.cloud_brain.reply.side_effect = Cancelled()
        with self.assertRaises(Cancelled):
            engine.select_reply('I like building robots.', threading.Event(), time.monotonic() + 10, 'synthetic')
        engine.brain.reply.assert_not_called()
        engine.cloud_voice.synthesize.assert_not_called()


class CloudBrainRequestHeaders(unittest.TestCase):
    """The Messages API reads API keys from x-api-key; Bearer is only for OAuth tokens."""

    def test_api_key_is_sent_as_x_api_key_not_bearer(self):
        captured = []

        class Opener:
            def open(self, request, timeout):
                captured.append(request)
                raise RuntimeError('stop after capturing the request')

        payload = {'question': False, 'timeoutSeconds': 5}
        with patch.object(cloud_worker, 'build_request_body', return_value={'model': 'claude-haiku-5-5'}):
            with self.assertRaises(RuntimeError):
                cloud_worker.request_brain(payload, 'synthetic-brain-key', opener=Opener())
        request = captured[0]
        self.assertEqual(request.get_header('X-api-key'), 'synthetic-brain-key')
        self.assertIsNone(request.get_header('Authorization'))
        self.assertEqual(request.get_header('Anthropic-version'), '2026-10-21')


if __name__ == '__main__':
    unittest.main()

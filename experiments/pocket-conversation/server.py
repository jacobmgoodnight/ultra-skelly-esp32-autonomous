"""Isolated attended companion; Piper by default, --pocket opts into synthetic E."""
import argparse
import base64
from collections import deque
import json
import os
import re
import secrets
import sys
import tempfile
import threading
import time
from http.server import ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'local-talkback'))
import companion
from pocket_voice import Cancelled, GuardedVoice, check, run_process
from cloud_brain import CloudBrain
from cloud_voice import CloudVoice
from cloud_worker import MODELS as CLOUD_BRAIN_MODELS
from cloud_voice_worker import MODELS as CLOUD_VOICE_MODELS


CLOUD_CONFIG_FIELDS = frozenset(('anthropicKey', 'anthropicModel', 'elevenlabsKey',
    'elevenlabsVoiceId', 'elevenlabsModel'))


def cloud_config_values(raw):
    """Reject ambiguous or unexpected configuration without including its values."""
    def unique_object(pairs):
        result = {}
        for name, value in pairs:
            if name in result:
                raise ValueError('Invalid cloud configuration.')
            result[name] = value
        return result
    value = json.loads(raw.decode('utf-8'), object_pairs_hook=unique_object)
    if not isinstance(value, dict) or not value or set(value) - CLOUD_CONFIG_FIELDS:
        raise ValueError('Invalid cloud configuration.')
    if any(not isinstance(item, str) for item in value.values()):
        raise ValueError('Invalid cloud configuration.')
    if value.get('anthropicModel', 'claude-haiku-5-5') not in CLOUD_BRAIN_MODELS:
        raise ValueError('Invalid cloud configuration.')
    if value.get('elevenlabsModel', 'eleven_v3') not in CLOUD_VOICE_MODELS:
        raise ValueError('Invalid cloud configuration.')
    return value


class Turns:
    """Serialize turns and remember bounded cancellation IDs, including pre-arrivals."""
    def __init__(self):
        self.lock = threading.Lock()
        self.recent = deque(maxlen=64)
        self.active = None

    def begin(self, identity):
        with self.lock:
            if identity in self.recent:
                raise Cancelled('Turn already cancelled or completed.')
            if self.active is not None:
                raise BlockingIOError('Another phrase is still processing. Wait, then try again.')
            cancel = threading.Event()
            self.active = identity, cancel
            return cancel

    def cancel(self, identity):
        with self.lock:
            if identity not in self.recent:
                self.recent.append(identity)
            if self.active is not None and self.active[0] == identity:
                self.active[1].set()

    def finish(self, identity):
        with self.lock:
            if self.active is not None and self.active[0] == identity:
                self.active = None
            if identity not in self.recent:
                self.recent.append(identity)

    def stop(self):
        with self.lock:
            if self.active is not None:
                self.active[1].set()


class Engines(companion.Engines):
    conversation = False
    def __init__(self, pocket=False):
        super().__init__()
        self.eleven_voice = None  # This separate experiment is entirely local.
        self.voice = GuardedVoice(companion.TOOLS, pocket=pocket)

    def select_reply(self, transcript, cancel, deadline, session=None, profile='friendly'):
        try:
            model_output = self.choose(transcript)
        except Exception:
            model_output = ''
        check(cancel, deadline)
        card, text = companion.approved_reply(transcript, model_output, self.deck, include_name=True)
        return {'card': card, 'text': text}

    def remember_reply(self, decision, transcript, session):
        pass

    def respond(self, data, cancel, session=None, profile='friendly'):
        companion.validate_wave(data)
        started = time.monotonic()
        # Recognition and ID selection retain their existing individual bounds.
        turn_deadline = started + 42
        with tempfile.TemporaryDirectory(prefix='skelly-pocket-turn-') as folder:
            work = Path(folder)
            source, output = work / 'input.wav', work / 'transcript'
            source.write_bytes(data)
            run_process([str(self.whisper), '-m', str(companion.TOOLS / 'ggml-tiny.en.bin'),
                '-f', str(source), '-l', 'en', '-t', '4', '-nt', '-np', '-otxt', '-of', str(output)],
                cancel=cancel, deadline=min(turn_deadline, time.monotonic() + 20))
            transcript_path = output.with_suffix('.txt')
            if not transcript_path.is_file() or transcript_path.stat().st_size > 4096:
                raise ValueError('No usable phrase was recognized. Try again.')
            transcript = transcript_path.read_text(encoding='utf-8').strip()[:500]
            if not transcript or not re.search('[a-zA-Z]', transcript):
                raise ValueError('No usable phrase was recognized. Try again.')
            check(cancel, turn_deadline)
            recognition_seconds = time.monotonic() - started
            decision = self.select_reply(transcript, cancel, turn_deadline, session, profile)
            card, text = decision['card'], decision['text']
            if getattr(self, 'family_mode', False):
                from family_conversation import validate_speech
                validate_speech(text)
            synth_started = time.monotonic()
            audio, source_name = self.voice.synthesize(text, work, cancel, min(turn_deadline, synth_started + 10))
            check(cancel, turn_deadline)
            self.remember_reply(decision, transcript, session)
            return {'card': card, 'text': text, 'audio': base64.b64encode(audio).decode('ascii'),
                'source': source_name, 'synthesisSeconds': round(time.monotonic() - synth_started, 3),
                'fallbackReason': self.voice.fallback_reason,
                'responseMode': decision.get('mode', 'catalog'),
                'responseReason': decision.get('reason'),
                'modelSeconds': decision.get('modelSeconds'),
                'recognitionSeconds': round(recognition_seconds, 3),
                'processingSeconds': round(time.monotonic() - started, 3),
                **({'heard': transcript, 'continueConversation': decision.get('continueConversation', True),
                    'brainSource': decision.get('brainSource', 'reviewed')} if self.conversation else {})}


def make_handler(engines, port, turns=None):
    turns = turns or Turns()
    token = secrets.token_urlsafe(32)
    base = companion.make_handler(engines, port)

    class Handler(base):
        def end_headers(self):
            if self.path.split('?', 1)[0] == '/studio/cloud-setup.html':
                self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
            super().end_headers()

        def do_GET(self):
            if not self.trusted():
                return self.send(403, b'{}')
            route = self.path.split('?', 1)[0]
            if route == '/api/status':
                voice = getattr(engines, 'local_voice', engines.voice)
                cloud_brain, cloud_voice = getattr(engines, 'cloud_brain', None), getattr(engines, 'cloud_voice', None)
                return self.send(200, json.dumps({'ready': True, 'token': token, 'processId': os.getpid(),
                    'launcherInstance': getattr(engines, 'launcher_instance', ''),
                    'voice': voice.label, 'elevenlabs': cloud_voice is not None,
                    'cloud': {'brain': cloud_brain is not None, 'voice': cloud_voice is not None,
                        'brainIssue': cloud_brain is None and getattr(engines, 'cloud_config_issue', {}).get('brain', False),
                        'voiceIssue': cloud_voice is None and getattr(engines, 'cloud_config_issue', {}).get('voice', False),
                        'brainLabel': getattr(cloud_brain, 'label', 'Claude · not configured'),
                        'voiceLabel': getattr(cloud_voice, 'label', 'ElevenLabs · not configured')},
                    'conversation': getattr(engines, 'conversation', False),
                    'familyCatalog': getattr(engines, 'family_catalog', False) is True,
                    'brain': getattr(getattr(engines, 'brain', None), 'label', None),
                    'modelLoaded': getattr(getattr(engines, 'brain', None), 'loaded', None),
                    'tones': getattr(voice, 'available_tones', ['natural']),
                    'phase': getattr(engines, 'phase', 'idle'),
                    'thinkingCuesReady': bool(getattr(engines, 'thinking_cues', [])),
                    'replyCount': sum(map(len, companion.REPLIES))}).encode())
            if route == '/api/thinking-cues' and getattr(engines, 'conversation', False):
                return self.send(200, json.dumps({'cues': getattr(engines, 'thinking_cues', [])}).encode())
            if route.startswith('/api/voice-preview/') and getattr(engines, 'conversation', False):
                key = route.removeprefix('/api/voice-preview/').removesuffix('.wav')
                previews = getattr(engines, 'voice_previews', {})
                return self.send(200, previews[key], 'audio/wav') if key in previews else self.send(404, b'{}')
            if route in ('/studio/conversation.html', '/studio/conversation-ui.js'):
                # Only conversation mode (chat_server.py) has a page; standalone has none.
                if not getattr(engines, 'conversation', False):
                    return self.send(404, b'{}')
                name = 'chat.html' if route.endswith('.html') else 'chat-ui.js'
                return self.send(200, (HERE / name).read_bytes(),
                    'text/html; charset=utf-8' if name.endswith('.html') else 'text/javascript')
            if route == '/studio/conversation.js' and getattr(engines, 'conversation', False):
                return self.send(200, (HERE / 'chat-turn.js').read_bytes(), 'text/javascript')
            if route == '/studio/adaptive-mic.js' and getattr(engines, 'conversation', False):
                return self.send(200, (HERE / 'adaptive-mic.js').read_bytes(), 'text/javascript')
            if route == '/studio/live-devices.js' and getattr(engines, 'conversation', False):
                return self.send(200, (HERE / 'live-devices.js').read_bytes(), 'text/javascript')
            if route in ('/studio/cloud-setup.html', '/studio/cloud-setup.js') and getattr(engines, 'conversation', False):
                if '?' in self.path:
                    return self.send(400, b'{}')
                name = route.rsplit('/', 1)[1]
                return self.send(200, (HERE / name).read_bytes(),
                    'text/html; charset=utf-8' if name.endswith('.html') else 'text/javascript')
            return super().do_GET()

        def configure_cloud(self):
            # Browser-only, same-origin handoff. No key is accepted in a URL or
            # returned to the page; this only changes private in-memory clients.
            if (not getattr(engines, 'conversation', False) or '?' in self.path
                    or self.headers.get('Origin') != 'http://' + self.headers.get('Host', '')):
                return self.send(403, b'{}')
            if (self.headers.get('Content-Type') not in ('application/json', 'application/json; charset=utf-8')
                    or self.headers.get('Content-Encoding')
                    or len(self.headers.get_all('Content-Length', [])) != 1):
                return self.send(400, b'{"error":"Invalid cloud configuration request."}')
            length_text = self.headers.get('Content-Length', '')
            if not re.fullmatch(r'[0-9]{1,8}', length_text):
                return self.send(400, b'{"error":"Invalid cloud configuration request."}')
            length = int(length_text)
            if not 2 <= length <= 8192:
                return self.send(413, b'{"error":"Invalid cloud configuration size."}')
            try:
                # An absolute deadline bounds a slowly supplied body. Never
                # hold the engine lock while waiting for client bytes.
                body_deadline = time.monotonic() + 5
                raw = bytearray()
                while len(raw) < length:
                    remaining = body_deadline - time.monotonic()
                    if remaining <= 0:
                        raise TimeoutError('Cloud configuration body timed out.')
                    self.connection.settimeout(remaining)
                    chunk = self.rfile.read1(length - len(raw))
                    if not chunk:
                        raise ValueError('Incomplete cloud configuration.')
                    raw.extend(chunk)
            except Exception:
                return self.send(400, b'{"error":"Invalid cloud configuration request."}')
            finally:
                self.connection.settimeout(5)
            if not turns.lock.acquire(blocking=False):
                return self.send(409, b'{"error":"Wait until Skelly is idle before configuring cloud services."}')
            try:
                if turns.active is not None or getattr(engines, 'phase', 'idle') != 'idle':
                    return self.send(409, b'{"error":"Wait until Skelly is idle before configuring cloud services."}')
                values = cloud_config_values(raw)
                brain = getattr(engines, 'cloud_brain', None)
                voice = getattr(engines, 'cloud_voice', None)
                if values.get('anthropicKey'):
                    brain = CloudBrain(values['anthropicKey'], values.get('anthropicModel', 'claude-haiku-5-5'))
                if values.get('elevenlabsKey'):
                    voice = CloudVoice(values['elevenlabsKey'], values.get('elevenlabsVoiceId', ''),
                        values.get('elevenlabsModel', 'eleven_v3'))
                # Commit both only after every supplied service validates.
                engines.cloud_brain, engines.cloud_voice = brain, voice
                return self.send(200, json.dumps({'configured': True,
                    'cloud': {'brain': brain is not None, 'voice': voice is not None}}).encode())
            except (ValueError, TypeError, UnicodeError):
                return self.send(400, b'{"error":"Cloud configuration was rejected. Check the key, voice ID and model."}')
            except Exception:
                return self.send(400, b'{"error":"Cloud configuration could not be applied."}')
            finally:
                turns.lock.release()

        def do_POST(self):
            if not self.trusted() or self.headers.get('X-Skelly-Token') != token:
                return self.send(403, b'{}')
            if self.headers.get('Transfer-Encoding'):
                return self.send(400, b'{}')
            if self.path.split('?', 1)[0] == '/api/cloud-configure':
                return self.configure_cloud()
            conversational = getattr(engines, 'conversation', False)
            session = self.headers.get('X-Skelly-Session', '')
            profile = self.headers.get('X-Skelly-Personality', 'friendly')
            tone = self.headers.get('X-Skelly-Tone', 'haunt-dry')
            brain_mode = self.headers.get('X-Skelly-Brain', 'local')
            voice_mode = self.headers.get('X-Skelly-Voice', 'local')
            cloud_consent = self.headers.get('X-Skelly-Cloud-Consent') == 'yes'
            delivery = self.headers.get('X-Skelly-Delivery', 'natural')
            conversation_mode = self.headers.get('X-Skelly-Conversation', 'open')
            if self.path == '/api/forget' and conversational:
                if not re.fullmatch(r'[A-Za-z0-9_-]{16,80}', session) or self.headers.get('Content-Length', '0') != '0':
                    return self.send(400, b'{}')
                engines.memory.forget(session)
                return self.send(200, b'{"forgotten":true}')
            if self.path == '/api/shutdown':
                turns.stop()
                self.send(200, b'{"stopping":true}')
                threading.Thread(target=self.server.shutdown, daemon=True).start()
                return
            identity = self.headers.get('X-Skelly-Turn', '')
            if not re.fullmatch(r'[A-Za-z0-9_-]{16,80}', identity):
                return self.send(400, b'{}')
            if self.path == '/api/cancel':
                if self.headers.get('Content-Length', '0') != '0':
                    return self.send(400, b'{}')
                turns.cancel(identity)
                return self.send(200, b'{"cancelled":true}')
            if self.path != '/api/reply' or self.headers.get('Content-Type') != 'audio/wav':
                return self.send(400, b'{}')
            if brain_mode not in ('local', 'cloud') or voice_mode not in ('local', 'elevenlabs') or delivery not in ('natural', 'whispering', 'dry'):
                return self.send(400, b'{}')
            if conversation_mode not in ('open', 'family') or (conversation_mode == 'family' and (not conversational or getattr(engines, 'family_catalog', False) is not True or brain_mode != 'local' or voice_mode != 'local')):
                return self.send(400, b'{}')
            cloud_selected = brain_mode != 'local' or voice_mode != 'local'
            if cloud_selected and (not conversational or not cloud_consent):
                return self.send(400, b'{"error":"Select cloud mode and allow its services for this chat first."}')
            if ((brain_mode == 'cloud' and getattr(engines, 'cloud_brain', None) is None)
                    or (voice_mode == 'elevenlabs' and getattr(engines, 'cloud_voice', None) is None)):
                return self.send(400, b'{"error":"The selected cloud service is not configured on this laptop."}')
            if conversational and conversation_mode == 'open' and profile not in ('friendly', 'mischief'):
                return self.send(400, b'{}')
            if conversational and (not re.fullmatch(r'[A-Za-z0-9_-]{16,80}', session) or profile not in ('friendly', 'mischief', 'guardian', 'storyteller') or tone not in ('haunt-dry', 'haunt-croaky', 'crypt', 'hollow', 'natural')):
                return self.send(400, b'{}')
            try:
                length = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                return self.send(400, b'{}')
            if not 44 < length <= companion.MAX_WAV:
                return self.send(413, b'{}')
            try:
                cancel = turns.begin(identity)
            except Cancelled:
                return self.send(409, b'{"error":"Turn already cancelled or completed."}')
            except BlockingIOError:
                return self.send(409, b'{"error":"Another phrase is still processing. Wait, then try again."}')
            try:
                data = self.rfile.read(length)
                if len(data) != length:
                    raise ValueError('Incomplete audio.')
                check(cancel, float('inf'))
                if conversational and conversation_mode == 'family':
                    result = engines.respond(data, cancel, session=session, profile=profile, tone=tone, conversation_mode='family')
                elif conversational and cloud_selected:
                    result = engines.respond(data, cancel, session=session, profile=profile, tone=tone,
                        brain_mode=brain_mode, voice_mode=voice_mode, cloud_consent=cloud_consent, delivery=delivery)
                else:
                    result = engines.respond(data, cancel, session=session, profile=profile, tone=tone) if conversational else engines.respond(data, cancel)
                check(cancel, float('inf'))
                self.send(200, json.dumps(result).encode())
            except Cancelled:
                self.send(409, b'{"error":"Turn cancelled. Nothing played."}')
            except ValueError as error:
                self.send(400, json.dumps({'error': str(error)}).encode())
            except Exception:
                message = ('Conversation failed or timed out. Nothing played. No automatic retry.' if conversational else
                    'Local speech failed or timed out. Nothing played. No automatic retry.')
                self.send(503, json.dumps({'error': message}).encode())
            finally:
                turns.finish(identity)

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pocket', action='store_true', help='Opt into the locked synthetic E Pocket voice with local fallback.')
    parser.add_argument('--port', type=int, default=8774, choices=range(1024, 65536))
    args = parser.parse_args()
    engines = Engines(pocket=args.pocket)
    turns = Turns()
    try:
        print('Starting isolated local companion. Microphone OFF; no playback.', flush=True)
        engines.start()
        with ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(engines, args.port, turns)) as server:
            server.daemon_threads = False
            print(f'Ready: http://127.0.0.1:{args.port}/ — {engines.voice.label}.', flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                turns.stop()
    finally:
        turns.stop()
        engines.close()


if __name__ == '__main__':
    main()

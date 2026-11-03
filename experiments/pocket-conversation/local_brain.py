"""Resident, authenticated local text model. No tools, internet or visitor logs."""
import hashlib
from http.client import HTTPConnection
import json
import re
import secrets
import socket
import subprocess
import threading
import time
from pathlib import Path

from pocket_voice import ROOT, Cancelled, check

MODELS = {
    '0.8b': ('Qwen3.5-0.8B-Q4_0.gguf', 563036064, '57d1997790d1744fba5b40a7317df71ea5e2acee28c47e78f0cce39c0703f8cf'),
    '2b': ('Qwen3.5-2B-Q4_K_M.gguf', 1280835840, 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223'),
    'lfm': ('LFM2.5-1.2B-Instruct-Q4_K_M.gguf', 730895168, 'b1b3de114215d9507409a662a501a631095a479a419584e8a2ded6304b19b4f5'),
}
SOURCES = {
    '0.8b': 'https://huggingface.co/ggml-org/Qwen3.5-0.8B-GGUF/resolve/807dfd9a6fadbf703207aac3bfb0b2b3040d077c/',
    '2b': 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/f6d5376be1edb4d416d56da11e5397a961aca8ae/',
    'lfm': 'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/8ed288026e23958ad9dfa92d53ed773a8eee7125/',
}
BINARY = ROOT / '.skelly-build/local-talkback/llama/llama-server.exe'


class LocalBrain:
    label = 'Local conversation model'

    def __init__(self, port=8776, model='lfm'):
        name, size, digest = MODELS[model]
        self.model = ROOT / '.skelly-build/conversation-brain' / name
        self.label = ('LFM2.5 1.2B Q4' if model == 'lfm' else 'Qwen3.5 ' + model) + ' · local · thinking off'
        if not self.model.is_file() or self.model.stat().st_size != size or hashlib.sha256(self.model.read_bytes()).hexdigest() != digest:
            raise ValueError('Conversational model missing or changed. See the conversation notes.')
        self.port, self.key = port, secrets.token_urlsafe(32)
        self.process = None

    @property
    def loaded(self):
        return self.process is not None and self.process.poll() is None

    def _json(self, path, payload=None, timeout=5):
        connection = HTTPConnection('127.0.0.1', self.port, timeout=timeout)
        try:
            connection.request('GET' if payload is None else 'POST', path,
                None if payload is None else json.dumps(payload).encode(),
                {'Authorization': 'Bearer ' + self.key, 'Content-Type': 'application/json'})
            response = connection.getresponse()
            data = response.read(32769)
            if response.status != 200 or len(data) > 32768:
                raise RuntimeError('Bounded local reply request failed.')
            return json.loads(data)
        finally:
            connection.close()

    def start(self, cancel=None, deadline=None):
        cancel = cancel if cancel is not None else threading.Event()
        deadline = min(deadline if deadline is not None else float('inf'), time.monotonic() + 45)
        if self.loaded:
            return
        with socket.socket() as probe:
            probe.settimeout(.2)
            if probe.connect_ex(('127.0.0.1', self.port)) == 0:
                raise RuntimeError('Conversational model port is occupied by another service.')
        check(cancel, deadline)
        self.process = subprocess.Popen([str(BINARY), '-m', str(self.model), '--host', '127.0.0.1',
            '--port', str(self.port), '-c', '2048', '-t', '4', '-tb', '4', '--parallel', '1',
            '--cache-ram', '0', '--no-cache-idle-slots', '--ctx-checkpoints', '8',
            '--checkpoint-min-step', '32', '--ubatch-size', '64',
            '--no-webui', '--api-key', self.key, '--reasoning', 'off', '--reasoning-budget', '0',
            '--chat-template-kwargs', '{"enable_thinking":false}', '--log-disable'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        try:
            while True:
                check(cancel, deadline)
                if self.process.poll() is not None:
                    raise RuntimeError('Conversational model did not start.')
                try:
                    self._json('/health', timeout=.3)
                    return
                except (OSError, RuntimeError, ValueError):
                    time.sleep(.05)
        except Exception:
            self.close()
            raise

    def close(self):
        if self.process is not None:
            if self.process.poll() is None:
                self.process.kill()
            self.process.wait(timeout=2)
            self.process = None

    def reply(self, messages, cancel, deadline, question=None):
        self.start(cancel, deadline)
        check(cancel, deadline)
        spoken_schema = {'type': 'string', 'minLength': 1, 'maxLength': 140}
        if question is not None:
            # Separate one statement from one question, but do not force a
            # terminator at a character count: the old grammar produced clipped
            # words such as 'thema.' and 'haun?'. Reject overlong completed text
            # below instead of speaking a fragment. The token/deadline bounds
            # still apply, with no retry or partial output.
            spoken_schema = {'type': 'string', 'pattern': "^[A-Za-z0-9 ,'-]+[.!]$"}
        properties = {'reply': spoken_schema}
        if question:
            properties['question'] = {'type': 'string', 'pattern': "^[A-Za-z][A-Za-z0-9'-]* [A-Za-z0-9 ,'-]+[?]$"}
        payload = {'messages': messages, 'max_tokens': 72, 'temperature': .15, 'top_p': .9,
            'top_k': 50, 'min_p': 0, 'repeat_penalty': 1.05, 'presence_penalty': 0, 'stream': False,
            'chat_template_kwargs': {'enable_thinking': False},
            'response_format': {'type': 'json_schema', 'json_schema': {'name': 'spoken_reply',
                'strict': True, 'schema': {'type': 'object', 'properties': properties,
                    'required': list(properties), 'additionalProperties': False}}}}
        done, result = threading.Event(), []
        def request():
            try:
                result.append(self._json('/v1/chat/completions', payload, timeout=max(.01, deadline - time.monotonic())))
            except Exception:
                result.append(None)
            finally:
                done.set()
        worker = threading.Thread(target=request, daemon=True)
        worker.start()
        try:
            while not done.wait(.025):
                check(cancel, deadline)
            check(cancel, deadline)
            if not result or result[0] is None:
                raise RuntimeError('Local conversation request failed.')
            choice = result[0]['choices'][0]
            if choice.get('finish_reason') != 'stop':
                raise ValueError('Local reply did not finish within its token budget.')
            message = choice['message']
            if message.get('reasoning_content') or message.get('tool_calls'):
                raise ValueError('Expected only a short spoken reply.')
            value = json.loads(message['content'])
            if not isinstance(value, dict) or set(value) != set(properties) or any(not isinstance(v, str) for v in value.values()):
                raise ValueError('Invalid local reply schema.')
            for name, schema in properties.items():
                if 'pattern' in schema and not re.fullmatch(schema['pattern'], value[name]):
                    raise ValueError('Local reply did not match its spoken schema.')
            reply = value['reply'] + (' ' + value['question'] if question else '')
            if question is not None and (len(reply) > 140 or reply.count('?') != int(question)
                    or (question and (len(value['reply']) > 110 or len(value['question']) > 80))):
                raise ValueError('Local reply did not follow its interaction cadence.')
            return reply
        except (Cancelled, TimeoutError):
            # Reap the owned model to interrupt prefill/decoding immediately.
            # A future explicit turn reloads it; no automatic retry of this turn.
            self.close()
            raise
        finally:
            worker.join(timeout=.5)

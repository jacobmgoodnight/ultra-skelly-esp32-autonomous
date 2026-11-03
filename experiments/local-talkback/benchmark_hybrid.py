"""Time synthetic local HTTP turns; no microphone, speaker, or visitor data."""
import argparse
import base64
import io
import json
import subprocess
import tempfile
import threading
import time
import wave
from array import array
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

import companion
from recordings import Library, catalog_text
from review_library import stage, approve
from voice import validate_reply_wave

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--tools', type=Path, default=companion.TOOLS)
args = parser.parse_args()
companion.TOOLS = args.tools.resolve()


def synthetic_input(work, voice):
    """Generate fixed test speech and convert to the existing input format."""
    if not voice.neural:
        raise RuntimeError('The synthetic benchmark requires the local Piper setup.')
    target = work / 'synthetic-input.wav'
    subprocess.run([str(voice.piper), '--model', str(voice.model), '--config', str(voice.config),
                    '--output_file', str(target), '--quiet'], input='Tell me a ghost joke.\n',
                   text=True, encoding='utf-8', check=True, timeout=10, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                   creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    with wave.open(str(target), 'rb') as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, 22050):
            raise ValueError('Unexpected synthetic input format.')
        samples = array('h'); samples.frombytes(wav.readframes(wav.getnframes()))
    import sys
    if sys.byteorder != 'little': samples.byteswap()
    converted = array('h', (samples[min(len(samples) - 1, int(i * 22050 / 16000))]
                            for i in range(int(len(samples) * 16000 / 22050))))
    if sys.byteorder != 'little': converted.byteswap()
    result = io.BytesIO()
    with wave.open(result, 'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(16000); wav.writeframes(converted.tobytes())
    data = result.getvalue(); companion.validate_wave(data)
    return data


class FixedDeck:
    def next(self, topic):
        if topic != 3: raise ValueError('Synthetic phrase was not recognized as a ghost request.')
        return 3, 1, catalog_text(3, 1)
    def next_joke(self): raise ValueError('Synthetic phrase was not recognized as a ghost request.')


started = time.monotonic()
engines = companion.Engines()
try:
    with tempfile.TemporaryDirectory(prefix='skelly-benchmark-') as folder:
        work = Path(folder)
        source = synthetic_input(work, engines.voice)
        # Test fixture only: matching synthetic speech is temporarily approved in
        # an isolated directory, never added to the owner's reviewed library.
        fixture = work / 'fixture.wav'
        fixture.write_bytes(engines.voice.synthesize(catalog_text(3, 1), work))
        library = Library(work / 'library')
        entry = stage(library, 3, 1, fixture, 'Benchmark fixture', 'synthetic')
        approve(library, 3, 1, entry['audio_sha256'])
        engines.recordings, engines.deck = library, FixedDeck()
        model_start = time.monotonic()
        engines.start()
        model_startup = time.monotonic() - model_start
        startup = time.monotonic() - started
        with ThreadingHTTPServer(('127.0.0.1', 0), companion.make_handler(engines, 0)) as server:
            port = server.server_address[1]
            server.RequestHandlerClass = companion.make_handler(engines, port)
            thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
            try:
                conn = HTTPConnection('127.0.0.1', port, timeout=45)
                conn.request('GET', '/api/status'); response = conn.getresponse()
                token = json.loads(response.read())['token']; conn.close()
                rows = []
                for voice in ('local', 'local', 'fallback', 'fallback'):
                    begin = time.monotonic()
                    conn = HTTPConnection('127.0.0.1', port, timeout=45)
                    conn.request('POST', '/api/reply', source, {'Content-Type': 'audio/wav',
                                 'X-Skelly-Token': token, 'X-Skelly-Voice': voice})
                    response = conn.getresponse(); result = json.loads(response.read()); conn.close()
                    elapsed = time.monotonic() - begin
                    if response.status != 200 or result.get('card') != 3 or result.get('variant') != 1:
                        raise RuntimeError('Synthetic recognition or reply failed: ' + str(result.get('error', 'unexpected selection')))
                    validate_reply_wave(base64.b64decode(result['audio'], validate=True))
                    rows.append({'voice': voice, 'source': result['source'], 'http_seconds': round(elapsed, 3)})
                print(json.dumps({'setup_including_fixture_seconds': round(startup, 3),
                                  'local_topic_model_start_seconds': round(model_startup, 3), 'turns': rows,
                                  'scope': 'synthetic WAV HTTP request through validated response; excludes capture, browser playback and Bluetooth'}, indent=2))
            finally:
                server.shutdown(); thread.join()
finally:
    engines.close()

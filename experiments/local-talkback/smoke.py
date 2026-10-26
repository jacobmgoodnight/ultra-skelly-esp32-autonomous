"""Real local engines using synthetic speech only. Never records or plays sound."""
import base64
import json
import subprocess
import tempfile
import time
from pathlib import Path
from companion import Engines, REPLIES, validate_wave
from voice import validate_reply_wave

engines = Engines()
try:
    engines.start()
    with tempfile.TemporaryDirectory(prefix='skelly-synthetic-') as folder:
        work = Path(folder)
        (work / 'input.txt').write_text('My name is Emma. Tell me a ghost joke.', encoding='utf-8')
        subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', str(Path(__file__).with_name('speak.ps1')), '-TextFile', str(work / 'input.txt'), '-WaveFile', str(work / 'input.wav')], check=True, timeout=10)
        source = (work / 'input.wav').read_bytes()
        validate_wave(source)
        started = time.monotonic()
        result = engines.respond(source)
        assert result['text'] in {'Hi, Emma! ' + line for line in REPLIES[result['card']]}
        assert 'Hi, Emma!' in result['text'], 'Synthetic name was not recognized.'
        validate_reply_wave(base64.b64decode(result['audio']))
        output = Path(__file__).resolve().parents[2] / '.skelly-build' / 'conversation-synthetic-reply.json'
        output.write_text(json.dumps(result), encoding='utf-8')
        print(json.dumps({'result': 'PASS synthetic local speech -> approved reply -> local WAV', 'seconds': round(time.monotonic() - started, 2), 'voice': engines.voice.label, 'card': result['card'], 'reply': result['text']}))
finally:
    engines.close()

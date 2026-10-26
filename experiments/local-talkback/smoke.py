"""Real local engines using synthetic speech only. Never records or plays sound."""
import json
import subprocess
import tempfile
import time
from pathlib import Path
from companion import Engines, approved_reply, validate_wave

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
        assert result['text'] == approved_reply('My name is Emma', json.dumps({'card': result['card']}))[1]
        assert 'Hi, Emma!' in result['text'], 'Synthetic name was not recognized.'
        output = Path(__file__).resolve().parents[2] / '.skelly-build' / 'conversation-synthetic-reply.json'
        output.write_text(json.dumps(result), encoding='utf-8')
        print(json.dumps({'result': 'PASS synthetic local speech -> approved reply -> local WAV', 'seconds': round(time.monotonic() - started, 2), 'card': result['card'], 'reply': result['text']}))
finally:
    engines.close()

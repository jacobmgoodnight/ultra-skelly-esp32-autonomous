"""Opt-in native Pocket synthesis. No engine HTTP listener, downloads or playback."""
import hashlib
import io
import json
import os
import subprocess
import threading
import time
import wave
from pathlib import Path

from companion import NAMES, REPLIES
from voice import LocalVoice, _combine_delivery, _delivery_parts, validate_reply_wave

ROOT = Path(__file__).resolve().parents[2]
MAX_NATIVE_WAV = 44 + 24000 * 8 * 2
CATALOG = frozenset(line for topic in REPLIES for line in topic)


class Cancelled(Exception):
    pass


def check(cancel, deadline):
    if cancel.is_set():
        raise Cancelled('Turn cancelled. Nothing played.')
    if time.monotonic() >= deadline:
        raise TimeoutError('Speech deadline exceeded. Nothing played.')


def approved_text(text):
    """A second boundary before either speech engine, including the exact name form."""
    if not isinstance(text, str) or not 0 < len(text) <= 180:
        raise ValueError('Expected an approved catalog reply.')
    if text in CATALOG:
        return
    line = text
    if text.startswith('Hi, '):
        greeting, separator, line = text.partition('! ')
        name = greeting[4:]
        if not separator or name.casefold() not in NAMES or name != name.capitalize():
            raise ValueError('Expected an allowlisted first name.')
    if line not in CATALOG:
        raise ValueError('Expected an approved catalog reply.')


def run_process(command, *, cancel, deadline, input=None, max_output_bytes=MAX_NATIVE_WAV, **unused):
    """Own and reap each process; cancellation also prevents any fallback speech."""
    check(cancel, deadline)
    target = None
    for flag in ('--output-path', '--output_file', '-WaveFile'):
        if flag in command:
            target = Path(command[command.index(flag) + 1])
            break
    env = dict(os.environ, RAYON_NUM_THREADS='1', HF_HUB_OFFLINE='1',
               TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_IMPLICIT_TOKEN='1')
    # The locked config has only local paths. Do not inherit an account credential.
    for key in ('HF_TOKEN', 'HUGGING_FACE_HUB_TOKEN'):
        env.pop(key, None)
    process = subprocess.Popen(command, stdin=subprocess.PIPE if input is not None else subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    try:
        if input is not None:
            process.stdin.write(input.encode('utf-8'))
            process.stdin.close()
        while process.poll() is None:
            check(cancel, deadline)
            if target is not None and target.exists() and target.stat().st_size > max_output_bytes:
                raise ValueError('Speech engine output exceeded its limit.')
            try:
                process.wait(timeout=.025)
            except subprocess.TimeoutExpired:
                pass
        check(cancel, deadline)
        if process.returncode:
            raise RuntimeError('Local speech engine failed.')
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=2)
        if process.stdin is not None and not process.stdin.closed:
            process.stdin.close()


def load_assets(root=ROOT, lock_path=None):
    root = Path(root).resolve()
    lock_path = lock_path or Path(__file__).with_name('assets.lock.json')
    lock = json.loads(Path(lock_path).read_text(encoding='utf-8'))
    required = {'binary', 'model', 'tokenizer', 'embedding', 'reference', 'source_reference', 'config'}
    if set(lock['files']) != required:
        raise ValueError('Incomplete Pocket asset lock.')
    paths = {}
    for key, row in lock['files'].items():
        path = (root / row['path']).resolve()
        if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size != row['size']:
            raise ValueError('Pocket asset missing or changed: ' + key + '. See the experiment README.')
        if hashlib.sha256(path.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Pocket asset hash mismatch: ' + key + '. Refusing to load it.')
        paths[key] = path
    config = json.loads(paths['config'].read_text(encoding='utf-8'))
    if config['weights_path'] != 'MODEL' or config['flow_lm']['lookup_table']['tokenizer_path'] != 'TOKENIZER':
        raise ValueError('Unexpected Pocket config anchors.')
    config['weights_path'] = str(paths['model'])
    config['weights_path_without_voice_cloning'] = None
    config['flow_lm']['lookup_table']['tokenizer_path'] = str(paths['tokenizer'])
    return paths, config


def convert_wave(data, max_seconds=8, trim_padding=False):
    """Only complete, bounded CLI WAVs; never accept upstream streaming placeholders."""
    if not 44 < len(data) <= 44 + 24000 * max_seconds * 2:
        raise ValueError('Native reply size is unsupported.')
    if data[:4] != b'RIFF' or int.from_bytes(data[4:8], 'little') != len(data) - 8:
        raise ValueError('Native reply is incomplete.')
    try:
        with wave.open(io.BytesIO(data)) as audio:
            if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype()) != (1, 2, 24000, 'NONE'):
                raise ValueError('Native reply format is unsupported.')
            frames = audio.getnframes()
            pcm = audio.readframes(frames)
            if not 0 < frames <= 24000 * max_seconds or len(pcm) != frames * 2 or len(data) != 44 + len(pcm):
                raise ValueError('Native reply is incomplete or overlong.')
    except (wave.Error, EOFError) as error:
        raise ValueError('Invalid native reply.') from error
    import numpy as np
    from scipy.signal import resample_poly
    samples = np.frombuffer(pcm, dtype='<i2').astype(np.float64)
    if trim_padding:
        active = np.flatnonzero(np.abs(samples) > max(32, np.max(np.abs(samples)) * .005))
        if not len(active):
            raise ValueError('Native reply is silent.')
        samples = samples[max(0, int(active[0]) - 1920):min(len(samples), int(active[-1]) + 1921)]
        if len(samples) > 24000 * 8:
            raise ValueError('Spoken reply exceeds eight seconds after silence removal.')
    converted = np.clip(np.rint(resample_poly(samples, 147, 160)), -32768, 32767).astype('<i2')
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(22050)
        audio.writeframes(converted.tobytes())
    result = output.getvalue()
    validate_reply_wave(result)
    return result


class GuardedVoice:
    delivery_parts = staticmethod(_delivery_parts)
    max_native_wav = MAX_NATIVE_WAV
    native_audio = staticmethod(convert_wave)

    def validate_text(self, text):
        approved_text(text)

    def __init__(self, tools, pocket=False, runner=run_process, assets=None):
        self.tools, self.pocket, self.runner = tools, pocket, runner
        self.fallback_reason = None
        self.paths, self.config = (None, None) if not pocket else (assets or load_assets())
        if pocket:
            # Load conversion dependencies before any timed turn.
            import numpy
            from scipy.signal import resample_poly
        self.label = ('Pocket 18.2M · synthetic E · Piper fallback' if pocket else LocalVoice(tools).label)

    def synthesize(self, text, work, cancel=None, deadline=None):
        self.validate_text(text)
        self.fallback_reason = None
        cancel = cancel if cancel is not None else threading.Event()
        deadline = min(deadline if deadline is not None else float('inf'), time.monotonic() + 10)
        check(cancel, deadline)
        source = 'piper'
        if self.pocket:
            # Leave four seconds for fallback inside the original ten-second budget.
            pocket_deadline = min(deadline, time.monotonic() + 6)
            stage = 'native-process'
            try:
                config = Path(work) / 'pocket-config.yaml'
                config.write_text(json.dumps(self.config), encoding='utf-8')
                pieces = []
                for index, part in enumerate(self.delivery_parts(text)):
                    target = Path(work) / f'pocket-{index}.wav'
                    target.unlink(missing_ok=True)
                    self.runner([str(self.paths['binary']), 'generate', '--config', str(config),
                        '--voice', str(self.paths['embedding']), '--text', part,
                        '--output-path', str(target), '--quiet'], cancel=cancel, deadline=pocket_deadline,
                        max_output_bytes=self.max_native_wav)
                    check(cancel, pocket_deadline)
                    if not target.is_file() or target.stat().st_size > self.max_native_wav:
                        raise ValueError('No bounded native reply.')
                    stage = 'native-audio'
                    pieces.append(self.native_audio(target.read_bytes()))
                    stage = 'native-process'
                stage = 'comic-delivery'
                audio = pieces[0] if len(pieces) == 1 else _combine_delivery(pieces)
                validate_reply_wave(audio)
                check(cancel, pocket_deadline)
                return audio, 'pocket-e'
            except Cancelled:
                raise
            except Exception as error:
                check(cancel, deadline)
                self.fallback_reason = ('synthesis-deadline' if isinstance(error, TimeoutError)
                    else stage + '-rejected' if isinstance(error, ValueError) else 'engine-unavailable')
                source = 'piper-fallback'
        def bounded_runner(command, **kwargs):
            return self.runner(command, cancel=cancel, deadline=deadline, **kwargs)
        local = LocalVoice(self.tools, runner=bounded_runner)
        audio = local.synthesize(text, Path(work))
        check(cancel, deadline)
        validate_reply_wave(audio)
        return audio, source if local.neural else 'windows-fallback'

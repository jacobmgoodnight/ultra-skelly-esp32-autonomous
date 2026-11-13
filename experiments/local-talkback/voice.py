"""Local approved-text synthesis. No playback, microphone or network access."""
import io
import subprocess
import sys
import time
import wave
from array import array
from pathlib import Path

MAX_REPLY_WAV = 44 + 22050 * 8 * 2
DELIVERY_PAUSE = .7


def validate_reply_wave(data):
    if not 44 < len(data) <= MAX_REPLY_WAV:
        raise ValueError('Local reply exceeded its audio limit.')
    try:
        with wave.open(io.BytesIO(data)) as audio:
            rate = audio.getframerate()
            frames = audio.getnframes()
            if audio.getnchannels() != 1 or audio.getsampwidth() != 2 or rate not in (16000, 22050) or audio.getcomptype() != 'NONE':
                raise ValueError('Local reply audio format is unsupported.')
            if not 0 < frames <= rate * 8 or len(audio.readframes(frames)) != frames * 2:
                raise ValueError('Local reply exceeded eight seconds or is incomplete.')
    except (wave.Error, EOFError) as error:
        raise ValueError('Invalid local reply audio.') from error


def _delivery_parts(text):
    setup, question, answer = text.partition('?')
    if question and setup.strip() and answer.strip():
        return setup.strip() + '?', answer.strip()
    return (text,)


def _remaining(deadline):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise subprocess.TimeoutExpired('local voice delivery', 10)
    return remaining


def _read_pcm(data):
    validate_reply_wave(data)
    with wave.open(io.BytesIO(data)) as audio:
        rate = audio.getframerate()
        samples = array('h')
        samples.frombytes(audio.readframes(audio.getnframes()))
    if sys.byteorder != 'little':
        samples.byteswap()
    return rate, samples


def _trim_edges(samples, rate):
    # Keep quiet speech intact: trim only near-silence and retain 30 ms padding.
    first = next((index for index, sample in enumerate(samples) if abs(sample) > 96), None)
    if first is None:
        return samples
    last = len(samples) - next(index for index, sample in enumerate(reversed(samples)) if abs(sample) > 96)
    guard = round(rate * .03)
    return samples[max(0, first - guard):min(len(samples), last + guard)]


def _shape_segment(samples, rate, punchline=False):
    ratio, gain = (1.04, 1.06) if punchline else (1.0, 1.0)
    count = max(1, int(len(samples) / ratio))
    result = array('h')
    fade = max(1, round(rate * .005))
    for index in range(count):
        position = index * ratio
        left = min(int(position), len(samples) - 1)
        right = min(left + 1, len(samples) - 1)
        fraction = position - left
        sample = samples[left] + (samples[right] - samples[left]) * fraction
        envelope = min(1.0, index / fade, (count - index - 1) / fade)
        result.append(max(-32768, min(32767, round(sample * gain * envelope))))
    return result


def _combine_delivery(data_pieces):
    if len(data_pieces) != 2:
        raise ValueError('Comic delivery requires one setup and one punchline.')
    setup_rate, setup = _read_pcm(data_pieces[0])
    answer_rate, answer = _read_pcm(data_pieces[1])
    if setup_rate != answer_rate:
        raise ValueError('Local voice segments used different audio rates.')
    setup = _shape_segment(_trim_edges(setup, setup_rate), setup_rate)
    answer = _shape_segment(_trim_edges(answer, setup_rate), setup_rate, punchline=True)
    pause_frames = round(setup_rate * DELIVERY_PAUSE)
    if len(setup) + pause_frames + len(answer) > setup_rate * 8:
        raise ValueError('Local reply exceeded eight seconds with comic timing. Nothing was truncated.')
    samples = setup + array('h', [0]) * pause_frames + answer
    if sys.byteorder != 'little':
        samples.byteswap()
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(setup_rate)
        audio.writeframes(samples.tobytes())
    data = output.getvalue()
    validate_reply_wave(data)
    return data


class LocalVoice:
    def __init__(self, tools, runner=subprocess.run):
        self.runner = runner
        self.piper = next((Path(tools) / 'piper').rglob('piper.exe'), None)
        self.model = Path(tools) / 'en_US-joe-medium.onnx'
        self.config = self.model.with_suffix('.onnx.json')
        self.neural = bool(self.piper and self.model.is_file() and self.config.is_file())
        self.label = 'Piper Joe · local neural voice' if self.neural else 'Windows voice · basic fallback (run setup for neural voice)'

    def synthesize(self, text, work):
        deadline = time.monotonic() + 10
        if not isinstance(text, str) or not 0 < len(text) <= 180 or not text.strip() or any(ord(char) < 32 for char in text):
            raise ValueError('Invalid approved reply.')
        reply = Path(work) / 'reply.wav'
        reply.unlink(missing_ok=True)
        parts = _delivery_parts(text)
        pieces = []
        for index, part in enumerate(parts):
            target = reply if len(parts) == 1 else Path(work) / ('setup.wav' if index == 0 else 'punchline.wav')
            target.unlink(missing_ok=True)
            if self.neural:
                pace = '0.94' if len(parts) == 1 else '0.99' if index == 0 else '0.88'
                command = [str(self.piper), '--model', str(self.model), '--config', str(self.config),
                           '--output_file', str(target), '--length_scale', pace, '--sentence_silence', '0.16']
                if len(parts) == 2:
                    command.extend(['--noise_scale', '0.75'])
                command.append('--quiet')
                self.runner(command, input=part + '\n', text=True, encoding='utf-8', check=True, timeout=_remaining(deadline),
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            else:
                approved = Path(work) / ('approved.txt' if len(parts) == 1 else 'setup.txt' if index == 0 else 'punchline.txt')
                approved.write_text(part, encoding='utf-8')
                self.runner(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                             '-File', str(Path(__file__).with_name('speak.ps1')), '-TextFile', str(approved), '-WaveFile', str(target)],
                            check=True, timeout=_remaining(deadline), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            _remaining(deadline)
            if not target.is_file() or target.stat().st_size > MAX_REPLY_WAV:
                raise ValueError('Local voice produced no bounded reply.')
            data = target.read_bytes()
            validate_reply_wave(data)
            pieces.append(data)
        _remaining(deadline)
        audio = pieces[0] if len(pieces) == 1 else _combine_delivery(pieces)
        validate_reply_wave(audio)
        _remaining(deadline)
        if len(pieces) == 2:
            reply.write_bytes(audio)
        _remaining(deadline)
        return audio

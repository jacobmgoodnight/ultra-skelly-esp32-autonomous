"""Subtle hollow resonance, with unchanged pitch, duration and checked WAV bounds."""
import io
import wave
import numpy as np
from scipy.signal import butter, sosfilt
from voice import validate_reply_wave


def skeleton_tone(data):
    validate_reply_wave(data)
    with wave.open(io.BytesIO(data)) as audio:
        rate = audio.getframerate()
        pcm = np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2').astype(float)
    filtered = sosfilt(butter(2, [160, 4200], btype='bandpass', fs=rate, output='sos'), pcm)
    result = .82 * pcm + .1 * filtered
    for seconds, gain in ((.017, -.09), (.031, .06)):
        delay = round(rate * seconds)
        if len(pcm) > delay:
            result[delay:] += gain * filtered[:-delay]
    peak = np.max(np.abs(result))
    if peak > 30000:
        result *= 30000 / peak
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(rate)
        audio.writeframes(np.clip(np.rint(result), -32768, 32767).astype('<i2').tobytes())
    data = output.getvalue()
    validate_reply_wave(data)
    return data


def crypt_tone(data):
    """A lower skeleton voice at the original pace; no extra voice model."""
    from pedalboard import PitchShift
    validate_reply_wave(data)
    with wave.open(io.BytesIO(data)) as audio:
        rate = audio.getframerate()
        pcm = np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2').astype(np.float32) / 32768
    # Rubber Band compensates its algorithmic latency. Extra silence flushes
    # the effect; only this added padding is removed, keeping the original frames.
    padded = np.pad(pcm, (0, round(rate * .3)))
    shifted = PitchShift(semitones=-2).process(padded, rate, reset=True).reshape(-1)
    if len(shifted) < len(pcm) or not np.isfinite(shifted).all():
        raise ValueError('Crypt voice did not produce complete audio.')
    shifted = shifted[:len(pcm)].astype(float)
    filtered = sosfilt(butter(2, [140, 4500], btype='bandpass', fs=rate, output='sos'), shifted)
    result = .88 * shifted + .13 * filtered
    for seconds, gain in ((.019, -.16), (.037, .10), (.071, .045)):
        delay = round(rate * seconds)
        if len(result) > delay:
            result[delay:] += gain * filtered[:-delay]
    peak = np.max(np.abs(result))
    if peak > .91:
        result *= .91 / peak
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(rate)
        audio.writeframes(np.clip(np.rint(result * 32768), -32768, 32767).astype('<i2').tobytes())
    checked = output.getvalue()
    validate_reply_wave(checked)
    return checked

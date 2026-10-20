#!/usr/bin/env python3
"""Create two experimental 20-second jaw-only MP3 waveforms for Ultra Skelly v2.
Standard library + ffmpeg required. Upload each MP3 to the prop, then set saved
head/arm/torso movement metadata to 0x00 using Skelly Ultra Web Controller.
A waveform is not direct jaw-position control; verify real motion.
"""
from array import array
from math import sin, pi
from pathlib import Path
import shutil
import subprocess
import sys

RATE = 8000
SECONDS = 20
CLIPS = {
    "Jaw_Long_Open_3s_Holds_20s.mp3": [
        (2.0, 5.0), (8.0, 11.0), (14.0, 17.0)
    ],
    "Jaw_Whisper_Then_Gasp_20s.mp3": [
        (1.05, 1.28), (1.85, 2.18), (3.2, 6.2),
        (9.4, 9.68), (10.7, 11.1), (12.25, 12.55), (14.2, 17.2)
    ],
}
def make_pcm(events):
    length = RATE * SECONDS
    pcm = array("f", [0.0]) * length
    for begin, end in events:
        start, stop = round(begin * RATE), round(end * RATE)
        count = stop - start
        fade = min(round(RATE * .045), count // 4)
        for i in range(count):
            t = i / RATE
            amplitude = 0.70 * sin(2 * pi * 230 * t) + 0.22 * sin(2 * pi * 460 * t)
            ramp = min(1, i / max(1, fade), (count - i - 1) / max(1, fade))
            pcm[start + i] = max(-.94, min(.94, amplitude * ramp))
    if sys.byteorder != "little":
        pcm.byteswap()
    return pcm.tobytes()

def main():
    if not shutil.which("ffmpeg"):
        raise SystemExit("Install ffmpeg and make sure it is on PATH.")
    folder = Path(__file__).resolve().parent / "generated"
    folder.mkdir(exist_ok=True)
    for name, events in CLIPS.items():
        output = folder / name
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-f", "f32le",
            "-ar", str(RATE), "-ac", "1", "-i", "pipe:0", "-t", str(SECONDS),
            "-c:a", "libmp3lame", "-b:a", "32k", "-ar", "8000", "-ac", "1",
            "-write_xing", "0", str(output),
        ], input=make_pcm(events), check=True)
        print("Created:", output)
if __name__ == "__main__":
    main()

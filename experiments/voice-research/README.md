# Isolated voice research

This folder does not change or start the companion, use a microphone, play audio,
connect to the prop, or send visitor data. See [the research report](../../docs/expressive-voice-research.md)
for sources, listening limits and the intended attended comparison. Generated
samples are not reviewed or approved for use around children automatically.

From the repository root on Windows, create an isolated Python 3.12 environment
under ignored output, then install the tested direct versions. Pip resolves their
transitive dependencies; these versions are not a complete hash lock. Downloads
are roughly 400 MB of models plus Python packages and extracted files.

```powershell
python -m venv .skelly-build/voice-research-env
.skelly-build/voice-research-env/Scripts/python.exe -m pip install onnxruntime==1.23.1 numpy==2.2.6 soundfile==0.13.1 huggingface_hub==0.36.2 scipy==1.15.3 psutil==7.1.3
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/download-supertonic.py
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/benchmark-supertonic.py
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/prepare-supertonic-comparison.py
```

The downloader fetches the fixed public archive revisions into ignored output,
checks model LFS hashes against publisher metadata, and checks the inference
helper against a recorded source hash. Generation uses those local files. The
benchmark also needs the existing optional Piper Joe installation from PR #55.
Serve the repository on loopback and open
`/.skelly-build/voice-research/samples/compare.html` for the samples. Do not
expose the local server to a network.

To time the separate synthetic turn with installed Whisper and Piper:

```powershell
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/synthetic-turn-supertonic.py
python tests/test_hybrid_voice_probe.py
```

The synthetic turn records no visitor audio. It excludes calibration, actual
speech duration, browser transfer, Bluetooth and physical playback. The hybrid
probe operates only on passed data; it is not an integration or a mechanism for
approving recordings.

## MOSS-TTS-Nano comparison

The MOSS ONNX sample uses the research environment above plus the **separate,
already installed** CPU PyTorch/Torchaudio packages from the Chatterbox test
environment. Although the ONNX model itself does not require PyTorch, this
pinned upstream Python wrapper imports PyTorch and Torchaudio. This reuse is an
experimental convenience, not a locked, standalone installation recipe. The
model downloads are approximately 763 MB in addition to the environments.
With that CPU environment already installed, run:

```powershell
.skelly-build/voice-research-env/Scripts/python.exe -m pip install sentencepiece==0.2.1
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/download-moss.py
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/benchmark-moss.py
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/prepare-three-voice-comparison.py
```

Downloads use pinned revisions and verify LFS files against publisher metadata;
the source archive is checked against a recorded hash. The benchmark uses the
supplied Nathan voice, no microphone and no network after setup. It downmixes
and resamples the output into a validated 22.05 kHz WAV, rejects a generation cap
or oversized audio, and writes everything under ignored `.skelly-build`. Open
`/.skelly-build/voice-research/samples/compare-three.html` from the loopback
static server to compare the three models. Review words and voice before using
any generated sample around children.

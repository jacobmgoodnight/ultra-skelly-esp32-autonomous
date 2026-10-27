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

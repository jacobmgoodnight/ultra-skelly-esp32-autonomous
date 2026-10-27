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

To also compare the MOSS Adam preset and MOSS using a **synthetic** Supertonic
M1 reference (never visitor audio), first generate the Supertonic samples as
above, then run:

```powershell
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/benchmark-moss-options.py
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/prepare-character-comparison.py
```

The reference is the existing generated Skelly introduction under ignored
output. It is not a real person's recording. The extra samples and the page
`/.skelly-build/voice-research/samples/compare-character.html` are also local
previews, not automatically approved for the conversation system.

## Qwen3-TTS VoiceDesign: isolated preparation

The [research report](../../docs/expressive-voice-research.md#voicedesign-cpu-preparation-and-memory-check)
records why this is the next character-voice candidate and the initial
memory-limited result. This is a prerecorded preview, not an installed
conversation voice. The two verified Q4 model files occupy about 1.44 GB and
remain under ignored output. Python `requests` and `psutil` are needed.

The experiment used the third-party `qwentts.cpp` source at
`5916bf7c79dbb4e66fc059cdc507a79a23a28bb4` with its pinned `ggml` submodule.
Build a CPU-only `qwen-tts.exe` from that source into
`.skelly-build/voice-research/qwentts-ninja/` using the upstream instructions
and an appropriate Windows C++ toolchain. The source, build and models stay
outside the conversation runtime. Then, from the repository root:

```powershell
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/download-qwen-design.py
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/run-qwen-design.py
```

The downloader pins the public model revision and verifies file lengths and
publisher SHA-256 values. The preview runs locally with a fixed reviewed joke
and a fictional skeleton description, using no microphone or visitor audio.
It starts only with at least 4.5 GiB available memory, lowers its process
priority, monitors free memory and stops after five minutes. Those conservative
guards cannot guarantee that Windows will avoid paging. The resulting raw
24 kHz WAV is a research artifact, not yet validated against the conversation
system's eight-second/22.05 kHz bounds or reviewed for its actual words, voice,
Bluetooth playback or jaw response.

For a separate online comparison, three fixed-text samples were obtained from
the [official Qwen public demo](https://huggingface.co/spaces/Qwen/Qwen3-TTS).
The provider receives the chosen joke and voice description. This is optional;
no microphone, visitor name, API key or conversation audio was sent. If those
three WAVs already exist under `samples/qwen-demo-spooky-{1,2,3}.wav` and the
existing Adam/Supertonic comparison clips are present, prepare the local page:

```powershell
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/prepare-qwen-comparison.py
```

Open `/.skelly-build/voice-research/samples/compare-qwen-design.html` from the
loopback server. The preparation resamples and validates the WAV containers,
enforces the existing eight-second bound, and matches average level by turning
down louder clips. When the bounded local CPU run has produced
`samples/qwen-spooky-1-raw.wav`, the page also adds that local theatrical
preview for comparison. It does not verify the spoken content or characterize the
actual voice. The online demo is separate from local inference and may change
or become unavailable.

With the previously installed MOSS dependencies and the locally saved,
synthetic Qwen theatrical sample, the following one-phrase experiment tests
whether a lighter model may carry over that voice. It never records a visitor:

```powershell
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/benchmark-moss-qwen.py
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/prepare-voice-transfer-comparison.py
```

The page at `/.skelly-build/voice-research/samples/compare-voice-transfer.html`
compares the Qwen ghost-joke reference with a MOSS introduction; the reference
has different words from the introduction. Additional same-text jokes appear
when the cached-reference samples below exist. This is a listening experiment,
not a conversation integration. Review actual speech and model timing before
drawing conclusions about voice matching or live use.

After the preceding experiment prepares its fixed synthetic reference, this
separate probe keeps the reference's encoding in memory and times three
approved phrases:

```powershell
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/benchmark-moss-cached-qwen.py
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/benchmark-moss-cached-qwen.py --self-reference
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/prepare-voice-transfer-comparison.py
```

This is not a persistent name or visitor cache and is not connected to the
conversation companion. The probe uses an isolated method override to avoid
re-encoding the one known synthetic reference. It measures complete generated
WAVs, not browser or Bluetooth playback, and reduces gain before writing if the
returned floating-point audio would otherwise exceed full scale. The page then
includes additional same-text ghost and skeleton joke samples, including an
optional reference made from MOSS's own synthetic introduction. No visitor
recording or name is used. Automatic recognition had trouble with one
self-reference sample, so review its actual words carefully.

With the existing local Whisper, Piper and conversation assets installed, this
separate synthetic probe measures three direct-topic turns after preparing the
same reference. It creates its own locally synthesized input and opens no mic:

```powershell
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/synthetic-turn-moss-matrix.py
```

The probe declines to synthesize when its direct-topic check fails; it does not
exercise the companion's ambiguous-topic Qwen fallback. Its timing starts after
the input WAV exists and ends after a validated reply WAV, so it is not a real
spoken-turn or first-audible-output measurement.

## Smaller Qwen voice-matching probe

After the earlier research setup has built the local CPU executable, downloaded
the Q4 codec and saved the synthetic theatrical reference, this optional probe
downloads the 0.6B Qwen Base Q4 talker and generates three comparison clips:

```powershell
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/download-qwen-base.py
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/benchmark-qwen-clone.py
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/prepare-qwen-clone-comparison.py
```

Open `/.skelly-build/voice-research/samples/compare-qwen-clone.html` on the
loopback server. The benchmark uses a fictional, synthetic Qwen reference and
two fixed approved phrases; it never records a visitor. It enforces memory and
time guards per process and records EOS and WAV hashes. The comparison requires
those recorded completions and hashes and validates its output WAVs. Voice match
A uses a speaker embedding; B also uses the reference's written transcript.
These are isolated previews, not an engine integration or a guarantee of voice
consistency, spoken content, jaw behavior, or live performance.

To test the larger Base model using the liked, synthetic MOSS introduction as
the reference, after that introduction and the MOSS skeleton sample have been
generated locally:

```powershell
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/download-qwen-base.py --large
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/benchmark-qwen-clone.py --large-moss-reference
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/prepare-qwen-large-moss-comparison.py
```

The large talker adds about 1.22 GB. The script converts only the fixed
synthetic reference, applies the same memory and time guards and records the
completed WAV's hash. Open
`/.skelly-build/voice-research/samples/compare-qwen-large-moss.html` locally.
This is another prerecorded comparison, not evidence of live speed or safety.

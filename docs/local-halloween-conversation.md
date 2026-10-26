# Local Halloween conversation experiment

This optional Windows laptop companion is separate from Studio and autonomous
firmware. No ESP32 microphone is needed: the laptop captures speech and sends
approved reply audio through its Windows output, including Skelly's paired Live
Stereo speaker. **October 26: the owner confirms one attended conversation turn
produced an approved reply through Skelly with jaw movement**, using Original
voice and the laptop microphone with the ESP32 unplugged. Cleanup, recovery,
longer sessions and the separate guard/name trials remain unverified.

## Family reply guard

This is a small, constrained Halloween conversation, not unrestricted chat.
Replies are spooky, friendly puns and greetings from twenty reviewed lines in
`experiments/local-talkback/companion.py`. A local model can select only a line
number. Its text is never synthesized. Malformed selections, extra output fields
or failed model requests select a fixed friendly fallback. Obvious requested
Halloween topics use deterministic selection for more dependable replies.

A spoken introduction such as "My name is Emma" can add "Hi, Emma!" only if that
first name is in the reviewed list. Unknown names, surnames, arbitrary nicknames
and model-suggested names are omitted. Name recognition can be wrong; this is not
identity verification. There is no visitor-name library or conversation history.
The browser holds the current approved greeting until the next turn, Stop or hide.

Raw microphone audio is **never replayed** in conversation mode. The separate
repeat-back page can repeat offensive speech and has no word filter; use this
conversation page for guarded replies. This guard limits spoken content to the
catalog and safe name list; it does not establish motor safety or suitability for
unattended use. Adding new reply lines/names changes the reviewed output set.

## Install once, run locally

Windows 10/11 x64, an installed English Windows speech voice and Python 3.9+ are
required. The CPU-only setup uses roughly 600 MB of downloads, plus extracted
runtime files. Internet is needed for installation; runtime uses loopback only.
Everything downloaded stays under ignored `.skelly-build/local-talkback`; nothing
is installed globally or added to startup. Setup verifies SHA-256 before using
any archive or model. It can be rerun to verify/reuse completed downloads.

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-talkback-local.ps1
python experiments/local-talkback/companion.py
```

Then open **http://127.0.0.1:8766/** in Chrome or Edge. The ordinary static server
on 8765 still runs repeat-back, but does not provide conversation APIs.

The companion owns loopback ports 8766 (page/API) and 8767 (local model). It binds
only 127.0.0.1, checks Host/Origin, uses a per-process request token, provides no
CORS access and requires a separate ephemeral key for the model engine. Do not
expose these ports to the network. The server serves only its listed page/assets;
repository files and directory listings are unavailable.

## Attended use

1. Let movement finish. Keep the ESP32 unplugged **including USB** and other
   controller apps disconnected. Windows handles the Bluetooth audio connection.
   If **Ultra Skelly v2(Live) Stereo** is already connected/selected and sound
   actually comes from Skelly, skip live enable and use this page directly.
   If the Live speaker is missing or unavailable, follow the
   [isolated procedure](experimental-talkback.md#isolated-prop-setup-and-recovery).
   Keep the repeat-back page visible until **Live-enable write completed** appears
   before leaving it. Then connect the saved Live speaker in Windows, or use
   **Add Bluetooth or other device → Bluetooth** for first pairing. The documented
   default PIN is **1234**, unless changed. There is no automatic setup retry.
   Select Skelly Stereo output and the laptop microphone in Windows sound settings.
   This page uses the browser's default input/output; the repeat-back page's
   in-tab selections do not carry over. A saved pairing alone does not confirm
   the speaker is currently connected.
2. Start at low volume. **Check local engine** checks only the local speech/reply
   service; it does not connect Bluetooth or verify the speaker. Press it,
   confirm attendance, then
   **Talk to Skelly**. Stay quiet for one second, say a short phrase and pause.
   Try "Tell me a ghost joke" and "My name is Emma" using a known safe name.
3. Each click listens once for up to eight seconds. The microphone closes before
   transcription, reply selection and speech output. Nothing listens during
   processing, playback or the 45-second pause after playback. Choose Talk again
   after the pause; no automatic rearm is implemented. Original is the default;
   optional Deep uses the existing lower/slower playback.
4. **Stop & forget**, hiding/leaving the page, device changes or errors discard
   the turn and cancel playback/pending browser requests. Late results never play.
   The companion may finish its bounded local processing after browser cancellation;
   that work cannot start playback. Bluetooth buffers may finish queued audio after
   Stop. An interrupted playback retains a conservative browser pause.
5. Under After testing, **Stop local companion** shuts down its owned services;
   Ctrl+C in the terminal does the same. Pending bounded processing finishes and
   temporary files are removed. Disconnect Windows from the Live speaker and
   power-cycle Skelly before reconnecting the autonomous ESP32.

Pass criteria: one approved reply from the correct speaker, visible jaw response,
no unexpected body movement, microphone off during processing/playback/pause, no
raw phrase replay, Stop/hidden-page cleanup and successful return to autonomy.
Try a request to say an inappropriate word: the output must remain an approved
Halloween line. An unknown name must not be echoed. Stop if any criterion fails;
report sound/jaw/body and recovery separately from software completion.

## Privacy and resource bounds

No accounts, keys to paid services, cloud recognition or online voice are used.
English recognition uses local whisper.cpp tiny.en; selection uses a small local
Qwen model; speech is synthesized into WAV by Windows System.Speech. After setup,
the code contacts only its fixed loopback model endpoint. Recordings/transcripts
are not logged. The browser holds bounded audio in memory; the companion briefly
uses a system temporary folder for input WAV, transcription and approved speech,
then removes it after each request. Abrupt process/OS termination can leave temp
files, so this is not a guarantee against forensic recovery.

Input and reply WAVs are capped at eight seconds, 16 kHz mono 16-bit PCM
(256,044 bytes). One audio request runs at a time. Recognition times out at 20
seconds, model selection at 12, synthesis at 10; the browser abandons a pending
reply after 45 seconds. There is no retry or saved transcript/history. These
bounds do not provide physical jaw telemetry or a prop-side cooldown guarantee.

## Evidence and checks

Verified (owner report), October 26: the first attended conversation test produced
an approved reply through Skelly with jaw movement. The test specified Original
voice, laptop microphone, Skelly's Live Stereo output, ESP32 unplugged and other
controllers disconnected. The exact spoken line and first-name greeting were not
separately reported. Body-still criteria, physical microphone-off phases, cooldown,
Stop/hidden-page cleanup, inappropriate-word/unknown-name trials, child-voice
recognition, Deep output, longer sessions and return to autonomy remain unverified.

Later October 26 reconnection: the owner reported a control-service lookup timeout
and missing/unavailable Windows Live output. After a fresh prop power-cycle and
hard refresh with up to 30 seconds per discovery step, the enable write completed
and the owner saw/connected the Live speaker in Windows. Discovery duration and
the effective recovery step are unknown; this is transport/Windows connection
evidence, not a new sound/jaw or endurance result.

Software-only: unit coverage exercises output/name allowlists, malformed and
injected selections, audio limits, Host/Origin/token/path rejection, request
serialization, capture/playback separation, Stop/late results, network bounds,
UI gating and cooldown retention. These tests need no model downloads:

```powershell
node --test studio/tests/conversation*.test.cjs
python tests/test_local_conversation.py
```

`python experiments/local-talkback/smoke.py` runs the actual installed engines
with synthetic speech and produces no speaker output or microphone access.
October 26: on the owner's i7-6700 / ~16 GB laptop, synthetic "My name is Emma.
Tell me a ghost joke" produced the approved greeting/ghost joke and valid local
WAV in about 1.6 seconds after model startup. This is not a live microphone,
Bluetooth, jaw or child-voice accuracy result. A real-engine request also
exercised model selection; the output remained in the approved catalog.
The native browser also completed actual AudioWorklet capture of generated sound
and muted playback of the synthetic approved reply, ending with the microphone
off and a 45-second pause. Deep playback reported rate 0.8 with pitch preservation
off and no console warnings/errors. The actual companion page loaded its versioned
assets, checked ready and left the microphone off. These remain Software-only.

## Pinned sources

- [llama.cpp b11901 Windows CPU release](https://github.com/ggml-org/llama.cpp/releases/tag/b11901).
- [whisper.cpp b5454 Windows CPU release](https://github.com/ggml-org/whisper.cpp/releases/tag/b5454).
- [Qwen2.5-0.5B-Instruct GGUF, Q4_K_M](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF).
- [whisper.cpp tiny.en model](https://huggingface.co/ggerganov/whisper.cpp).

The setup script pins archive/model hashes. Runtimes and weights are downloaded
from their publishers, not redistributed in the repository or static Pages site.

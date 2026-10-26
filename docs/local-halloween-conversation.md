# Local Halloween conversation experiment

This optional Windows laptop companion is separate from Studio and autonomous
firmware. No ESP32 microphone is needed: the laptop captures speech and sends
approved reply audio through its Windows output, including Skelly's paired Live
Stereo speaker. **October 26: the owner confirms one attended conversation turn
produced an approved reply through Skelly with jaw movement**, using Original
voice and the laptop microphone with the ESP32 unplugged. Cleanup, recovery,
longer sessions and the separate guard/name trials remain unverified. The owner
described the first Piper voice as a little better but monotone. Revised comic
timing and emphasis have software evidence only; a new jaw result was not reported.

## Family reply guard

This is a small, constrained Halloween conversation, not unrestricted chat.
Replies are spooky, friendly puns and greetings from **80 reviewed lines across
20 topics**, with four variants per topic in `experiments/local-talkback/replies.py`.
The existing 20 topic IDs remain stable. A local model can select only a topic
number; its text is never synthesized. Malformed selections, extra output fields
or failed model requests select the approved fallback topic. Explicit Halloween
topics use deterministic selection; generic requests such as "another joke"
rotate through joke topics.

Each topic uses its four variants before refilling. Bounded shuffle bags and the
last **12 reply IDs** avoid recent replies when alternatives remain; they do not
promise that a phrase can never recur. Only numeric topic/variant IDs are retained,
with no visitor text or names in that history. Restarting the companion resets it.

A spoken introduction such as "My name is Emma" can add "Hi, Emma!" only if that
first name is in the reviewed list. Unknown names, surnames, arbitrary nicknames
and model-suggested names are omitted. Name recognition can be wrong; this is not
identity verification. There is no visitor-name library or visitor-text history.
The browser holds the current approved greeting until the next turn, Stop or hide.

Raw microphone audio is **never replayed** in conversation mode. The separate
repeat-back page can repeat offensive speech and has no word filter; use this
conversation page for guarded replies. This guard limits spoken content to the
catalog and safe name list; it does not establish motor safety or suitability for
unattended use. Adding new reply lines/names changes the reviewed output set.

## Install once, run locally

Windows 10/11 x64, an installed English Windows speech voice and Python 3.9+ are
required. The CPU-only setup uses roughly 700 MB of downloads, plus extracted
runtime files. Internet is needed for installation; runtime uses loopback only.
Everything downloaded stays under ignored `.skelly-build/local-talkback`; nothing
is installed globally or added to startup. Setup verifies SHA-256 before using
any archive or model. It can be rerun to verify/reuse completed downloads.

**Piper Joe** is the local neural voice when its portable runtime/model are
installed. **Check local engine** displays the active voice. Without those files,
the companion visibly reports **Windows voice · basic fallback**. A Piper failure
stops that reply rather than silently changing voices. Rerun setup and restart
the companion to add the neural voice to an existing installation. Natural/Deeper
on the page changes playback pitch/speed, independently of the synthesis engine.

For a reviewed question followed by an answer, synthesis separates the
setup and punchline, adds a 400 ms silent beat, and gives the answer quicker pacing
and mild pitch/energy emphasis. Non-joke replies keep a single synthesis pass.
These are comic delivery effects; Piper does not offer an emotion instruction.
Both synthesis calls share one ten-second deadline, and the assembled WAV must
still fit eight seconds. Invalid or oversized output is rejected, never cut short.

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
   service and shows the active voice; it does not connect Bluetooth or verify
   the speaker. Press it, confirm attendance, then
   **Talk to Skelly**. Stay quiet for one second, say a short phrase and pause.
   Try "Tell me a ghost joke" and "My name is Emma" using a known safe name.
3. Each click listens once for up to eight seconds. The microphone closes before
   transcription, reply selection and speech output. Nothing listens during
   processing, playback or the 45-second pause after playback. Choose Talk again
   after the pause; no automatic rearm is implemented. Natural is the default;
   optional Deeper uses the existing lower/slower playback.
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
Qwen model; approved speech is synthesized locally by Piper Joe, with Windows
System.Speech as the labelled fallback when Piper is absent. After setup,
the code contacts only its fixed loopback model endpoint. Recordings/transcripts
are not logged. The browser holds bounded audio in memory; the companion briefly
uses a system temporary folder for input WAV, transcription and approved speech,
then removes it after each request. Abrupt process/OS termination can leave temp
files, so this is not a guarantee against forensic recovery. Model inference can
also hold transient prompt text in memory. The bounded reply-ID history stores
no prompt, transcript or name.

Input WAVs are capped at eight seconds of 16 kHz mono 16-bit PCM (256,044 bytes).
Replies remain at most eight seconds, with 16 or 22.05 kHz mono 16-bit PCM and a
352,844-byte cap. One audio request runs at a time. Recognition times out at 20
seconds, model selection at 12, synthesis at 10; the browser abandons a pending
reply after 45 seconds. There is no retry or saved transcript/name history. These
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
The owner's subsequent "worked" report confirms conversation resumed; it does
not separately establish a new voice/jaw observation or extended recovery result.

Software-only: unit coverage exercises output/name allowlists, malformed and
injected selections, audio limits, Host/Origin/token/path rejection, request
serialization, capture/playback separation, Stop/late results, network bounds,
UI gating and cooldown retention. Catalog tests cover all 80 lines, stable topic
IDs, bounded history and shared explicit/generic shuffle bags. Voice tests cover
local command construction, visible fallback, reply sample rates/duration and no
silent fallback after a neural failure. Delivery tests verify the punchline beat,
unchanged approved words, a shared synthesis deadline and rejection of mismatched,
oversized or stale output. These tests need no model downloads:

```powershell
node --test studio/tests/conversation*.test.cjs
python tests/test_local_conversation.py
python tests/test_local_replies.py
python tests/test_local_voice.py
```

`python experiments/local-talkback/smoke.py` runs the actual installed engines
with synthetic speech and produces no speaker output or microphone access.
October 26: on the owner's i7-6700 / ~16 GB laptop, synthetic "My name is Emma.
Tell me a ghost joke" produced the approved greeting/ghost joke and valid local
WAV in about 1.6 seconds after model startup with the earlier Windows voice. This is not a live microphone,
Bluetooth, jaw or child-voice accuracy result. A real-engine request also
exercised model selection; the output remained in the approved catalog.
The native browser also completed actual AudioWorklet capture of generated sound
and muted playback of a synthetic approved reply. The latest check captured a
generated tone and used the new 22.05 kHz Piper WAV with Deep rate 0.8 and pitch
preservation off, ending with the microphone off and a 45-second pause without
console warnings/errors. Separately, the production companion page loaded its
versioned assets, reported Piper Joe neural ready and left the microphone off.
These remain Software-only.

October 26 neural-voice checks: all 80 approved variants with a long allowlisted
name produced valid Piper Joe WAVs; the longest observed duration was **6.494
seconds**. The real synthetic recognition → approved reply → Joe WAV pipeline
completed in **3.14 seconds** after engine startup. These checks used no physical
microphone, speaker or prop. The owner's first listening feedback described Joe
as a little better but monotone and requested a punchline pause. Revised comic
delivery, a new jaw observation, guard/name trials and extended sessions remain
**Untested on hardware**.

Revised comic delivery passed a new real synthesis sweep of all 80 lines with the
same long name: maximum **6.61 seconds**, including the inserted pause. The full
synthetic recognition → approved reply → revised Joe WAV pipeline took **2.83
seconds** after startup. The 400 ms beat, unchanged approved words, shared deadline
and fail-closed audio checks have software coverage; audible timing and emphasis
still need the owner's next listening test.

## Pinned sources

- [llama.cpp b11901 Windows CPU release](https://github.com/ggml-org/llama.cpp/releases/tag/b11901).
- [whisper.cpp b5454 Windows CPU release](https://github.com/ggml-org/whisper.cpp/releases/tag/b5454).
- [Qwen2.5-0.5B-Instruct GGUF, Q4_K_M](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF).
- [whisper.cpp tiny.en model](https://huggingface.co/ggerganov/whisper.cpp).
- [Portable legacy Piper 2023.11.14-2](https://github.com/rhasspy/piper/releases/tag/2023.11.14-2).
- [Joe medium voice and MODEL_CARD](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/joe/medium/MODEL_CARD): 22.05 kHz; the card identifies its dataset as CC0.

The setup script pins archive/model hashes. Joe's model SHA-256 matches publisher
Git LFS metadata. The legacy Piper ZIP has no independent publisher digest; its
pin records the SHA-256 of the fixed-version official download. This provides
repeatable download verification, not independent publisher attestation.

Legacy [Piper](https://github.com/rhasspy/piper/blob/2023.11.14-2/LICENSE.md) and
[piper-phonemize](https://github.com/rhasspy/piper-phonemize/blob/master/LICENSE.md)
source carry MIT licenses; the runtime's eSpeak NG phonemizer dependency has
[GPLv3 terms](https://github.com/espeak-ng/espeak-ng/blob/master/COPYING). The Joe
dataset statement does not replace these component licenses. Runtimes and weights
are downloaded from their publishers, not redistributed in the repository or
static Pages site.

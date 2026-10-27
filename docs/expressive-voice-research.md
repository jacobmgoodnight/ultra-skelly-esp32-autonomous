# Expressive voices for Skelly: research and isolated experiments

Research checked October 26, 2026. The existing conversation in draft PR #55 is
stacked on repeat-back PR #54. This note and the research probe are separate from
both: they do not change the running conversation or firmware.

## Recommendation

Keep the attended conversation and its reviewed reply catalog. Prototype a small
hybrid: select the same topic and variant first; play a locally stored recording
only when its exact text and audio have been reviewed and validated; otherwise
use the existing live voice. For a recognized allowlisted name, initially synthesize
the entire personalized line live. No visitor-specific audio or names are saved.
Use one recognizable character voice, with a little variation in performance,
rather than switching to a different speaker for each topic. Do not create 80
recordings until a few have actually sounded better through Skelly.

On this computer, Supertonic 3 is the most promising *measured live candidate*.
On October 27, the owner reported that its prepared samples sounded better than
Piper Joe and Skelly's jaw followed those samples. That result does not establish
live microphone conversation or the accuracy of each spoken phrase. Three
offline replies synthesized in
1.52–1.70 seconds after model load; one synthetic ghost-joke turn took 2.96 seconds
from completed input to a validated reply. These are not physical conversation or
jaw measurements for live conversation. The project has been archived and offers no further support.
Qwen3-TTS VoiceDesign is the stronger *candidate* for expressive prerecorded
performances on a more capable machine; it was not run or listened to here.
Piper remains the simplest low-risk fallback. Do not replace it automatically.

## Current implementation and physical evidence

* Capture is an attended single browser turn. The sound gate calibrates for one
  second, captures a bounded phrase, releases the microphone before processing,
  and does not automatically listen again. Stop, page hide, stale-generation and
  playback guards prevent late playback. The default pause is 45 seconds after a
  reply; the explicit, default-off testing option removes that post-completion wait
  while retaining the interrupted-playback guard.
* Local whisper.cpp `tiny.en` recognizes a 16 kHz mono PCM WAV, then explicit
  topic words take a deterministic route. Otherwise local Qwen **2.5 0.5B** chooses
  a topic ID from a bounded schema. This selection model is not Qwen3-TTS and its
  generated words are never spoken. `ReplyDeck` rotates 80 reviewed lines across
  20 topics. History contains only bounded numeric IDs. Names come from a reviewed
  list; arbitrary words and surnames are not spoken. **Charlotte is not presently
  in that list**, so the prompt example would not yet say her name. Adding any
  name needs its own review, and recognition errors remain possible.
* Local Piper Joe is the installed voice, with a visibly labelled Windows
  `System.Speech` fallback. Piper is started for each fragment. A question is split
  into setup and answer with a 700 ms silent beat and mild speed/pitch/level shaping;
  Natural/Deeper controls browser playback and the latter slows and lowers it.
  None of these is a natural-language emotion instruction.
* Chatterbox Nano is a separately generated CPU sample, not a live engine. The
  owner said it was a little better than Joe but still flat. Kokoro Michael and
  George previews also sounded flat to the owner. The optional ElevenLabs v3
  experiment requires explicit selection and a key; only reviewed name-free
  text is sent, not visitor audio or transcript. It is not yet configured in the
  running companion and has no real-account or physical result here.
* Recognition has a 20-second subprocess bound; model selection has 12 seconds;
  voice synthesis has a shared 10-second bound; the browser abandons a pending
  reply at 45 seconds. Output is mono signed 16-bit PCM at 16 or 22.05 kHz, at
  most eight seconds and 352,844 WAV bytes. Windows routes the browser audio to
  the chosen Bluetooth Live Stereo speaker. On October 26 the owner reported one
  approved Original-voice reply through Skelly with jaw movement. This does not
  verify a new voice, every clip, body behavior or long-term use. A successful BLE
  enable write verifies transport only.

See [conversation details](local-halloween-conversation.md) and the latest
[hardware matrix](hardware-verification.md) for the full boundaries and evidence.

## Candidate comparison

Quality and suitability rankings are provisional: no controlled listening panel
has compared these candidates on this machine. Model instructions and tags are
capabilities, not guarantees that a given output will contain the right words,
sound dramatic, whisper, laugh or preserve a voice consistently.

| Candidate | Delivery and character control | Practical fit and license |
| --- | --- | --- |
| **1. Supertonic 3** | Fixed voice styles and 10 documented inline expression tags including `<laugh>`, `<breath>` and `<sigh>`; no verified free-form character prompt or local cloning path. Not a demonstrated whisper control. Eight-step M1 tested here without tags. | CPU ONNX, approximately 398 MB model assets, 44.1 kHz source. Our measured short clips and model-load timing are below. Cross-platform examples include Windows; the tested Python path returns a complete WAV, not streamed first audio. Archived without support. Code MIT; weights [OpenRAIL-M](https://huggingface.co/supertone-oss-archive/supertonic-3/blob/main/LICENSE) have use conditions. [Model and archive](https://github.com/supertone-oss-archive/supertonic). |
| **2. Piper Joe baseline** | Fast fixed voice, no free-form emotional prompt or cloning in the existing path. Owner reports a flat delivery despite comic timing adjustments. | Already installed, offline, modest CPU and memory. Existing pinned legacy runtime/model licenses must be checked per component and voice; do not assume every Piper voice has the same license. Newer [Piper development](https://github.com/OHF-Voice/piper1-gpl) has different GPL terms from the project's pinned legacy runtime. |
| **3. Kyutai Pocket TTS** | 100M model, streaming and voice conditioning/cloning; no documented natural-language style instruction or silence tag. A good reference may establish character, but expression control and its quality on this machine are unmeasured. | CPU-oriented, Windows Python supported; creator's 200 ms first chunk and 6× real-time were measured on an M4 Mac and cannot be applied here. Project code MIT; model card declares CC-BY-4.0 and voice licenses vary. The [cloning checkpoint](https://huggingface.co/kyutai/pocket-tts) is gated and requires account/conditions; a [non-cloning checkpoint](https://huggingface.co/kyutai/pocket-tts-without-voice-cloning) is available without that gate. Actual storage, RAM and latency for a pinned selection remain unmeasured. |
| **4. Qwen3-TTS 1.7B VoiceDesign** | Explicit natural-language voice descriptions; the official workflow can create a reference and use a separate Base model to reuse its voice. Style/emotion control is promising, but exact voice stability, whisper and laughter need listening trials. Other Qwen3 models differ: 0.6B Base is not VoiceDesign. | [VoiceDesign weights](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign/tree/main) occupy about 4.52 GB in the repository; additional Base weights may be needed for cloning. Apache-2.0. [Official examples](https://github.com/QwenLM/Qwen3-TTS) emphasize CUDA, so Windows CPU setup and time are unmeasured here. Family-level streaming claims do not prove this particular offline code path streams or fits this computer. Best candidate for offline generation on stronger hardware, not a proven live choice here. |
| **5. IndexTTS 2.5** | A reference voice plus emotion reference/vector or text-derived emotion, plus duration controls. `use_emo_text` in 2.5 requires its extra Qwen emotion component. It does not establish reliable nonverbal laughter or whispering for every English prompt. | [2.5 release](https://github.com/index-tts/index-tts/releases) August 2026; [model repository](https://huggingface.co/IndexTeam/IndexTTS-2.5/tree/main) about 5.49 GB before dependencies. Windows setup exists, but GPU-oriented dependencies and CPU speed are untested here. The [bilibili model license](https://huggingface.co/IndexTeam/IndexTTS-2.5/blob/main/LICENSE) is royalty-free under its conditions, including a large-organization threshold and distribution/use restrictions; it is not Apache or MIT. Upstream's reported 2.5 RTF around 0.20 uses an RTX 4090, not this PC. |
| **6. Chatterbox Turbo / Nano** | Fixed/reference voice, with supported nonverbal tags such as `[laugh]` and `[chuckle]`. The original 500M Chatterbox also has exaggeration/CFG controls; don't assume those apply unchanged to Turbo or Nano. No demonstrated free-form voice-design prompt. | [Turbo](https://huggingface.co/ResembleAI/chatterbox-turbo) and [Nano](https://huggingface.co/ResembleAI/chatterbox-nano) list MIT model licenses. Nano runs on Windows CPU in the isolated preview but missed the current live deadline here; Turbo is larger and untested here. Reference cloning requires a suitable authorized recording. No verified streaming/first-chunk figure for our code. |
| **7. Orpheus 3B** | Documented expressive tags include laugh, chuckle, sigh and gasp, plus named speakers; no verified free-form character voice design. | [Apache-2.0 model](https://huggingface.co/canopylabs/orpheus-3b-0.1-ft); [upstream](https://github.com/canopyai/Orpheus-TTS) documents a CPU alternative but its 3B model and inference stack make this an unmeasured, heavy option on this PC. GPU/Windows setup, memory, first audio and full latency are unknown. |
| **8. Kokoro 82M** | Preset voices with naturalness, but no verified instruction prompt or explicit emotion controls. Joe, Michael and George were already heard by the owner as flat; only the latter two are Kokoro. | [Apache-2.0 weights](https://huggingface.co/hexgrad/Kokoro-82M), small enough for CPU. Local preview generation was roughly 8 seconds for two short fragments or 13 seconds for a longer sentence; not integrated or tested as live conversation. Per-voice and runtime dependencies must be checked. |

The independent [CPU benchmark and raw data](https://github.com/gauravvij/kokoro-tts-vs-supertonic-3-tts) uses a four-core Intel Xeon and no GPU. Its five-step Supertonic and Kokoro ONNX tests report RTF 0.316 and 0.571 respectively; automated UTMOS scores are predictions rather than a panel of listeners. Those numbers are not this machine's results and the comparison used different text, software and voices. Two-step Supertonic sounded robotic in that author's assessment, so faster inference should not be mistaken for acceptable delivery.

## Actual measurements and reproducibility

Windows 10; Intel i7-6700, eight logical processors, 15.9 GiB RAM; GTX 745 detected.
The research environment used CPU ONNX Runtime 1.23.1; its CPU-only PyTorch build
reported no CUDA. GPU acceleration was not tested. Available RAM was about 2.7 GiB
at one later observation, and free disk about 14.2 GB before the research download;
these are snapshots, not system requirements.

The Supertonic 3 M1 tests used the archived model revision
`aafc6e32416a594460b32413efc49d7fe4ce6d46` and pinned upstream helper revision
`1e9799e964ea4c0dad7cde993b65c3c813a7b373`. Large downloaded model files matched
publisher metadata SHA-256; the helper matched a recorded hash, which is not an
independent publisher signature. The installed direct Python versions were pinned,
but transitive pip dependencies were not hash-locked. Models and libraries remain
in ignored `.skelly-build` folders. After download, generation used local files.

| Identical approved phrase | Supertonic complete synthesis | Output length | Piper complete synthesis |
| --- | ---: | ---: | ---: |
| Ghost glasses joke | 1.578 s | 4.592 s | 3.584 s |
| Skeleton party joke | 1.518 s | 4.555 s | 1.803 s |
| Skelly introduction | 1.698 s | 5.519 s | 1.189 s |

One model load took 1.189 s in an already active Windows session, not a fresh
boot or a guaranteed cold-cache startup. The research process working set rose
from approximately 543 to 558 MiB across the three samples, excluding the
companion, Whisper, Qwen, browser and Piper child processes. Process CPU time was
6.5–7.1 CPU-seconds per sample, roughly four cores' worth over each wall time;
this is not whole-system CPU utilization. There is one measurement per line,
with no distribution, endurance, concurrent-user or thermal test. Supertonic
was resident; Piper launches a child process for each fragment. The joke renders
are not perfectly matched delivery: Piper adds its beat/shaping, while the
Supertonic probe synthesized a whole sentence. Volumes were matched by turning
louder samples down. On October 27 the owner reported Supertonic sounded better
and the jaw followed its prepared samples; individual intelligibility, timing and
body behavior were not separately reported.

The synthetic full pipeline generated an input phrase locally, then measured
Whisper recognition 1.422 s, direct literal-topic selection 0.001 s, and
Supertonic synthesis, resampling and validation 1.536 s: **2.959 s** from complete
input WAV to ready reply. This does not exercise Qwen for ambiguous input, real
microphone calibration, the visitor's speaking/pause time, browser transfer,
Bluetooth playback or the prop. The helper returns complete audio, so first-audio
latency is not separately measured. An earlier Piper synthetic pipeline measured
2.83 s with different input/delivery; it is not a controlled head-to-head turn.

Previously observed Nano sample: model load 17.05 s, two fragments 23.8 + 6.74 s;
a later run loaded in 22.75 s and generated fragments in 8.99 + 7.89 s. These are
isolated runs with different cache conditions, not a sustained benchmark. Owner
feedback was a little better but still flat; a Nano jaw result was not reported.

`benchmark-supertonic.py` produces three matching-text Supertonic/Piper WAV pairs,
resampling Supertonic 44.1 kHz to 22.05 kHz with a polyphase filter and validating
the existing WAV limit. `prepare-supertonic-comparison.py` creates a local playback
page and turns down louder samples to match RMS. The page opens no microphone or
BLE connection. Audio validity is software evidence; the owner's listening and jaw
feedback applies to the prepared samples only. No samples are automatically
approved for use with visitors.

## Hybrid design and staged plan

1. **Listen first.** A/B the three matched clips, and separately compare an explicit
   `<chuckle>` or pacing variation with the same voice. Check every spoken word,
   volume and the jaw through Skelly. Preserve a friendly spooky tone; model tags
   can be ignored or can generate unexpected words. Use no unreviewed output for
   children.
2. **Prototype a small library**, perhaps four ghost jokes and a few greetings.
   Bind each clip to the existing `(topic, variant)` and exact catalog text. A
   SHA-256 proves only that a previously reviewed file has not changed; human
   listening is still required. Validate rate/channels/duration, full file and
   size before use. About twenty five-second mono PCM clips at 22.05 kHz occupy
   roughly 4.2 MiB, plus metadata; this is arithmetic, not a measured library.
3. **Keep dynamic speech.** The current `approved_reply` discards the variant ID
   before synthesis; a production integration would need to carry it through
   without changing topic selection or bag history. Use the matching reviewed
   recording when present; otherwise synthesize that same approved line with
   Piper. For an allowlisted name, synthesize the entire name-bearing reply live
   initially. Do not cache visitor recordings or names. A small set of separately
   reviewed, commonly used greeting clips is possible later, but concatenation can
   sound unnatural and needs the same duration/jaw checks.
4. **Test the live candidate independently.** If the owner prefers Supertonic,
   add it as a separately selected local engine in a future focused change. Keep
   the 10-second bound and eight-second WAV cap, existing cancellation, microphone,
   history and playback checks. A streaming API would need a new carefully
   bounded cancellation/playback design; this probe uses complete WAVs only.
5. **Only then expand.** Generate a small batch with one consistent character
   description on Qwen3 VoiceDesign, listen and select a reference for related
   performances. Example direction: “A deep, slightly gravelly, playful skeleton
   storyteller; friendly spooky, with a deliberate pause before punchlines.”
   Test whether particular instructions actually work and whether the same voice
   persists. Avoid multiple models, arbitrary voice cloning or an elaborate CMS
   until a demonstrable improvement justifies them.

The isolated `hybrid_probe.py` demonstrates selection and fail-closed checks; its
three unit tests cover matching, missing/tampered/unapproved audio, and names. It
does not read a recording library, generate audio, start the microphone, play a
clip or change production behavior. An `approved=True` bit is only a local probe
input, not proof a human reviewed anything.

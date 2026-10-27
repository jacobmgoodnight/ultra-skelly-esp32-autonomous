# Expressive voices for Skelly: research and isolated experiments

Research checked October 27, 2026. The existing conversation in draft PR #55 is
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

Supertonic 3 is the fastest expressive candidate measured here, but speed alone
does not make it the selected voice. On October 27, the owner reported that its
prepared samples sounded better than Piper Joe and Skelly's jaw followed those
samples. After comparing more options, the owner said MOSS Adam was much better
than MOSS Nathan, but none of the later Adam/Supertonic preset comparisons fit
Skelly yet. That feedback supersedes any earlier suggestion to choose Supertonic
for integration. Three Supertonic
offline replies synthesized in
1.52–1.70 seconds after model load; one synthetic ghost-joke turn took 2.96 seconds
from completed input to a validated reply. These are not physical conversation or
jaw measurements for live conversation. The project has been archived and offers no further support.
Qwen3-TTS VoiceDesign is the next candidate for expressive prerecorded
performances. A compact CPU version's initial load was stopped under memory
pressure; a later bounded run produced a local sample in 18.83 seconds total.
Three name-free previews were also obtained from Qwen's public online demo. The
owner said the theatrical/mischievous sample sounded best so far and that
Skelly's jaw followed it. The owner also said the local Q4 sample sounded less
expressive than the online performance, but definitely better than Supertonic
M1 and probably better than Adam, and reported its jaw response. These are
prepared samples, not live conversation results.
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
| **1. Supertonic 3** | Fixed voice styles and 10 documented inline expression tags including `<laugh>`, `<breath>` and `<sigh>`; no verified free-form character prompt or local cloning path. Not a demonstrated whisper control. The owner did not find a suitable Skelly character among the later M1–M5 and experimental laugh-tag comparisons. | CPU ONNX, approximately 398 MB model assets, 44.1 kHz source. Our measured short clips and model-load timing are below. Cross-platform examples include Windows; the tested Python path returns a complete WAV, not streamed first audio. Archived without support. Code MIT; weights [OpenRAIL-M](https://huggingface.co/supertone-oss-archive/supertonic-3/blob/main/LICENSE) have use conditions. [Model and archive](https://github.com/supertone-oss-archive/supertonic). |
| **MOSS-TTS-Nano ONNX** | Built-in voices and reference-audio voice cloning. The owner said Nathan sounded natural but like an older man that did not fit Skelly; Adam was much better than Nathan but was among the later comparison options that still did not fit. No free-form character instruction or specific expressive tag is established for this version. | [Apache-2.0 ONNX model](https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX) and [audio tokenizer](https://huggingface.co/OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX), about 763 MB of selected files. On this machine a loaded Nathan model needed 7.04–8.53 seconds for three replies, leaving little margin within the current 10-second synthesis bound. The pinned upstream Python wrapper imports CPU PyTorch/Torchaudio even though the ONNX model itself can run without PyTorch. The synthetic-reference MOSS introduction produced an owner-reported jaw response; live conversation remains unreported. |
| **2. Piper Joe baseline** | Fast fixed voice, no free-form emotional prompt or cloning in the existing path. Owner reports a flat delivery despite comic timing adjustments. | Already installed, offline, modest CPU and memory. Existing pinned legacy runtime/model licenses must be checked per component and voice; do not assume every Piper voice has the same license. Newer [Piper development](https://github.com/OHF-Voice/piper1-gpl) has different GPL terms from the project's pinned legacy runtime. |
| **3. Kyutai Pocket TTS** | 100M model, streaming and voice conditioning/cloning; no documented natural-language style instruction or silence tag. A good reference may establish character, but expression control and its quality on this machine are unmeasured. | CPU-oriented, Windows Python supported; creator's 200 ms first chunk and 6× real-time were measured on an M4 Mac and cannot be applied here. Project code MIT; model card declares CC-BY-4.0 and voice licenses vary. The [cloning checkpoint](https://huggingface.co/kyutai/pocket-tts) is gated and requires account/conditions; a [non-cloning checkpoint](https://huggingface.co/kyutai/pocket-tts-without-voice-cloning) is available without that gate. Actual storage, RAM and latency for a pinned selection remain unmeasured. |
| **4. Qwen3-TTS 1.7B VoiceDesign** | Explicit natural-language voice descriptions; the official workflow can create a reference and use a separate Base model to reuse its voice. The owner preferred the theatrical online demo sample and reported its jaw response; exact voice stability, whisper and laughter need further listening trials. Other Qwen3 models differ: 0.6B Base is not VoiceDesign. | [Official VoiceDesign weights](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign/tree/main) occupy about 4.52 GB; additional Base weights may be needed for cloning. The [third-party GGUF conversion](https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF) and [CPU runtime](https://github.com/ServeurpersoCom/qwentts.cpp) offer smaller Windows-compatible files. One local Q4 run took 18.83 seconds end to end, with 13.63 seconds reported synthesis. Live use and sound matching remain untested. Model Apache-2.0; runtime MIT. Family-level streaming claims do not establish live speed here. |
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

October 27, MOSS-TTS-Nano ONNX on the same CPU, preset Nathan, four threads:
one model load took 5.812 seconds. The same three catalog phrases took 8.267,
7.039 and 8.526 seconds to generate as complete audio after loading; converted
audio durations were 5.68, 4.8 and 5.6 seconds. The process working set rose
from 1,477 MiB after loading to 1,734 MiB after the third sample. A separate
first run took 7.234 seconds to load and 9.21 seconds to synthesize the ghost
joke. The runtime internally used streaming decode but returned a complete file;
first audible audio, full conversation, Qwen classification and physical jaw
response were not measured. These are single runs and do not predict other
machines or sustained operation. The owner described Nathan as the most natural,
but not as high-quality or direct as Supertonic and an older-man voice unsuitable for
Skelly; jaw behavior was not separately reported.

Two additional MOSS options were prepared for the same three lines: the Adam
preset, and MOSS guided by the previously generated Supertonic M1 Skelly
introduction. The reference is synthetic, not a visitor's recording. After one
7.669-second load, Adam generated the three lines in 9.505, 9.640 and 9.060
seconds; the synthetic-reference path took 10.334, 9.159 and 10.212 seconds,
including reference encoding each time. Observed process working set reached
2,141 MiB during the latter. These times exceed or leave almost no margin under
the current ten-second live limit; retained reference encodings or a different
implementation would require separate measurement. The resulting 12-sample
matched comparison is a listening preview, not a live conversation or jaw test.
The owner subsequently preferred Adam to Nathan. In the later same-joke page
containing Adam, Supertonic M1–M5 and an experimental M1 laugh tag, the owner
reported that none fit Skelly yet. Neither feedback included a separate MOSS jaw
observation or established whether the laugh tag produced a laugh.

MOSS source revision `8b7bcc9341b3b4ef3a3a58ba1338a7d85ff133eb`, model revision
`f52645cb467506d8e18e746ddd59482685b74e58`, and codec revision
`ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae` were downloaded into ignored output.
Large files matched publisher LFS metadata; the source archive matched a locally
recorded SHA-256, not an independent publisher signature. The wrapper reused the
isolated research and Chatterbox Python environments; dependencies are not fully
hash-locked. The clips were downmixed from 48 kHz stereo and resampled to
22.05 kHz mono for the same existing WAV validation as the other previews.

### VoiceDesign CPU preparation and memory check

On October 27, an isolated Windows CPU executable was built from
`qwentts.cpp` revision `5916bf7c79dbb4e66fc059cdc507a79a23a28bb4` and its
`ggml` submodule `cc5df49a6b878db2b68b9a7b45976e279594627d`. The compact
Q4 VoiceDesign talker (1,182,630,816 bytes) and Q4 codec (254,974,752 bytes)
came from [GGUF revision `b7ee2e8`](https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF/tree/b7ee2e8c7459c3bea99da23e3d178125a7d1713c)
and matched the publisher's SHA-256 metadata. Those hashes establish file
integrity against that metadata, not an independent security audit of the
third-party runtime or converted weights.

The first bounded attempt started with approximately 2.23 GiB available and
was stopped after 3.25 seconds while loading, when available memory fell rapidly;
the sampled peak process working set was 2,493 MiB and minimum available memory
was 302 MiB. No WAV, load time, inference duration, voice quality or live
turnaround was measured. The monitor stopped the attempt; it did not prove the
full model memory requirement. A retry is set to require at least 4.5 GiB free
and to stop if available memory remains below 1.25 GiB. These are conservative
experimental thresholds, not vendor requirements or a guarantee against paging.
The intended test uses a fixed approved joke and a fictional skeleton description;
it needs no microphone, visitor recording or cloud service.

For an earlier listening opportunity without another local load, three samples
were generated with [Qwen's public VoiceDesign demo](https://huggingface.co/spaces/Qwen/Qwen3-TTS)
using only the same fixed ghost joke and different fictional skeleton
descriptions: playful storyteller, theatrical/mischievous, and breathy/whispery.
The provider received the text and description; no microphone audio, visitor
name or API key was submitted. Qwen's model can try to follow those descriptions,
but the labels are requested directions, not verified descriptions of the audio.
Cloud availability, policy and free access may change; this optional preview does
not make the conversation system depend on the service.

The three online request-to-download times were 11.16, 7.83 and 9.51 seconds;
they include remote queuing and network effects and are **not** local model
speed or complete conversation latency. Their 24 kHz mono WAVs were resampled
to 22.05 kHz, matched by reducing louder clips and structurally validated against
the existing eight-second reply bound; the converted lengths were 5.337, 5.577
and 4.537 seconds. An automatic tiny-Whisper check heard the ghost/glasses setup
and variants of the pun, but cannot establish the exact words, safety, voice
quality or a genuine whisper. The owner reported that the theatrical and
mischievous preview sounded best so far and Skelly's jaw followed it. That
applies to one prepared clip only; other performances still require review.
No Qwen live conversation result is reported.

With approximately 5.44 GiB available at the next attempt, the local Q4 CPU
build completed the same fixed joke using the theatrical direction. One
process-start-to-WAV run took 18.83 seconds, including loading, and the runtime
reported 13.63 seconds inside its synthesis pipeline. Its peak sampled process
working set was 3,904 MiB; minimum sampled system available memory was 1,860 MiB.
The 24 kHz mono result was 4.48 seconds long and converted into a validated,
matched-level 22.05 kHz preview. The runtime reported an end-of-sequence marker
after 56 frames. These are one-run figures, not a warm distribution or a full
spoken-turn benchmark; the internal first-frame-code metric is not first
audible audio. Its 13.63-second synthesis exceeds the existing 10-second limit,
so this test does not justify live integration. On listening, the owner said
the online version was more expressive, but the local version was definitely
better than Supertonic M1 and probably better than Adam. The owner also reported
that the jaw followed the local sample. These observations apply to the prepared
ghost joke, not a live conversation or other generated replies.

To investigate a possible local voice match, MOSS-TTS-Nano was given the
synthetic online Qwen theatrical ghost joke as its reference and asked to
synthesize the approved Skelly introduction. No visitor recording or name was
used. One run loaded MOSS in 8.923 seconds, then synthesized the introduction
in 10.123 seconds including reference encoding. The process working set at the
end of synthesis was 2,001.5 MiB; that is not a peak-memory measurement. The
output was 5.84 seconds and passed the existing WAV structural validator.
Reference reuse or other optimizations have not been measured. A one-run result
slightly beyond the ten-second synthesis limit is not evidence of reliable live
performance. The owner really liked the prepared MOSS introduction and reported
that Skelly's jaw followed it, but said it did not sound like the same character
as the Qwen reference. After listening to two further MOSS samples, the owner
said they liked that voice but its sound and delivery varied between responses.
Treat the Qwen and MOSS voices as separate character candidates, and investigate
consistency before integrating either.
An optional public-demo request for the same introduction returned an error of
unknown cause, so the comparison uses the original Qwen ghost joke as the voice
reference and a MOSS introduction; the Qwen reference and introduction do not
use identical words. Later generated MOSS ghost and skeleton jokes provide
additional same-text and cross-phrase comparisons. The owner asked to remove the
basic Adam and Supertonic introductions from the active comparison page. The
owner subsequently reported that both the original-reference and synthetic
MOSS self-reference variants remained inconsistent across replies.

A separate research-only probe kept the fixed synthetic reference encoding in
memory, rather than encoding it for every synthesis. It loaded MOSS in 5.845
seconds, encoded the reference once in 0.572 seconds, then generated a reviewed
introduction and two jokes in 8.267, 7.380 and 7.005 seconds respectively.
The three 22.05 kHz mono previews passed the existing WAV validator; generated
audio lengths were 5.84, 5.28 and 4.88 seconds. Working-set snapshots after
synthesis were 2,001–2,019 MiB, not peak or whole-system usage. The previously
heard introduction was bit-identical in an earlier cached-reference trial using
the same PCM conversion; a later conversion from the unclipped float waveform
differed by at most one 16-bit sample step. Two later raw floats had peaks above
full scale, so the research preview reduces gain before writing; it cannot prove
the audio is otherwise free of distortion. Caching the synthetic reference is an
isolated monkeypatch in the probe, not an integrated feature or a visitor-data
cache. These three runs fit the current synthesis cap but do not establish
end-to-end latency, worst-case reliability, safety of generated words or physical
results for the new clips.

Because the owner liked the MOSS introduction but heard variation across lines,
another isolated probe used that **synthetic MOSS introduction itself** as the
fixed reference. It loaded in 5.824 seconds, encoded the reference once in 0.635
seconds, then synthesized the ghost and skeleton jokes in 7.787 and 10.355
seconds. The latter exceeds the current ten-second synthesis bound. Before PCM
output, the resampled float peaks were 1.388 and 0.999 and gain was reduced to
0.685 and 0.951 respectively; the validated clips were 5.52 and 5.92 seconds.
An automatic Whisper check struggled with the second joke's words; this could
reflect the recording, recognition, or both, so the owner must listen rather
than treating the transcript as proof. The owner reported that both reference
variants sounded inconsistent. Jaw response to the self-reference samples and
live operation remain unreported. No visitor audio or name was used.

For a synthetic input-to-ready probe, a resident MOSS model with the same
in-memory reference produced one direct-topic ghost reply in 7.721 seconds
after the synthetic input WAV was complete (1.092 seconds recognition, 6.601
seconds synthesis, plus selection/conversion). An earlier attempt did not pass
the direct ghost-topic recognition check; its transcript was not retained.

A subsequent three-turn synthetic probe loaded the model and reference in
6.553 seconds, before timing turns. The ghost and pumpkin inputs were recognized
as their intended direct topics and yielded validated WAVs in 7.067 and 9.099
seconds from completed input respectively; their synthesis portions were 5.871
and 7.986 seconds. The synthetic skeleton input was transcribed as “Tell me a
skull and joke,” so the probe stopped that turn before synthesis. It did not
call the companion's ambiguous-topic Qwen fallback, so this is not a measurement
of how the actual system would handle that input. These are very few generated
inputs, not a recognition accuracy estimate. All timings exclude real speech,
microphone calibration/capture, browser transfer, the Live Stereo connection,
prop playback and actual first audible output; they do not establish reliable
live conversation or physical safety.

### Smaller Qwen voice-matching probe

After the owner found both MOSS reference approaches inconsistent, a separate
CPU test used the smaller Qwen3-TTS 0.6B Base Q4 model with the same synthetic
theatrical Qwen ghost-joke reference. This model performs voice matching; it is
not the 1.7B VoiceDesign model that accepts a free-form character description.
The [GGUF conversion](https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF) was
downloaded at revision `b7ee2e8c7459c3bea99da23e3d178125a7d1713c`; the
628,905,056-byte talker matched publisher SHA-256
`4b468ec7b1f62b90ef4ca316c0aa57deadfd54b2cf9651703ea753cedaf04226`.
The experiment reused the 254,974,752-byte Q4 codec and previously built CPU
runtime. It uses a fictional generated sample, never visitor audio.

One voice-only match synthesized an introduction with a fresh process in
15.282 seconds, with 13.001 seconds reported in the synthesis pipeline. Two
voice-plus-transcript matches synthesized an introduction and skeleton joke in
26.000 and 24.031 seconds from process start, with 23.768 and 21.679 seconds
reported pipeline time. The samples were 5.36, 5.60 and 4.80 seconds long;
each reported end-of-sequence and was converted to a validated 22.05 kHz WAV.
Sampled peak process working sets were 2,925, 3,488 and 3,435 MiB. These are
individual fresh-process measurements, not resident warm distributions; they
exceed the current ten-second synthesis bound and are not complete-turn or
first-audible measurements. Cached reference representations or a different
implementation might change timing but have not been measured here.

An automatic Whisper check approximately recognized the intended words, but it
cannot approve the content, character, consistency or intelligibility. A local
comparison page presents the original theatrical reference, the liked MOSS
introduction and both Qwen matching modes. The owner preferred match B over A,
but said neither sounded like the theatrical reference or liked MOSS voice.
The owner reported jaw response when asked about playing the new local matches;
the response did not identify individual clips. Voice stability across more
lines and live operation remain unreported.

### Larger Qwen match of the liked MOSS voice

As a further isolated consistency test, a third-party Qwen3-TTS 1.7B Base Q4
talker was conditioned on the **synthetic MOSS introduction the owner liked**,
using its written transcript and the same Q4 codec. The 1,219,245,248-byte
model file matched publisher SHA-256
`ea393ebaf2167ea23ce9fc18b093822851358a950d7075cd47ab4f6ce23e887d` at the
same GGUF revision; this is file integrity against publisher metadata, not an
independent security audit. No visitor recording or personal name was used.

A skeleton joke and ghost joke completed in 29.688 and 29.828 seconds from
separate process starts; the runtime reported 26.122 and 26.816 seconds of
pipeline time. Peak sampled working sets were 4,620 and 4,605 MiB, and minimum
sampled available memory was 1,751 and 1,773 MiB. Both 24 kHz mono outputs
reported EOS, were 5.36 and 5.12 seconds long, and were converted to validated
22.05 kHz WAVs. An approximate automatic speech check heard the expected jokes,
but this does not prove the exact words or approve them. These two runs exceed
the current synthesis limit; they measure neither steady-state synthesis nor a
complete live turn. A focused listening page compares the liked MOSS
introduction with MOSS and Qwen versions of each joke. The owner reported the
larger-Qwen skeleton joke was a pretty good match to the MOSS introduction and
that Skelly's jaw followed it. After hearing the ghost joke as well, the owner
said the character mostly stayed consistent but wanted a spookier, more
skeleton-like voice. The jaw observation covers the skeleton sample; live
conversation and extended operation remain unreported.

The owner wanted a spookier, more skeleton-like character. Four additional
1.7B VoiceDesign Q4 previews of the same approved introduction were generated
locally using fictional voice descriptions; no visitor audio was used. A and B
took 26.16 and 23.20 seconds per fresh process (20.991 and 20.701 seconds
reported pipeline time). C and D took 22.33 and 23.20 seconds per fresh process
(19.868 and 20.757 seconds reported pipeline time). Sampled process peaks were
about 4.0 GiB. All reported EOS, fell within the existing eight-second WAV bound
and were matched by turning down louder previews. A Whisper check approximately
heard the intended introduction, but heard the name as “Skilly” in A; that is
not proof of what was spoken, so the actual words require listening. The owner
said neither A nor B fit yet but kind of liked A, and reported a jaw response
when asked about either design without identifying individual clips. C and D,
their voice consistency across lines, and their jaw responses are unreported.

To investigate speed without saving visitor data, a separate probe encoded the
fixed synthetic MOSS reference once. Extraction took 2.938 seconds, then one
fresh Qwen Base process generated the same skeleton joke in 26.875 seconds with
24.431 seconds reported pipeline time. Its WAV was byte-identical to the
previous uncached skeleton WAV. The earlier uncached run reported 26.122
seconds in the pipeline; these are individual runs, not a controlled performance
distribution. Reference caching alone did not bring this run under the current
ten-second limit. The cache contains only the fictional synthetic reference,
never visitor recordings or names, and is not integrated into conversation.

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

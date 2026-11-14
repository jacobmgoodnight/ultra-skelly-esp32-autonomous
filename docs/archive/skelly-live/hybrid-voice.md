# Reviewed hybrid character voice

The optional Windows conversation companion can play a reviewed local character
performance for the exact selected reply, or synthesize that reply locally when
no eligible recording exists. The library starts **empty**: no generated audio
is automatically approved. The 80 family-friendly lines and randomized selection
remain in the existing catalog, with four variants for each of 20 topics. The
selected topic and variant travel together through lookup and response. This is
separate from autonomous firmware and does not change BLE or motor cooldowns.

## Start and compare

Install the local conversation tools once and start the companion from the
repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-talkback-local.ps1
python experiments/local-talkback/companion.py
```

Setup downloads dependencies; after installation the local path operates
offline. Open **http://127.0.0.1:8766/** in Chrome or Edge. Follow the attended
speaker setup and recovery instructions in [Local Halloween conversation](local-halloween-conversation.md).
Check the local engine and confirm attendance. In **Character voice**, choose
**Reviewed performance · local fallback**, then **Play voice sample**. The
sample uses the same greeting, topic 1 variant 0, every time. Choose **Local
synthesized voice only** and play it again for a comparison. The status identifies
the recording voice or the synthesis engine actually used. If the greeting has
not been approved, both choices use the local synthesizer. A different randomly
selected reply can likewise use fallback even when other recordings exist.

Piper Joe is the local neural fallback when its runtime and model are installed;
otherwise the companion displays the basic Windows voice. A synthesis failure is
reported rather than silently retrying or switching voices. The online ElevenLabs
experiment is separate and optional; select a local option for offline operation.
Use Natural playback for character review: the existing Deeper control also
changes playback pitch and speed and is not a reviewed character performance.

The runtime selects from the approved text catalog, never speaks model-generated
words, and retains only bounded numeric reply IDs for rotation. Visitor audio and
transcripts are passed in memory for recognition and topic selection; this path
does not save visitor recordings, transcripts, or names and does not personalize
the spoken reply with a visitor name. Temporary synthesis files contain only the
selected catalog text and its generated audio. Stop, hiding the page and the
existing cancellation and playback guards continue to apply.

## Generate a candidate offline

Use one fictional, synthetic character reference and its exact transcript, not
a visitor recording. The owner liked the MOSS introduction, but heard variation
across other MOSS replies; the theatrical Qwen sample was preferred to earlier
presets. A later Qwen 1.7B match was described as mostly consistent across an
introduction and two jokes but needed a spookier character. A subsequent design
E was closer, though still not spooky enough. Treat these as promising references,
not final approval or proof of consistent delivery across all 80 lines. See
[voice research](expressive-voice-research.md) and the
[research setup](../../../experiments/voice-research/README.md) for the measured
comparisons, source revisions, licenses, and model preparation. Large model
downloads and the CPU build require internet and disk space initially; generation
below uses local files and no microphone.

Set up the research environment and `qwen-tts.exe`, the Q4 codec and the 1.7B
Base Q4 talker as described in the research setup, including
`download-qwen-design.py` and `download-qwen-base.py --large`. The candidate
generator also uses the research environment's NumPy, SciPy, soundfile and
psutil. Generate a reference using the research workflow, listen to it and write
its exact spoken words in a UTF-8 text file. The reference must be synthetic and
locally available. For example, substitute your actual reference paths below:

```powershell
python experiments/local-talkback/review_library.py starter
.skelly-build/voice-research-env/Scripts/python.exe experiments/voice-research/generate-candidate.py 1 0 --reference .skelly-build/voice-research/samples/my-synthetic-reference.wav --reference-text .skelly-build/voice-research/samples/my-synthetic-reference.txt --voice "Qwen character" --delivery "playful greeting"
```

`starter` prints 16 varied catalog IDs and their exact text. Repeat generation
for the desired IDs; all 80 catalog entries can be staged, not just the starter
set. The generator checks the process completion, memory and time limits,
resamples to mono 22.05 kHz 16-bit PCM, reduces peaks above 95% full scale and
rejects silence or output over eight seconds. It stages the result as
**unreviewed** under `.skelly-build/reviewed-voice`, prints its expected words
and SHA-256, and never approves it. Generated speech may omit, change or invent
words even when these software checks succeed. The delivery description is a
review note, not a promise that an engine supports whispering or laughter.

Existing compatible performances may instead be staged directly:

```powershell
python experiments/local-talkback/review_library.py stage 1 0 path/to/candidate.wav --voice "Qwen character" --delivery "playful greeting"
```

Staging accepts complete uncompressed mono 16-bit PCM WAV at 16 kHz or
22.05 kHz within the existing eight-second and byte limits. Replacing an entry
marks it unreviewed again. Keep candidates and references locally; do not put
visitor audio into this library.

## Listen and approve each exact file

1. Run `python experiments/local-talkback/review_library.py review-page` and
   open the displayed local HTML file to compare the complete recordings with
   their expected text, review status and hashes. Regenerate the page after any
   library change; opening it does not approve anything. Alternatively, run
   `python experiments/local-talkback/review_library.py list` and open the staged
   WAV in a local player. For each **unreviewed** entry, listen to the
   **entire** recording, including its beginning and ending, while reading the
   exact text. Reject omissions, additions, unclear words, clipping or an
   unsuitable performance. Automated transcription and a valid WAV are not
   substitutes for listening.
2. Compare greetings, jokes, questions and exclamations at a comfortable matched
   volume. Check that the same character remains recognizable and intelligible;
   choose playful or spooky takes and punchline pauses by listening. Approve
   whispers or laughter only if they are actually audible and appropriate; no
   unsupported emotion tag or post-processing guarantees them.
3. Only after that review, copy the printed SHA-256 for the exact file into:

   ```powershell
   python experiments/local-talkback/review_library.py approve 1 0 PASTE_AUDIO_SHA256_HERE
   ```

   Use the correct topic and variant for each recording. If anything changes,
   stage it again and listen again before approving its new hash. `list` shows
   review status. A hash binds the reviewed file; it cannot establish that a
   human listened or that the words are correct.

At playback, the manifest must have exactly one approved entry for the selected
IDs, matching catalog text and text hash, expected filename, audio hash, and
compatible complete WAV. Missing, altered, duplicate, incompatible and unreviewed
entries are ignored in favor of synthesized catalog text. Do not hand-edit a
manifest to bypass review. The manifest and approved files are local artifacts,
not shipped preapproved performances.

## Performance and verification

On the owner's Windows i7-6700, a resident Supertonic research model generated
three complete short replies in 1.52–1.70 seconds after a 1.19-second model load
in an already active session; neither establishes fresh-boot cold startup. A
synthetic direct-topic turn took 2.96 seconds from completed input WAV to
validated reply, excluding capture, speaking, browser transfer, Bluetooth and
audible playback. These are individual research measurements, not guarantees
for the hybrid runtime. Large Qwen Base reference-matching runs took about 30
seconds from separate process starts; they are suitable for offline candidate
generation, not the existing ten-second live synthesis limit. Do not select a
voice solely on generation speed. For a useful deployment measurement, record
cold startup separately from repeated warm turns, and time from completed real
speech through audible playback; note capture, transfer, selected source and
speaker, and test both a reviewed hit and fallback. Do not record visitor audio
or transcripts to make the measurement.

On the same Windows machine, a synthetic hybrid HTTP benchmark using the real
local recognizer, an isolated temporary recording fixture, and Piper Joe measured
2.024 and 1.480 seconds for successive recorded turns, then 5.596 and 5.250
seconds for synthesized fallback turns. Setup including input and fixture
generation and model startup took 17.688 seconds. These are software-only
measurements, not a clean cold-start measurement: the fixture generation warms
Piper and the operating-system cache, and each fallback still starts a Piper
process. They cover the request from a completed synthetic input WAV through a
validated HTTP reply, not real capture, browser playback or Bluetooth. To repeat
the isolated test after local setup, run
`python experiments/local-talkback/benchmark_hybrid.py`. The full spoken-turn
time to audible output and clean cold startup remain **Untested**.

**Software-only:** review bindings, source selection and fallback can be tested
with `python -m unittest discover -s tests -p test_reviewed_voice.py`; these
checks do not establish what an audio file says or what the prop does. The owner
previously reported jaw movement for particular prepared samples and one
original-voice conversation turn; this does not verify every new recording,
hybrid route, speaker session, interruption or recovery.

For an **attended physical test**, first follow the isolated setup and recovery
procedure, disconnect the ESP32 including USB, disconnect other controllers,
select Skelly's Live Stereo speaker and begin at low volume. Preview an approved
greeting, then exercise an approved hit and a fallback on separate turns. Listen
for the expected complete words and character, confirm the displayed source and
observe actual speaker output and jaw movement. Stop on unexpected motion or
audio; follow the documented recovery before restoring autonomy. Record which
specific clips, sources and outcomes were observed. A successful software test
or BLE write does not prove sound, lighting or movement; unobserved cases remain
**Untested**.

# Halloween conversation: decisions, tests and milestones

Planning snapshot: October 27, 2026. This is a proposed roadmap, not a claim
that the future behaviors have been tested. The project can stop after any
milestone and retain the last working setup.

## Destination

A visitor speaks to the laptop microphone. Skelly gives a varied, reviewed,
family-friendly Halloween reply through the Windows-selected Live Stereo
speaker, with a recognizable character voice and the jaw responding to the
sound. The initial target remains an **attended** exhibit with a local,
no-account core. Keep repeat-back a separate, clearly labelled mode: it can
repeat inappropriate visitor speech and has no conversation word guard.

One owner-reported Original-voice conversation reply and one two-phrase
repeat-back pilot worked through Skelly with jaw movement. They do not prove a
new voice, long sessions, automatic conversation, reconnect behavior, or
coexistence with the autonomous ESP32. The [hardware matrix](hardware-verification.md)
and [research note](expressive-voice-research.md) detail those limits.

The laptop is currently the audio computer: it captures and processes speech,
selects the reply, and plays audio through Windows. An ESP32 microphone is not
needed for these milestones. The existing page is push-to-talk, one attended
turn at a time; it is not yet an automatic, open-ended AI conversation.

## Decision sequence

Decisions are made as evidence becomes available, rather than all at once.

| Decision | Proposed default | Evidence that can change it |
| --- | --- | --- |
| Character voice | One friendly, mischievous character; vary its delivery modestly. | Compare the same lines at matched volume through Skelly and ask which one the owner prefers. |
| Live voice | Keep Piper until an alternative fits the character and meets response and reliability targets. | Test an appealing character voice end to end; do not select a voice purely because it is fast. |
| Recorded library | Small hybrid library of individually reviewed complete replies; live fallback for missing clips. | If live speech is already expressive enough, start without recordings. |
| Personalized names | Only a reviewed first-name allowlist; synthesize the full greeting live initially. No persistent visitor-name cache. | Decide later whether short, approved name clips improve continuity without causing awkward joins or retaining visitor data. |
| Session memory | No cross-turn visitor name memory initially. | If desired, add short-lived, explicit, resettable session memory after the single-turn experience is reliable. |
| Listening mode | Attended push-to-talk first; quick-testing option remains explicitly selected. | Test any automatic-listening design separately, with clear visible state and an immediate stop. |
| Hosting and cloud | Local/offline at runtime for the core experience. ElevenLabs stays explicitly optional. | The owner may choose to compare cloud audio; it must not become required for core functionality. |
| Physical setup | Laptop mic plus Windows Live Stereo; ESP32 disconnected during isolated tests. | After reliability tests, evaluate a USB microphone or separate controller integration. |

The existing allowlist does **not** include Charlotte. A later change could
review and add that name; it should not silently permit arbitrary visitor text.
The current code adds an allowlisted name only to the current reply and does not
remember it for a later visitor turn.

The recordings and the live voice also need to sound like the **same character**.
A recording from a more expressive model followed by a Piper name greeting may
sound like two different speakers. First try preparing and live-generating with
the same selected voice; producing several candidates offline and reviewing the
best can improve a performance, but does not give a model capabilities it lacks.
If a heavier model's recordings are much better, test a compatible local voice or
authorized reference on a lighter engine before committing to that combination.
Whether a voice transfers cleanly, runs quickly and is licensed for the chosen
use remains an experiment, not a guarantee.

## Milestone 0: first listening comparison

October 27 owner report: Supertonic sounded better than Piper Joe, and the jaw
followed the prepared Supertonic samples. Later the owner preferred MOSS Adam to
Nathan, but said none of the Adam/Supertonic preset comparison sounded like the
desired Skelly character. Qwen3-TTS VoiceDesign accepts a voice description; the
owner subsequently said the theatrical/mischievous fixed-text sample generated
by Qwen's public demo sounded best so far, and its jaw followed. A compact local
CPU version then generated that joke in one 18.83-second process run; its
reported 13.63-second synthesis exceeds the current 10-second synthesis bound.
The owner said the online performance was more expressive; the local sample was
definitely better than Supertonic M1 and probably better than Adam, and its jaw
followed. Other Qwen phrases, live conversation, full-turn timing and other
physical behavior remain unreported. The owner also really liked a MOSS
introduction generated with a synthetic Qwen reference and said its jaw
followed, though the voice sounded like a different character. Evaluate it as a
separate candidate rather than assuming a faithful match. The owner likes MOSS
across further clips but reported that its voice and delivery vary between
responses with both original and self-reference variants. Consistency is a
current decision gate; neither variant is yet a selected live voice.
The owner preferred the smaller local Qwen voice match B to A, but neither
matched the desired character; a jaw response was reported without individual
clip identification. These are listening results, not live-conversation tests.
The larger Qwen model later produced a prerecorded skeleton joke the owner said
was a pretty good match to the liked MOSS introduction; its jaw followed. Two
fresh-process generations took about 30 seconds each, so the existing live
synthesis deadline remains unmet. Check consistency across other lines before
making a character choice. The owner later reported the character mostly stayed
consistent across the ghost and skeleton jokes but wanted a spookier,
more skeleton-like sound.

For a more detailed comparison, use the existing page, with the ESP32
including USB unplugged and other control apps disconnected. Set Windows output
to the connected Live Stereo speaker. Start quietly, then compare the same three
Piper and Supertonic clips at matched average level. For each, record:

1. Which voice sounds more like Skelly and whether the words are understandable.
2. Whether the joke timing is effective and the jaw visibly follows.
3. Whether volume, distortion or the Bluetooth connection changes.

The Supertonic sample synthesizes a full phrase; Piper's joke path adds a
700 ms pause and mild shaping. Thus this is a practical comparison of the
prepared performances, not a controlled test of voice alone. If delivery is
promising, compare a matching pause and one `<chuckle>` performance with the
same voice before deciding on the style. The tag may be ignored or produce an
unwanted sound or word; it is not an automatic safety guarantee.

**Exit:** owner selects a preferred sound or decides none is good enough; record
the observation separately from any jaw observation. If Supertonic is flat,
do not integrate it just because it is fast. A/B the next plausible model or a
small set of higher-quality prepared performances instead. ElevenLabs remains
unresolved: the running companion says the key is not configured. Troubleshoot
the launcher privately if the owner still wants that optional comparison; do
not request a key in chat or transmit visitor audio for the test.

## Milestone 1: choose and prove a local live voice

For a voice the owner likes, run a separate local prototype before connecting it
to the conversation page. Use the same three to five reviewed lines and measure
complete WAV generation, resource use and failures on this computer. Then measure
the entire path from the end of a phrase to the first audible response on the
real speaker, including recognition and any Qwen selection. Also record cold
start, warm start, the slowest turn, audio duration and clarity. Streaming model
claims are not equivalent to a fast end-to-end turn.

Initial *targets for discussion*, not established safety limits: aim for a
typical response beginning within about 3–5 seconds after a clear phrase ends,
and no repeated long stalls. Measure at least ten varied, attended turns and
report the median and slowest; do not claim a tail percentile from a tiny sample.
Retain the current 10-second synthesis and eight-second WAV bounds unless a
separate reviewed change has evidence to justify different values.

Supertonic 3 generated three short WAVs in 1.52–1.70 seconds each on the owner's
i7-6700 after loading. A synthetic, direct-topic input-to-validated-WAV turn took
2.96 seconds; it excluded microphone, real visitor speech, Qwen ambiguity,
Bluetooth and the prop. Its local archive has stopped development. Consider
[MOSS-TTS-Nano ONNX](https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX)
as a second CPU candidate: its authors document reference voices, streaming and
an Apache-2.0 model. In an October 27 software-only test on this machine, a
resident model generated the three comparison replies in 7.04–8.53 seconds;
the process used up to 1,734 MiB. Its 48 kHz stereo output was downmixed and
resampled into validated 22.05 kHz mono WAVs. The owner said the Nathan preset
sounds natural but does not suit Skelly; live conversation, first audible sound
and jaw response have not been reported. An
authorized or appropriately licensed reference is required for voice copying.

[OmniVoice](https://huggingface.co/k2-fsa/OmniVoice) is another candidate for
preparing a few character performances: its documentation describes voice
attributes including whisper and a laughter marker. Its 0.6B model's speed and
quality on this computer are untested, and its pretrained weights use a
noncommercial license even though its code is Apache-2.0. That distinction
matters if the project is later distributed or used commercially. Compare it
with Qwen3 VoiceDesign only if the owner wants to try a heavier offline model.

**Exit:** one selected live voice is clearly preferable in listening tests,
produces correct and intelligible reviewed lines, fits existing bounds, and
works in repeated software tests. Otherwise keep Piper and pursue recordings.

## Milestone 2: small reviewed recording library and hybrid routing

If approved performances improve the sound, prepare a small set—perhaps four
ghost jokes and four greetings—rather than generating the entire catalog.
Listen to each full file, check words and volume, and approve it explicitly.
Tie each recording to the exact approved topic, variant and text. Before use,
verify the recording's digest, file length, mono PCM rate and eight-second limit.
A hash detects changes; it does not prove that the original audio was safe.

Select the topic and variant with the existing shuffle bags before choosing
audio. A matching approved recording is played as a single normal conversation
reply; if it is missing, stale, damaged or unapproved, synthesize the same
approved text with the selected live voice. For an allowlisted name, synthesize
the complete name-bearing line live rather than joining mismatched speakers.
Do not preserve visitor speech, name-to-reply mappings or reusable visitor audio.

The current `approved_reply` returns topic and text but discards variant ID, so
production integration requires a small reviewed change that carries the ID
without changing the shuffle behavior. The current hybrid probe only tests the
concept; it is not connected to the conversation page. Prepared clips should be
visually identifiable as reviewed in the simple workflow, with a reliable path
back to the fallback voice. Per-topic playful, spooky or suspenseful delivery is
an optional label for a small number of clips, not an invitation to create a
large content management system.

The conversation page uses the Windows default output. A Windows device change
can redirect that default; the current local-engine check does not verify the
speaker. The attended operator should confirm the selected output and hear a
quiet test through the prop before proceeding.

**Exit:** software tests prove the reviewed-ID mapping, name fallback, bounds,
failure cases, cancellation and unchanged reply selection. An attended prop
test confirms both a prepared clip and a live fallback are audible with the jaw
following; no hardware result is inferred from a passing software test.

## Milestone 3: improve the conversation without losing the guard

Exercise greetings, ghost/skeleton jokes, “another joke,” unrelated requests,
goodbye, an allowlisted first name and an unknown name. Start with adults or
synthetic test phrases; do not collect or keep recordings of children. Include
noisy-background and soft-voice trials when a realistic venue is available.

Consider adding a small amount of explicit session context—such as remembering
a reviewed first name until Stop, timeout or a clear reset—only after the owner
chooses that behavior. A new visitor must not inherit the previous visitor's
name. Do not infer identity from a voice or store names in logs. Keep Qwen's
output constrained to topic selection and continue speaking only reviewed text;
raw repeat-back and arbitrary model-generated speech do not become the guarded
conversation. More genuine open-ended conversation would need a separately
designed family-content review and evaluation, not merely a larger model.

**Exit:** owner confirms the conversation feels varied and responds to the
listed cases. Unsafe or unclear requests use an approved neutral fallback.
Tests demonstrate name isolation and absence of persisted transcripts.

## Milestone 4: reliable attended Halloween setup

Run a longer, attended session using the selected voice and physical prop. Test
separately: Start/Stop, tab hide, microphone permission denial and device change,
Bluetooth speaker disconnect and manual recovery, local engine failure, and
fallback on damaged/missing recordings. Verify that no late audio plays after
Stop and the microphone is off during speech. A completed enable write alone
cannot prove the speaker or jaw is operating.

Use the normal cooldown unless the owner explicitly chooses the existing quick
testing option. That option removes the 45-second wait after completed playback;
closely spaced physical operation has not been verified. Measure and observe
before proposing any change to default limits or unattended operation. Keep a
simple launch/check/stop guide and a fallback to the last known working voice.

**Exit:** the owner reports the attended checklist results, including audio,
jaw, Stop/recovery and body behavior. Any missing observation remains Untested.
A longer event or unattended mode requires its own test and approval criteria.

## Milestone 5: setup and integration choices

* **Microphone:** the laptop mic is proven for one attended conversation turn.
  A separate USB or wired mic is the simplest next placement experiment; compare
  pickup range, noise and echo before buying or designing new electronics. A
  Bluetooth mic/speaker combo may switch the *same device* into a hands-free
  audio profile when its microphone is opened; this does not establish that an
  independent Bluetooth mic will force Skelly's separate speaker to switch.
  Test actual endpoints and output. [Microsoft's Bluetooth profile description](https://learn.microsoft.com/en-us/windows-hardware/drivers/bluetooth/bluetooth-classic-audio)
  explains the distinction.
* **Automatic listening:** design a distinct attended pilot with a clear on/off
  indicator, no capture while Skelly speaks, no self-triggering, bounded turns,
  explicit stop, and tested cooldown. Preserve push-to-talk as the fallback.
* **ESP32 coexistence:** only after audio is dependable, investigate whether
  Skelly accepts the existing autonomous BLE controller while Windows uses its
  Live speaker. BLE connection success does not prove simultaneous audio,
  correct jaw/motor behavior or safe scheduling. Define mutually exclusive
  control ownership and test with conservative existing motor limits; no firmware
  integration or assumption of radio compatibility is part of the current lab.
* **Studio:** the repeat-back and conversation experiments remain separate
  while testing. A later Studio entry point can link to a stable local companion,
  but must not add an account, backend, Wi-Fi requirement or new runtime
  dependency to the offline sketch generator. Integration needs its own review.

PR #54 (repeat-back) is based on `main`; PR #55 (conversation) is stacked on
PR #54; PR #56 (voice research) is stacked on PR #55. All three are currently
drafts. Their dependency order matters for later review and any user-authorized
merge; no physical outcome follows merely from green CI.

If a particular Halloween event is close, the scope can stop at a working,
attended push-to-talk setup with the best voice already tested. Automatic
listening, new hardware and concurrent ESP32 control can remain future work.

# Hardware verification matrix

**2026 app-controlled 12-foot Skelly: Untested on hardware.** Its opt-in profile
has software-only evidence; none of the Ultra observations below transfer to it.
See the [feature matrix and attended checklist](experimental-12ft.md).

Latest evidence: engineering handoff and October 20–27, 2026 reports on one Ultra
Skelly v2 with an original ESP32-WROOM board. **Verified** means a reported physical
observation, **Failed** an observed unsuccessful physical test, **Software-only**
automated checks or serial dispatch evidence, **Untested** no qualifying observation.
Historical experiment entries retain their original chronology; this table is
the current status. A transport success alone does not verify an actuator.

| Behavior | Status | Evidence / limit |
| --- | --- | --- |
| Universal browser USB connection, settings read/save | Verified (owner report) | October 23: owner confirms browser identification, reading saved settings, saving changes and observing the changed routine on the prop. This supersedes the October 22 identification failure; its exact cause remains unconfirmed. No timing log or exact saved profile supplied. |
| Saved-settings power-cycle retention/recovery and scene transitions | Untested on hardware / Software-only coverage | The connection/read/save report does not establish retention after power loss, interrupted-transfer recovery, or ordered/random scene transitions. Native storage and scene coverage remains separate. [Follow-up](usb-settings-scenes.md). |
| Connected USB diagnostics and automatic status refresh | Owner-confirmed usability; detailed fault paths Software-only | October 23: owner says the published separated USB workflow works great. HELLO/CAPS and STATUS replies were also supplied. Cancellation, stale snapshots and detailed fault paths retain mocked browser coverage; counters acknowledge controller state, not movement or lighting response. |
| Scene cards, draft recovery, compact lighting and complete scene looks | Owner-reported checklist pass; detailed paths Software-only | October 23: owner says the focused checklist seemed to work; no per-item results supplied. Browser editing and compile coverage; no new claim of physical integration, saved-settings retention or scene transitions. [Short checklist](studio-scene-builder-checklist.md). |
| BLE name discovery, AE00/AE01 WRITE_NR | Verified | Successful real commands; scan/connection failures also occur |
| Head `0x01` | Verified | ~25 s; protected standalone operation retained |
| Arm `0x02` | Verified | Two moves totaling ~22 s |
| Torso `0x04` | Verified | ~25 s |
| Single-frame masks `0x03`, `0x05`, `0x06`, `0x07` | Verified | Selected motors activated, without MP3; compound completion durations unmeasured |
| Recurring random compound scheduler | Verified (owner report) | October 22: owner reports random combined body movements work. No timed log, exact settings or extended run supplied. New interleaving with standalone routines remains Untested. |
| Separate motor-command overlap | Failed | October 22: owner reports a following separate action stops the prior movement. Removed from Studio; generated sketches force serialization, including imported profiles. Single-frame combinations remain separate. |
| Jaw MP3 files #12, #13, #14 on original device | Verified | Device-specific serials; #13/#14 sustained holds ~3 s |
| Saved movement flags `0x00` with jaw playback | Verified | Jaw still responds without stored full-body animation |
| MP3 sent after body movement interrupts it | Verified | Observed interruption; internal cause unknown |
| MP3 → 2 s → arm / torso | Verified | Jaw continues while selected body motion occurs |
| MP3 → 2 s or 10 s → head | Failed | Logged head writes, no visible head motion |
| Alternating recurring jaw-first arm/torso (~30 min) | Software-only | Repeated dispatch without logged disconnect/skip; individual pairings physically verified, every full cycle not separately confirmed |
| Standalone head with protected alternating follow-ups | Verified | User reported it appeared to work after lock correction; not a multi-hour endurance result |
| One-shot and randomized live eyes | Verified | Actual eye changes observed |
| Eye restoration around MP3 | Untested | MP3 eye override observed; correction requires observation |
| Live torso/head RGB initialization | Verified | Both colors changed before MP3 in latest test |
| MP3 overwrites live torso/head colors | Verified | File #13 restored saved colors |
| Post-MP3 RGB restoration (mode 1) | Verified | October 21: user confirms both red body and green head return after MP3 #13; isolated jaw/lighting setup, four cycles logged |
| During + after restoration (mode 2) | Untested | Experimental, OFF unless selected |
| Channel 1 is specifically mouth LEDs | Untested | Protocol labels it Head Light; exact LED region needs mapping |
| Garbled serial output around jaw/restore | Verified | October 21: later jaw-only and pool logs are clean, but corruption recurs during idle-break and reconnect runs. Intermittent cause remains unknown. |
| Serial-only idle diagnostic | Verified | October 21: all four START/END bursts and completion received cleanly; heap 331,404 / minimum 299,452 stable. One run without BLE; controller serial corruption remains unresolved. |
| New restoration guards, failure handling, timing/wrap tests | Software-only | Executed actual C++ with mocked BLE/time; not hardware proof |
| Automatic power-cycle reconnect / many reconnects | Software-only | Test08 logs two successful recoveries, canceled pending restore and resumed MP3/light writes; user tentatively reports it worked. Three-cycle visual/endurance criteria remain incomplete. |
| Multiple-file jaw pool (#12/#13/#14) | Verified | Test04: user confirms all three clip identities; six logged selections 13,13,13,12,13,14, no reported write failures; isolated jaw setup. |
| Idle breaks | Software-only | Test05: two complete 30.002-second logged pauses followed by playback; user says it seemed to work. Uninterrupted physical completion not explicitly confirmed. |
| Inactive cooldowns after ~24.9 days connected | Software-only correction | Initial defect reproduced; normal loop service now retires elapsed cooldowns. Canonical/generated tests retain jaw scheduling across 60 simulated days and wrap. No multi-week physical result. |
| Body cooldown accounting during a blocking BLE call | Software-only correction | Head/arm/torso/compound timers now start after the write returns. Tests with 5-second simulated latency retain full cooldowns, including wrap; actual latency/physical impact unmeasured. |
| Fresh BLE service discovery on reconnect | Software-only correction | Writer invalidated before explicit cache rediscovery; native tests reject empty discovery, missing services/characteristics and disconnect. Repeated physical recovery/heap test pending. |
| USB-set clock windows | Software-only | Native tests cover no-time pause, malformed input, weekday/overnight boundaries, window-entry fresh targets and timer wrap. Hardware still untested; clock invalid after every restart. |
| Optional fair body turns | Software-only | Stress tests with restoration and coarse loop service reproduce jaw-priority starvation; enabled fairness dispatches jaw and standalone/compound body while retaining protection. Default OFF; no physical result. |
| Per-file playback estimates | Software-only | Generator and host coverage for selected file durations; fallback 21 seconds by default, accepted values 21–120 seconds. No actual end confirmation. |
| Passive AE02 playback observations | Software-only | Bounded callback queue, malformed/overflow handling and disconnect cleanup tested; raw duration units, CRC/framing and natural EOF remain unverified. No timer or motor control. Default OFF. |
| Browser USB capture / prebuilt installer | Software-only | Mocked stream cleanup, original-byte capture, package/hash rejection and local UI checked. No real USB capture or flashing performed. |
| Selected-palette rotation | Verified (owner report) | October 22: owner explicitly confirms rotating lighting palettes work. Exact palettes, interval and integration settings were not supplied; clock/idle/jaw integration remains separately scoped. |
| Per-channel lighting effects | Verified (owner report) | October 22: owner explicitly confirms lighting effects work. Individual channels/effects and speed measurements were not enumerated; no claim of all speeds, LED-region mapping or jaw restoration integration. Packet CRC/order/spacing retain native coverage. |
| Browser manual repeat-back through Live speaker | Verified (owner report) | October 26: Windows pairing with PIN 1234 succeeded; owner confirms sound from Skelly and jaw following the recorded phrase, with the autonomous ESP32 unplugged. Three-phrase manual repetition, body-still criteria and return to autonomy were not separately reported. See [repeat-back lab](experimental-talkback.md). |
| Automatic nearby repeat-back pilot | Verified (owner report) | October 26: in one attended two-phrase pilot with the ESP32 unplugged, owner confirms both phrases repeated through Skelly with jaw movement, then the pilot stopped. Longer sessions, physical Stop/hidden-page checks, body-still criteria and return to autonomy remain Untested; capture bounds and microphone cleanup retain Software-only coverage. Default OFF; separate browser experiment. |
| Local guarded Halloween conversation speaker/jaw response | Verified (owner report) | October 26: one attended Original-voice turn using the laptop microphone and Live Stereo output produced an approved reply through Skelly with jaw movement, with the ESP32 unplugged. The exact name/joke, body-still criteria, physical microphone-off/cooldown/Stop/hidden-page behavior, guard/name trials, child-voice accuracy, Deep output, longer sessions and return to autonomy were not separately verified. Reply/name guards retain Software-only coverage. See [local conversation](local-halloween-conversation.md). |
| Conversation quick voice testing | Software-only / Untested on hardware | The explicit, default-off testing option skips the 45-second wait after a completed reply; interrupted playback retains a pause until 15 seconds after playback began. It cannot erase an earlier pause. No physical test of closely spaced replies or resulting jaw behavior has been reported. |
| Optional ElevenLabs conversation voice | Software-only / Untested on hardware | Mocked tests cover reviewed name-free text, explicit selection, bounded audio and failures. No real-account synthesis, sound or jaw result has been reported. The normal local voice remains the default. |
| Chatterbox Nano sample | Listening feedback reported / Jaw unverified | The owner described the prepared sample as a little better than Joe but still flat. Jaw movement was not separately reported. On the laptop, sample generation exceeded the live synthesis limit; Chatterbox is a preview rather than a live conversation voice. |
| Supertonic 3 prepared samples | Verified (owner report), limited scope | October 27: the owner reports Supertonic sounded better than Piper Joe in the prepared comparison and the jaw followed the Supertonic samples. This reports listening and jaw response to the prepared clips, not live microphone conversation, speech accuracy, individual phrase results, body behavior or extended operation. |
| MOSS-TTS-Nano Nathan prepared samples | Listening feedback reported / Jaw unverified | October 27: the owner reported Nathan sounded most natural, but not as high-quality or direct as Supertonic, and like an older man that did not fit Skelly. A MOSS jaw observation was not separately reported. These were prepared samples, not live conversation. |
| MOSS Adam and expanded Supertonic samples | Listening feedback reported / New jaw results unverified | October 27: the owner said MOSS Adam was much better than Nathan. In a later same-joke comparison containing Adam, Supertonic M1–M5 and an experimental M1 laugh tag, the owner reported that none fit Skelly yet. No separate MOSS jaw result or laugh-tag outcome was reported; the earlier Supertonic jaw report remains scoped to its prepared samples. |
| Qwen VoiceDesign theatrical samples | Verified (owner report), limited scope | October 27: the owner said the theatrical/mischievous ghost-joke sample from Qwen's public online demo sounded best so far and Skelly's jaw followed it. The local Q4 CPU version was less expressive but definitely better than Supertonic M1 and probably better than Adam; its jaw followed too. Both were bounded prerecorded samples. This does not verify another phrase, live conversation, body behavior or sustained use. |
| MOSS introduction using a synthetic Qwen reference | Verified (owner report), limited scope | October 27: the owner really liked the prepared MOSS introduction and reported that Skelly's jaw followed it, although it did not sound like the same character as the original Qwen reference. The owner liked further MOSS samples but reported inconsistent delivery and voice across responses, including both original and synthetic self-reference variants. The models used generated reference clips, not visitor recordings. Jaw behavior on later clips, live conversation, body behavior and extended use remain unreported. |
| Qwen 0.6B voice-matching samples | Verified (owner report), limited scope | October 27: the owner preferred match B to A, but neither sounded like the liked theatrical or MOSS character. Asked whether the jaw followed the new local matches, the owner said yes without identifying individual clips. This does not verify every clip, live conversation, body behavior or sustained use. |
| Qwen 1.7B matching a synthetic MOSS voice | Verified (owner report), limited scope | October 27: the owner said the prepared Qwen skeleton joke was a pretty good match to the liked MOSS introduction and that Skelly's jaw followed it. After hearing the additional ghost joke, the owner said the character mostly stayed consistent but wanted a spookier, more skeleton-like voice. The jaw observation covers the skeleton clip; live conversation, body behavior and extended use remain unreported. |
| Locally designed spookier Qwen voices | Listening feedback and limited jaw report | October 27: for the first two designs, the owner said neither fit yet but kind of liked A. Asked whether the jaw followed either new voice, the owner said yes without identifying individual clips. Two further designs have not been assessed; live conversation, body behavior and extended use remain unreported. |
| Live speaker reconnection and conversation resumption | Verified (owner report), limited scope | October 26: after a control-service timeout and unavailable Windows Live output, a fresh prop power-cycle/hard refresh preceded a completed enable write and Windows Live connection. The owner subsequently said conversation worked. Discovery duration and the effective recovery step are unknown; repeated recovery, a new specific sound/jaw observation and endurance were not separately reported. |
| Expanded approved reply variety and Piper Joe voice | Software-only; listening feedback reported | 80 reviewed lines across the same 20 topic IDs; four-variant bags, rotating generic jokes and bounded numeric reply history retain no visitor text/names. The 700 ms comic delivery synthesized all 80 with a long allowlisted name within eight seconds (maximum 6.436 s). One earlier 400 ms synthetic recognition/reply/Joe WAV pipeline took 2.83 s. The owner requested a longer pause and said the voice still sounds flat. The new pause's audible timing, a new jaw observation, guard/name trials and extended sessions remain unverified. Windows fallback is visibly labelled; input/reply audio remain bounded to eight seconds. |

October 22 refresh follow-up: the owner reports completing all Studio refresh
checks except lighting and USB. This records the reported pass for the previous
refresh; no logs, per-row timings or independent observations accompanied it.
It does not verify the subsequent faster retry policy, new Haunted intervals or
interleaved combined scheduler. The later lighting/effect report above supersedes
the earlier pending status. The October 23 browser connection/read/save and
observed changed routine report also supersedes the earlier USB failure.


Optional audio-scene preview: browser uploads and stored clip metadata, exclusive
mode 3, settling/restoration and reconnect protection are **Software-only / Untested
on hardware**. Existing isolated jaw/light confirmations do not verify the new
integrated path. Follow the separate [attended result sheet](audio-scenes.md).

October 24 consolidation: read-only firmware/activity status, local conversion/trim/preview, file-label mismatch guards and scene comparison have Software-only evidence. No new flash, real BLE upload, retention/recovery, physical transition or motor/eye/light observation was performed. Existing owner confirmations remain scoped as above. [Current status](status.md) and [next checks](next-release-checklist.md).

Browser installation refresh: recommended Connect → Install → Configure flow,
public model-specific packages, hash/identity/bounds checks and recovery guidance
have software coverage only. **Physical browser flashing remains Untested**; the
owner used Arduino for the reported installation. Follow the
[short attended checklist](browser-installation.md#short-attended-hardware-checklist).
No new USB retention, scene transition or prop behavior pass is recorded.

October 25 scene look workspace: descriptive eye names, per-model browser-only
favorites/nicknames, scoped look application/copying, staged palette edits, saved
scene strip and animated swatch samples have **Software-only** evidence. Browser
effect speed is illustrative and strobe is capped at two flashes per second; no
physical effect calibration or new eye/light/scene observation was performed.

# Hardware verification matrix

**2026 app-controlled 12-foot Skelly: Untested on hardware.** Its opt-in profile
has software-only evidence; none of the Ultra observations below transfer to it.
See the [feature matrix and attended checklist](experimental-12ft.md).

Latest evidence: engineering handoff and October 20–23, 2026 reports on one Ultra
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

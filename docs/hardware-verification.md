# Hardware verification matrix

Latest evidence: engineering handoff and October 20–21, 2026 reports on one Ultra
Skelly v2 with an original ESP32-WROOM board. **Verified** means a reported physical
observation, **Failed** an observed unsuccessful physical test, **Software-only**
automated checks or serial dispatch evidence, **Untested** no qualifying observation.
Historical experiment entries retain their original chronology; this table is
the current status. A transport success alone does not verify an actuator.

| Behavior | Status | Evidence / limit |
| --- | --- | --- |
| Universal USB settings, persistent recovery and scene rotation | Software-only / physically Untested | Actual C++ mocked UART/NVS/time covers chunk ordering, CRC/ranges, idle boundary, failed storage, corrupt-slot recovery, sequence wrap and connected scene timing. Pinned ESP32 compilation does not verify real NVS/USB or prop behavior. [Separate follow-up](usb-settings-scenes.md); existing checklist remains in progress. |
| Connected USB diagnostics | Software-only / physically Untested | Bounded status/protocol tests; counters and readback acknowledge firmware state, not movement or lighting response. |
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
| Selected-palette rotation | Software-only / physically Untested | First selected palette, no immediate repeats, spacing, clock/idle gating, jaw/restoration deferral, timer wrap and reconnect covered by native C++; visual pairs and integration need observation. |
| Per-channel Strobe/Pulsing and speed | Software-only / physically Untested | F2/F6 derived from upstream live handlers, CRC/length/order checks and static six-write regression covered. LED regions, actual effects and speed response need attended tests. |

October 22 refresh follow-up: the owner reports completing all Studio refresh
checks except lighting and USB. This records the reported pass for the previous
refresh; no logs, per-row timings or independent observations accompanied it.
It does not verify the subsequent faster retry policy, new Haunted intervals or
interleaved combined scheduler. Lighting and browser USB remain pending.


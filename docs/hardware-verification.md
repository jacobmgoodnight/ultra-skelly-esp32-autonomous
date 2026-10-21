# Hardware verification matrix

Latest evidence: engineering handoff and October 20–21, 2026 reports on one Ultra
Skelly v2 with an original ESP32-WROOM board. **Verified** means a reported physical
observation, **Failed** an observed unsuccessful physical test, **Software-only**
automated checks or serial dispatch evidence, **Untested** no qualifying observation.
Historical experiment entries retain their original chronology; this table is
the current status. A transport success alone does not verify an actuator.

| Behavior | Status | Evidence / limit |
| --- | --- | --- |
| BLE name discovery, AE00/AE01 WRITE_NR | Verified | Successful real commands; scan/connection failures also occur |
| Head `0x01` | Verified | ~25 s; protected standalone operation retained |
| Arm `0x02` | Verified | Two moves totaling ~22 s |
| Torso `0x04` | Verified | ~25 s |
| Single-frame masks `0x03`, `0x05`, `0x06`, `0x07` | Verified | Selected motors activated, without MP3; compound completion durations unmeasured |
| Recurring random compound scheduler | Untested | Implemented and compile-tested; no extended physical run |
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
| Garbled serial output around jaw/restore | Verified | October 21: persists with lighting OFF; two affected lines across three logged MP3 requests, each with 64 replacement characters; original UART bytes and cause unknown |
| Serial-only idle diagnostic | Software-only | Core 3.3.12 compile and native cadence/wrap checks pass; attended UART/USB/monitor comparison untested |
| New restoration guards, failure handling, timing/wrap tests | Software-only | Executed actual C++ with mocked BLE/time; not hardware proof |
| Automatic power-cycle reconnect / many reconnects | Untested | Retries implemented; full lifecycle and heap endurance not established |
| Idle breaks, multiple-file pool integration | Untested | Generated/compiled, no new physical evidence |


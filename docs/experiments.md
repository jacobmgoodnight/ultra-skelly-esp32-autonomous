# Experiment log (field observations, October 2026)

This is a chronological record: earlier "untested" and "next test" statements
describe their time of writing. Use the [current verification matrix](hardware-verification.md)
for latest status and the [testing guide](testing.md) for the next procedure.

A short record of iterative tests performed on one Home Depot Ultra Skelly v2, using an ESP32-WROOM-32 board and the community web controller.

## 1. Discovery and BLE link

- Scanned and found advertisement `Ultra Skelly v2`.
- Located service AE00, write-no-response AE01, notify AE02.
- Initially connecting within `onResult()` could stall after `Connecting...`.
- Resolved by copying the discovered device, stopping/finishing the scan, and **connecting afterward**.

## 2. Head-only control

- Verified `AACA` with head bit `0x01` triggers a full approximately **25-second** head animation.
- A **7-second** cooldown ensures a 32-second minimum safe start-to-start interval.
- Random head starts configured every **32–60 seconds**, not 32–60 seconds after completion.

## 3. Torso-only test (disabled thereafter)

- Verified `AACA` with `0x04` moves the torso for approximately **25 seconds**.
- Intentionally omitted torso commands from the public head/jaw controller. Arm not tested separately.

## 4. Stored audio and jaw

- AAD0 list returned **11 audio files** on the test Skelly: six factory `Default Sound` files plus custom recordings. All initially reported saved movement flag `0xFF`.
- Playing factory file serial 1 with AAC6 moved mouth, head, arm, torso simultaneously because saved movement flag was all enabled.
- Disabling per-file movement to `0x00` in the web controller caused **only the jaw** to move during audio playback.
- The physical speaker-volume knob was set to **zero**, and the jaw still moved, making jaw motion effectively silent.

## 5. Jaw envelope experiments

- Slow volume ramps: jaw open ~6 sec, closed ~3 sec, with no visibly smooth intermediate position.
- Regular pulses: jaw open ~1 sec, closed ~0.7 sec.
- Quick bursts: <0.5-sec jaw movements were observed; some very short bursts appeared partly opened because the jaw did not visibly reach full travel. This is an appearance observation, **not proof of proportional positional control**.
- A volume-threshold test did not cause movement until about five seconds into playback; that might indicate threshold or startup latency and was not conclusively isolated.
- We created a ~20-sec irregular-burst MP3, then revised it with two longer (~0.86–0.90 sec) events to mix short and longer openings.

## 6. Independent schedules

- Confirmed stored jaw file serial **12** playing with `AAC6`; received `BBC6` playing=true/false acknowledgments reporting duration 20 seconds.
- Tested the ESP32 head and jaw schedules with overlap enabled; **simultaneous head and jaw motion worked**.
- Mouth starts every **45–90 seconds**; head starts every **32–60 seconds**.

## 7. Next experiment: Eyes

- Community controller source documents **18 eye icons** and `AAF9` live eye-selection packet.
- A standalone one-shot Arduino sketch has been added; **the hardware outcome has not yet been reported**.
- Experimental periodic eye selection is available in main firmware behind a default-OFF flag.

## Future tests

- Eye icon IDs / restore behavior during audio playback.
- Automatic recovery after timer-controlled power-off and power-on.
- Stability through hours of unattended use; real motor cooldown/heat observation.
- Optional distinct short and long jaw files with weighted selection; different eye schedules.

## October 2026: optional torso and arm configuration

Re-confirmed that the individual torso command `AA CA 04` previously worked (~25 seconds). The web controller defines arm bit `0x02`, but the standalone arm command has not yet been tested on this particular Skelly. A one-shot test was added; Studio's Haunted preset enables torso but **not arm**, with a global motor cooldown preventing simultaneous head/torso/arm activity. See [body movement guide](body-movements.md).

## October 20, 2026: arm action measured

The one-shot arm-only `AA CA 02` command worked. Skelly moved his arm **twice back-to-back**, finishing after **22 seconds**. The controller's arm activity timer now uses 22 seconds plus 10 seconds cooldown. Torso-only had previously been verified (~25 seconds) and doesn't need a repeat solely to validate its command; combinations with other motors are untested. The Studio **Subtle** preset turns off jaw audio; **Haunted** now enables torso and arm but keeps body overlap off by default. Two 20-second jaw-tone files with three-second sustained openings are provided as experimental recipes. See [jaw personality guide](../audio/jaw-personalities.md).


## October 20: 3-second jaw holds and MP3/body priority

The user uploaded and verified both new audio recipes on the real Ultra Skelly v2: **file #13** is the Long Open clip and **file #14** is Whisper Then Gasp. Both produced approximately **3-second sustained jaw openings**, with closing between the audio events. These serial numbers are specific to the original test device and are not universal.

When the experimental head/arm/torso body-motor overlap was enabled, those body movements appeared capable of overlapping, but triggering a stored **jaw MP3** seemed to interrupt **arm and torso** motion. Our current hypothesis is that **AAC6 playback reapplies the MP3's saved head/arm/torso movement flags `0x00`**, taking priority over previously started `AACA` commands. This is an observed correlation, **not yet isolated protocol-level proof**. The log shows requests sent, not confirmation that all motors continued to completion.

To test the hypothesis, a new option **Protect arm + torso from jaw MP3** postpones AAC6 until both body animations and safety buffers finish, then pauses new arm/torso commands until jaw audio finishes. Head/jaw overlap remains separately controlled. The protection algorithm is experimental and needs on-device validation.

Previous Studio minimums of **90 seconds torso** and **120 seconds arm** were conservative user-interface restrictions while physical movement was unverified. They were not BLE-protocol limits. New minima are **45 seconds** for each part (vs measured ~25 seconds torso +10 s buffer and 22 seconds arm +10 s buffer). Frequent repetition increases motor duty cycle; use longer intervals for unattended displays.

## October 20 — jaw-first body overlap physically confirmed

The user tested **AAC6 jaw MP3 first, then AACA arm 2 seconds later** using jaw clip **#13**. The three-second jaw hold stayed open and both arm movements completed (~22 seconds). The separate jaw-first **torso** test also worked. This is the first on-device confirmation of simultaneous jaw+arm and jaw+torso action in this project. It does not prove simultaneous **head+torso+arm**, which remains a separate test.

The posted serial logs contained repeated `JAW-FIRST: scheduled` lines, matching the **earlier** prototype build; the corrected one-shot firmware prints `JAW-FIRST ONE-SHOT: scheduled`. A successful one-shot in that newer build is limited to one per BLE connection.

A new optional **recurring jaw-first** mode now coordinates the selected arm/torso with the next jaw clip **only when its configured random interval is due**. Unlike the proven one-shot sequence, this longer-running scheduler still needs field testing. See [jaw-first testing guide](jaw-first-experiment.md).

## October 20, 2026 — second jaw-first tests, independent movement distinguished

The user ran **jaw file #12 → 2-second delay → arm** with head OFF, torso OFF, arm ON and confirmed the jaw and complete arm animation worked together. Serial Monitor reported `JAW-FIRST ONE-SHOT` and only one coordinated follow-up; a later jaw clip played by itself. In a separate run using **jaw file #13 → 2-second delay → torso** with head OFF and arm OFF, the combined jaw/torso action also worked.

The torso run subsequently logged independent `TORSO command sent` events with random next-torso targets of ~46–50 seconds, plus `JAW deferred: waiting for arm/torso cooldown.` Those **later torso events were standalone timer triggers**, not evidence that recurring jaw-first had been tested. `JAW deferred` means jaw playback was held until the previous torso animation and its buffer finished.

The earlier and present results establish reliable-looking jaw-first arm/torso overlap on this physical prop under these test conditions. Full unattended reliability remains unmeasured.

An opt-in **Alternate arm or torso when due** mode was added to Studio (requires both motors enabled and recurring mode ON). Each motor retains its own random due interval; when both are eligible for a jaw clip the controller prefers the motor not selected on the preceding successful coordinated movement. The actual alternating cadence has **not yet been physically tested**.


## October 20, 2026 — alternating recurring scheduler: six consecutive successful follow-ups

In a combined **Head OFF / Jaw ON / Arm ON / Torso ON** test, the user selected **ALTERNATING** with **2-second jaw-first delay**, **RECURRING frequency-gated**, **body overlap OFF**, **jaw body-protection ON**, and jaw MP3 **#13**. The ESP32 discovered and connected to Skelly after one unsuccessful scan and a retry. The initial jaw MP3 played without a motor follow-up; subsequent eligible clips logged exactly:

```text
JAW-FIRST RECURRING: scheduled ARM
JAW-FIRST: sending ARM after MP3 start
JAW-FIRST RECURRING: scheduled TORSO
JAW-FIRST: sending TORSO after MP3 start
JAW-FIRST RECURRING: scheduled ARM
JAW-FIRST: sending ARM after MP3 start
JAW-FIRST RECURRING: scheduled TORSO
JAW-FIRST: sending TORSO after MP3 start
JAW-FIRST RECURRING: scheduled ARM
JAW-FIRST: sending ARM after MP3 start
JAW-FIRST RECURRING: scheduled TORSO
JAW-FIRST: sending TORSO after MP3 start
```

This is **six of six successful BLE command dispatches**, alternating **3 arm / 3 torso**, with no logged skips, motor-cooldown failures, or disconnects in the excerpt. Random *next motor target* intervals were **arm 69, 77, 71 seconds** and **torso 71, 60, 82 seconds**. Jaw target intervals were roughly **45–54 seconds**. These are logged scheduling targets, not externally measured completion times.

**Status:** recurring alternating *command scheduling verified on the real ESP32 over multiple cycles*. Previous hardware tests independently verified that jaw-first arm and torso motions work together. The new log alone cannot confirm that each physical movement completed, nor unattended reliability over hours. The exact **two-second** inter-command spacing is configured and logged, but no timestamped trace was provided to measure its accuracy independently.


## October 20, 2026 — 30-minute alternating jaw-first endurance run

**Test configuration:** Ultra Skelly v2, ESP32 BLE, **head OFF, eyes OFF, jaw ON, torso ON, arm ON**; jaw MP3 file **#13** (original device only); **body motor overlap OFF**, **jaw body-protection ON**, **JAW_FOLLOWUP_MOTOR = ALTERNATING**, **recurring frequency-gated** and **2,000 ms follow-up delay**.

**Connection:** One initial scan did not find the prop. The next scan discovered it and connected after scanning finished. No BLE disconnect, reconnection, or frame-send failure was logged after connection.

**Observed over the user's approximately 30-minute run:** one initial jaw-only play, then repeated `JAW-FIRST RECURRING: scheduled ARM/TORSO` messages, each followed by jaw playback and `JAW-FIRST: sending ARM/TORSO after MP3 start`, in an uninterrupted ARM → TORSO → ARM → TORSO pattern for the remainder of the supplied excerpt. The log shows **more than thirty** successful-looking coordinated BLE dispatches and no reported skipped follow-ups. Arm *next target* intervals in the log were approximately 60–88 seconds, torso next targets approximately 60–84 seconds, and jaw next targets roughly 45–59 seconds. These are targets printed by the scheduler, not independent timestamps or measured physical durations.

**Validation status:** The **alternating recurrence and BLE dispatch scheduler has now passed a ~30-minute field run**. Earlier tests separately confirmed physical jaw+arm and jaw+torso co-motion and the jaw's 3-second hold. This serial log does **not** independently verify that *every* movement physically completed, rule out occasional MP3 eye resets (eyes were OFF), establish long-term motor endurance, or establish full head+body+jaw concurrency (head was OFF). Those remain distinct follow-up tests.

**Next test:** Enable head with its known-safe 32–60-second timing while keeping the alternating jaw/body setup. Observe visually whether head, jaw and the selected arm/torso remain uninterrupted, especially when their scheduled start times are close. Optionally add eyes in a separate test before turning on everything for extended unattended operation.


## October 20, 2026 — head + jaw + alternating arm/torso integration exposed a body-lock conflict

After successful 30-minute alternating jaw/arm/torso scheduling with head OFF, the tester enabled HEAD while keeping AAC6 jaw MP3 (#12), TORSO, ARM, recurring ALTERNATING, a 2-second follow-up, MP3 body protection ON and global body overlap OFF. Serial Monitor reported repeated `HEAD command sent` followed by `JAW command sent ... (OVERLAPPING head motion)`, `JAW-FIRST RECURRING: scheduled ARM/TORSO`, then `JAW-FIRST: skipped; motor cooldown or body lock active.` No arm or torso follow-up was sent in that excerpt. The user also observed that jaw playback appeared to stop the ongoing head movement.

**Root cause in the code:** `JAW_PROTECTS_ARM_TORSO` formerly checked `torsoSafeAfter` and `armSafeAfter` but not **`headSafeAfter`**. Thus AAC6 was sent during head animation, while head still owned `bodySafeAfter` for 25s + 7s. The jaw-first arm/torso follow-up 2 seconds later was rejected by the shared motor lock. Because recurring alternating mode intentionally disables the standalone arm/torso timers, the skipped follow-ups left those motors stationary. This was a scheduler bug, not evidence of motor hardware failure.

**Fix:** With MP3 body protection ON, now hold jaw AAC6 while **head, arm, or torso** is within its animation-and-safety-buffer window, and block new standalone **head/arm/torso** starts while MP3 playback is due or active. A jaw-first coordinated arm or torso is still the single deliberate exception after AAC6 starts. Serial now logs `JAW deferred: waiting for head/arm/torso cooldown.` when required. This change overrides the independent head+jaw overlap toggle when protection is ON; head and jaw take turns. It is **new firmware**, compiled/tested in CI but requires physical revalidation on this Skelly.

**Recommended next run:** Head ON at 60–90s, jaw ON file #13 at 45–60s, arm+torso ON at 90–150s each, recurring alternating jaw-first 2s, body overlap OFF, protect head/arm/torso from MP3 ON, eyes OFF. Look for complete head animation followed by a deferred jaw (if due), and subsequent `JAW-FIRST: sending ARM/TORSO`. Check physically that neither motion gets cut short.


## October 20, 2026 — head enabled with alternating arm/torso: protected sequencing worked

Follow-up to the first head-enabled conflict: The user ran **Head ON, Jaw ON, Torso ON, Arm ON**, jaw file **#13**, recurring jaw-first **ALTERNATING** with 2-second delay, body overlap OFF and head/arm/torso MP3 protection ON. After two BLE connection failures and an intervening scan miss, it connected on a later attempt. Post-connection logs included multiple `HEAD command sent`, `JAW-FIRST RECURRING: scheduled ARM/TORSO`, `JAW-FIRST: sending ARM/TORSO` and `JAW deferred: waiting for head/arm/torso cooldown.` No motor-lock follow-up skips were reported in the excerpt. The user said this **seemed to work**, which supports the head-safe sequencing correction; every physical animation's completion was not individually measured.

### Next targeted experiment: jaw MP3 first, head ~2 seconds later

Independent head movements appear to be interrupted by AAC6 when MP3 playback starts mid-head action. Previous *jaw-first* arm and torso commands worked, so an opt-in **HEAD after jaw** mode has been added as a new, **unverified** option. Use head ON, arm/torso OFF, MP3 #13 ON, 2s delay, one-shot recurring OFF, MP3 protection ON, and body overlap OFF. The firmware temporarily blocks independent head triggers until the first successful one-shot follow-up, preventing an accidental global body-lock conflict. Then it resumes independent head activity. Record whether the 3-second mouth hold continues and the 25-second head animation completes. See [head test instructions](jaw-first-head-test.md).

### Full body overlaps

The advanced global body overlap setting permits *separately scheduled* HEAD, ARM and TORSO commands to begin while other motors are still moving, subject to their individual cooldowns and 600ms BLE-write spacing. It does **not** prove the prop physically supports all movements at once. Test pairwise combinations with jaw OFF, then all three attended. Do not equate the verified jaw+arm/torso combination with verified head+arm+torso concurrency.


## October 20, 2026 — jaw-first HEAD sent, but motor did not move (two trials)

The user ran two isolated jaw-first HEAD sessions: **Head ON**, **Jaw file #13 ON**, **Arm/Torso OFF**, **body overlap OFF**, MP3 protection ON, one-shot HEAD follow-up at **2 seconds**. Both logs printed `JAW-FIRST ONE-SHOT: scheduled HEAD`, `JAW command sent (file #13)`, `JAW-FIRST: sending HEAD after MP3 start (UNTESTED)`, and `HEAD command sent`. The user observed the head **did not actually move immediately after the jaw began**, whereas subsequent ordinary HEAD commands were transmitted and the original standalone head movement has been physically verified in prior testing.

A printed `HEAD command sent` is confirmation of a BLE write, **not physical movement**. The observation disproves the assumption that the successful jaw-first ARM and TORSO ordering automatically works for HEAD. Possible explanations include MP3 playback suspending head motion or distinct motor-priority logic in Skelly's controller; these are hypotheses, not proven internal behavior.

**Status:** one-shot jaw-first HEAD at 2 s **tested, physically unsuccessful**; head-alone and jaw-first ARM/TORSO remain validated. The Studio HEAD diagnostic option remains opt-in and now warns that the 2 s test failed. An optional attended **10-second** delay test could determine whether a brief MP3 startup suppression is responsible.

The upstream movement bitfield has independent **head 0x01, arm 0x02, torso 0x04** bits. To investigate head+body overlap separately *without a jaw MP3*, a new supervised [one-shot combined-mask sketch](../experiments/BodyComboSingleTest/BodyComboSingleTest.ino) supports `0x03` head+arm, `0x05` head+torso, `0x06` arm+torso and `0x07` all three. **None of these composite masks has yet been physically tested on this Skelly.** See the [combination guide](body-combo-test.md).


## October 20, 2026 — HEAD suppressed during MP3 at 10s; compound HEAD+ARM verified

**Jaw-first HEAD diagnostic:** A third physical trial used jaw MP3 **#13** and a **10,000 ms** head follow-up. The ESP32 printed `JAW-FIRST: sending HEAD after MP3 start` and `HEAD command sent`, but the user again reported **no physical head motion**. Earlier 2,000 ms trials also failed. This establishes that the suppression is not confined to the first two seconds of the MP3, although the specific firmware arbitration rule has not been established. Standalone head motion and protected sequencing still work.

**One-packet multi-motor test:** The dedicated `BodyComboSingleTest.ino` (no MP3) was set to mask **`0x03`** and transmitted **`AA CA 03 00 00 00 00 00 00 00 D7`** after BLE connection. The user **observed both HEAD and ARM moving**. **TORSO stayed still as expected**, since bit `0x04` was not requested. This is the first physically confirmed **combined AACA movement mask** on this prop, distinct from the prior sequential body motor scheduler. The user did not separately report completion times for these two movements.

**BLE discovery friction:** Three successive one-shot runs failed to find the advertising Skelly in the sketch's single 5-second scan. A fourth run found it and connected, after which the motor command was sent once. The isolated test sketch was improved to automatically retry up to **eight 5-second scans**, with a 10-second pause between missed scans, while still sending exactly **one** motor command once connected.

**Next:** Test `0x05` (HEAD + TORSO) as another *single* isolated motor packet, without jaw audio. Then `0x06` (ARM + TORSO), and only if both pairs behave normally consider `0x07` (all three). Do not extrapolate a successful combined body packet to simultaneous HEAD + MP3 mouth movement.


## October 20, 2026 — compound `0x05` HEAD + TORSO: physically working

Following the successful single-packet HEAD+ARM (`0x03`) test, the user changed `TEST_MOVEMENT_MASK` to **`0x05`** and observed **head and torso move together**. There was **no arm movement**, as expected with bit `0x02` unset. Bluetooth discovery succeeded on the **first** scan with the updated isolated test sketch.

The serial log confirms the request:

```text
Scanning 5 seconds... attempt 1/8
Found Skelly: 5a:e8:18:0a:37:16
CONNECTED
Requested motors: HEAD=YES ARM=NO TORSO=YES
Sending ONE compound body command, mask 0x05: AA CA 05 00 00 00 00 00 00 00 44
Compound movement request SENT ONCE (not motor-confirmed).
```

This validates physical activation of **two different combined bitmasks**, `0x03` (HEAD+ARM) and `0x05` (HEAD+TORSO), without AAC6/jaw playback. The user did not separately time the complete motion for each joint, and we have **not** yet verified HEAD+ARM+TORSO all at once.

**Next test:** `0x06` (ARM+TORSO, CRC `0x81`), with clear joints, jaw disabled, one motor packet only, and observation of both full animations. If it works, consider `0x07` (all three). These are separate from the known unsuccessful jaw-first HEAD while MP3 was playing.


## October 20, 2026 — ALL compound body masks physically work, including 0x07

The user completed the pairwise movement matrix and the combined three-motor test using the separate one-shot `BodyComboSingleTest.ino`. Both newly tested masks produced physical movement of the requested body parts:

| Mask | Confirmed physical movement | Sent frame |
| --- | --- | --- |
| `0x03` | HEAD + ARM | `AA CA 03 00 00 00 00 00 00 00 D7` |
| `0x05` | HEAD + TORSO | `AA CA 05 00 00 00 00 00 00 00 44` |
| `0x06` | **ARM + TORSO** | `AA CA 06 00 00 00 00 00 00 00 81` |
| `0x07` | **HEAD + ARM + TORSO** | `AA CA 07 00 00 00 00 00 00 00 C2` |

**Physical result:** The user confirmed the `0x06` pair worked, then confirmed **all three movements worked together** for `0x07`. This establishes that multi-bit body commands are genuinely executed on the original Skelly; the report doesn't provide exact physical durations or proof of long-term autonomous combined-motion stability.

**Bluetooth results:** `0x06` connected on its first scan. Before the successful `0x07` attempt, two separate runs scanned and found Skelly but failed connecting; after resetting, a later run connected and sent `0x07` successfully. The diagnostic sketch's earlier scan-retry improvement did not cover the **connection failed** path; it now retries a bounded number of fresh discovery + connection attempts without replaying the motor command.

**Implication for the main controller:** We can now consider a separate opt-in scheduling mode that selects combined masks, rather than relying on multiple rapid individual AACA writes. However MP3 jaw playback remains a separate priority issue: head movement during MP3 #13 failed at 2s and 10s, while jaw-first arm/torso worked. Keep MP3 protection and conservatively lock all body motors until completion when experimenting with compound AACA packets.

See [combined body-motor test guide](body-combo-test.md). The normal autonomous firmware is unchanged by the latest diagnostic update.


## October 21, 2026 — mode 1 lighting recovery visually confirmed; serial corruption persists

The user ran the isolated LightingDiagnostic configuration: jaw file #13 every
60 seconds, mode 1 restore, red torso/body and green head, verbose diagnostics ON.
Head, arm, torso motion, eyes, compound mode, jaw-first follow-ups and rests were
OFF. The user observed **green head/red body initially**, **purple on both during
the MP3**, and explicitly confirmed **both return to red/green after playback**.
This is physical evidence of mode 1 recovery on this prop. It does not validate
mode 2, exact mouth LED mapping, or integration with body movements.

The supplied pasted Serial Monitor log contains these four cycles:

| AAC6 accepted uptime (ms) | Full restore completion uptime (ms) | Logged delay (ms) |
| --- | --- | --- |
| 97,923 | 121,422 | 23,499 |
| 157,996 | 181,495 | 23,499 |
| 218,068 | 241,567 | 23,499 |
| 278,140 | 301,639 | 23,499 |

Within every sequence, torso RGB was dispatched +22,402 ms and head RGB +23,488 ms
after AAC6 acceptance. These are **BLE log timestamps**, not independently timed
physical LED changes. Playback end is still modeled at 21 seconds, not confirmed
by a notification. The MP3 start spacing was about 60.073 seconds.

Connection succeeded after one missed scan. During the connected four-clip
segment, scan/connect counters stayed at 2/1, reported write failures stayed at
zero, and writes rose from 6 initial lighting requests to 34 total. Connected
free heap stayed **143,984 bytes**; minimum free heap settled at **141,824 bytes**
after initial lighting and stayed there. Uptime increased continuously, with no
logged BOOT or mid-session reconnect. This does not support a demonstrated reset
or steadily leaking heap in this excerpt; it does not rule out every fault.

**Serial corruption remains:** every affected pasted line contains exactly **64
U+FFFD replacement characters** followed, in some cases, by the readable remainder
of a log line. In the timestamped segment this affects some AAC6 transmit and
modeled-end messages, often the first output after a quiet interval. Other such
messages are readable; no deterministic cause is established. Earlier untimestamped
scan text in the paste is not enough to assign it to this particular boot. The
paste does not preserve the original UART bytes, so 64 replacement characters
must not be described as proof of a 64-byte USB/UART failure.

Next isolate capture/serial behavior with the same conservative no-body-motor
configuration; do not change lighting restoration timing or enable mode 2 solely
to address corrupted text. See the comparison steps in [testing](testing.md).

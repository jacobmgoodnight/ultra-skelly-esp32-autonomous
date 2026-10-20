# Experiment log (field observations, October 2026)

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

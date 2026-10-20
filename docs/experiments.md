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

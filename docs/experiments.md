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

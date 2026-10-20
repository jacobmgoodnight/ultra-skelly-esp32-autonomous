# Test combined HEAD, ARM and TORSO movement commands (one shot)

**Physically verified on the original Ultra Skelly v2: all four requested combined-motor masks physically activated their selected motors**, including **all three (HEAD+ARM+TORSO) with `0x07`**. Individual motion-completion durations were not separately measured in the latest tests. The community [Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/constants.js) specifies `AACA` as a movement **bitfield** (head `0x01`, arm `0x02`, torso `0x04`). Its live controller can select multiple bits in a *single* command, but that does not establish that multiple motors will continue moving concurrently on every Skelly.

The ESP32 sketch [BodyComboSingleTest.ino](../experiments/BodyComboSingleTest/BodyComboSingleTest.ino) is intentionally separate from the stable autonomous firmware and from Skelly Studio's independent body-overlap switch. It connects over BLE and sends **one `AA CA` frame**, then stops sending commands. It never plays a jaw MP3 or changes eyes.

## Suggested progressive order

| `TEST_MOVEMENT_MASK` | Requested body movement | Status |
| --- | --- | --- |
| `0x03` | **HEAD + ARM** | **Verified:** both physically moved in the same test; completion durations not measured |
| `0x05` | HEAD + TORSO | **Verified:** both moved together; full motion durations not separately measured |
| `0x06` | ARM + TORSO | **Verified:** both physically moved together |
| `0x07` | HEAD + ARM + TORSO | **Verified:** all three physically moved from one combined command |

The upstream controller has an `0xFF` special ALL setting, but this sketch **does not** use it. Restricting to the three relevant Skelly movement bits makes it easier to interpret tests.

## Procedure

1. Move people and pets away, ensure Skelly is stable, and check every joint has clearance. These tests can potentially drive more than one motor at once.
2. Disconnect other BLE apps and your existing autonomous ESP32 sketch (reflashing this test sketch replaces the existing Arduino firmware temporarily).
3. All four mask combinations have now been tested. To reproduce any combination, deliberately set `TEST_MOVEMENT_MASK` to `0x03`, `0x05`, `0x06`, or `0x07`, then reflash the sketch. The default remains `0x03` for backwards compatibility. Compile for ESP32 Dev Module with Arduino-ESP32 **3.3.12** and set Serial Monitor to **115200**.
4. Turn on the prop. The sketch retries up to **eight 5-second BLE scans** and now retries **up to four connection attempts** after failed connections (10-second delays). Once connected, it sends one combined `AA CA` command. Observe selected motors and whether each completes; arm previously took ~22 seconds (two motions), head ~25 seconds, torso ~25 seconds. No jaw MP3 is sent.
5. Observe whether one motor stops, restarts or ignores the command. **A successful BLE write is not confirmation that the motors moved.**
6. All motor-mask combinations have physically worked: `0x03`, `0x05`, `0x06`, and `0x07`. For further endurance testing, reflash deliberately between tests and record the actual full-motion completion of each motor; do not assume a single successful activation demonstrates multi-hour reliability.
7. Reflash your normal Skelly Studio firmware after testing.

If an animation binds or stalls, turn off the prop and do not leave the configuration unattended.

## How this differs from the jaw-first result

On the original Skelly, **jaw MP3 → two seconds → ARM** and **jaw MP3 → two seconds → TORSO** worked physically. But **jaw MP3 → two seconds → HEAD** was tried twice and the ESP32 logged the head command **without visible head movement**. Subsequent independently scheduled head actions still worked.

That points toward Skelly's animation-priority handling, not a faulty head motor. A combined `AACA 03` packet was subsequently tested and **moved head and arm together**. The absence of torso movement from that test was expected because bit `0x04` was not included. It does **not** require changing the jaw MP3's saved movement metadata.

**Head-after-jaw result:** Both 2-second and **10-second** delays were physically tested using MP3 #13. In both cases the BLE head command was sent, but the head did **not** move. The 10-second failure makes a brief two-second startup-only block less likely; it does not prove the cause or that all times during playback would fail. Keep normal MP3 head protection enabled.

## October 20, 2026 — compound command field result

The user selected `TEST_MOVEMENT_MASK = 0x03` and physically observed **HEAD and ARM moving** in response to a *single* `AA CA 03 ... D7` packet. **TORSO did not move, as expected:** its `0x04` bit wasn't selected. Full animation completion times were not reported in this test.

The initial one-shot sketch failed to discover Skelly on **three separate resets** before discovering and connecting on the fourth. To improve testing, the sketch now **retries discovery automatically** (up to eight 5-second scan attempts, 10 seconds between missed scans) but still transmits the motor packet **only once** on a successful connection. The updated sketch now also **resets discovery and retries failed BLE connections** (up to four attempts). Only one motor command is ever transmitted after a successful connection.

**Next recommended test: change `TEST_MOVEMENT_MASK` to `0x05` (HEAD + TORSO)**, watch whether both start and complete, and report their approximate durations. Jaw MP3 remains disabled in this isolated test.

## October 20, 2026 — HEAD + TORSO physically verified (mask 0x05)

The user ran the isolated sketch with `TEST_MOVEMENT_MASK = 0x05` and **observed both head and torso moving together**. Skelly was discovered on the **first scan** and connected successfully. The serial monitor reported:

```text
Requested motors: HEAD=YES ARM=NO TORSO=YES
Sending ONE compound body command, mask 0x05: AA CA 05 00 00 00 00 00 00 00 44
Compound movement request SENT ONCE (not motor-confirmed).
```

The physical observation confirms that the compound `0x05` command activated both requested motors; there was **no arm command**, which is correct. The user did not separately time completion of the head and torso animations. This adds a second working two-motor mask to the verified `0x03` head+arm result.

**Next isolated test:** Change the constant to `TEST_MOVEMENT_MASK = 0x06` (ARM + TORSO). The expected one-shot packet is `AA CA 06 00 00 00 00 00 00 00 81`. Run supervised with the jaw MP3 OFF; observe the full ~22-second arm action (two moves) and ~25-second torso motion. Do not infer that `0x07` works until `0x06` has been physically verified.

## October 20, 2026 — remaining pairs and all-body movement confirmed

The user tested the remaining masks in the separate one-shot sketch:

- **`0x06 = ARM + TORSO`**. The logged frame was `AA CA 06 00 00 00 00 00 00 00 81`. The user confirmed **both arm and torso worked**; the head was not requested.
- **`0x07 = HEAD + ARM + TORSO`**. The logged frame was `AA CA 07 00 00 00 00 00 00 00 C2`. The user confirmed **all three moved** from this single compound request.

The `0x06` test connected on its **first scan**. For `0x07`, two preceding attempts found Skelly but then failed at the **BLE connection** stage; a subsequent reset connected on the first scan and executed the single movement command successfully. The failed attempts sent no motor commands. This exposed a remaining convenience issue: the scan-retry logic already worked, but **connection failure itself stopped the test until manual reset**. The sketch now has **bounded automatic connection retries with fresh discovery and clean clients**, while preserving the one-shot motor-command rule.

**Four of four bitmask combinations have physically moved on this Skelly**. This verifies command-triggered concurrent activation, but full per-motor completion times, motor temperature/power behavior and repeated autonomous combined-body cycles are still unmeasured. **No jaw MP3 played during the combined-mask tests.** In separate testing, attempting to move the head 2 or 10 seconds into a jaw MP3 did not work; avoid inferring combined head+jaw playback from these results.

**Next engineering step:** An optional **compound body movement** setting in the main Skelly Studio scheduler could randomly choose from verified masks `0x01`–`0x07`, with a shared cooldown based on the longest selected animation and default MP3 protection ON. That is a proposed change, *not part of the current autonomous firmware*.

# Test combined HEAD, ARM and TORSO movement commands (one shot)

**Experimental — not yet verified physically.** The community [Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/constants.js) specifies `AACA` as a movement **bitfield** (head `0x01`, arm `0x02`, torso `0x04`). Its live controller can select multiple bits in a *single* command, but that does not establish that multiple motors will continue moving concurrently on every Skelly.

The ESP32 sketch [BodyComboSingleTest.ino](../experiments/BodyComboSingleTest/BodyComboSingleTest.ino) is intentionally separate from the stable autonomous firmware and from Skelly Studio's independent body-overlap switch. It connects over BLE and sends **one `AA CA` frame**, then stops sending commands. It never plays a jaw MP3 or changes eyes.

## Suggested progressive order

| `TEST_MOVEMENT_MASK` | Requested body movement | Status |
| --- | --- | --- |
| `0x03` | **HEAD + ARM** | First suggested test; unverified |
| `0x05` | HEAD + TORSO | Unverified |
| `0x06` | ARM + TORSO | Unverified |
| `0x07` | HEAD + ARM + TORSO | Unverified; try only after pairs |

The upstream controller has an `0xFF` special ALL setting, but this sketch **does not** use it. Restricting to the three relevant Skelly movement bits makes it easier to interpret tests.

## Procedure

1. Move people and pets away, ensure Skelly is stable, and check every joint has clearance. These tests can potentially drive more than one motor at once.
2. Disconnect other BLE apps and your existing autonomous ESP32 sketch (reflashing this test sketch replaces the existing Arduino firmware temporarily).
3. In the test sketch, set `TEST_MOVEMENT_MASK = 0x03`. Compile for the previously working ESP32 Dev Module with Arduino-ESP32 **3.3.12**. Connect Serial Monitor at **115200**.
4. Turn on the prop. After scanning and connecting, the sketch prints the one-shot `AA CA 03` command. Observe whether head and arm **both** start and both finish normally: head ~25 s; arm ~22 s with two successive motions.
5. Observe whether one motor stops, restarts or ignores the command. **A successful BLE write is not confirmation that the motors moved.**
6. Only after observing a clean head+arm test, change mask to `0x05` for head+torso, then `0x06` for arm+torso, and finally consider `0x07` for all three. Reflash separately for each mask.
7. Reflash your normal Skelly Studio firmware after testing.

If an animation binds or stalls, turn off the prop and do not leave the configuration unattended.

## How this differs from the jaw-first result

On the original Skelly, **jaw MP3 → two seconds → ARM** and **jaw MP3 → two seconds → TORSO** worked physically. But **jaw MP3 → two seconds → HEAD** was tried twice and the ESP32 logged the head command **without visible head movement**. Subsequent independently scheduled head actions still worked.

That points toward Skelly's animation-priority handling, not a faulty head motor. A combined `AACA 03` packet is a distinct diagnostic; it may work, fail or activate one part only. It does **not** require changing the jaw MP3's saved movement metadata.

**Separate optional test:** In Studio's diagnostic Jaw-first HEAD mode, try a **10-second** delayed follow-up instead of 2 seconds, with arm and torso OFF. That remains inside the roughly 21-second MP3 playback interval and can help distinguish an initial startup lockout from a playback-long restriction. It has **not yet been tried**. Do not assume a longer delay will work.

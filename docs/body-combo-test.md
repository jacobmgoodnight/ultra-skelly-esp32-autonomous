# Test combined HEAD, ARM and TORSO movement commands (one shot)

**Partially verified on the original Ultra Skelly v2:** a single `0x03` command physically moved **head and arm together**. Other combinations are not yet tested. The community [Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/constants.js) specifies `AACA` as a movement **bitfield** (head `0x01`, arm `0x02`, torso `0x04`). Its live controller can select multiple bits in a *single* command, but that does not establish that multiple motors will continue moving concurrently on every Skelly.

The ESP32 sketch [BodyComboSingleTest.ino](../experiments/BodyComboSingleTest/BodyComboSingleTest.ino) is intentionally separate from the stable autonomous firmware and from Skelly Studio's independent body-overlap switch. It connects over BLE and sends **one `AA CA` frame**, then stops sending commands. It never plays a jaw MP3 or changes eyes.

## Suggested progressive order

| `TEST_MOVEMENT_MASK` | Requested body movement | Status |
| --- | --- | --- |
| `0x03` | **HEAD + ARM** | **Verified:** both physically moved in the same test; completion durations not measured |
| `0x05` | HEAD + TORSO | **Next recommended test**; unverified |
| `0x06` | ARM + TORSO | Unverified |
| `0x07` | HEAD + ARM + TORSO | Unverified; try only after pairs |

The upstream controller has an `0xFF` special ALL setting, but this sketch **does not** use it. Restricting to the three relevant Skelly movement bits makes it easier to interpret tests.

## Procedure

1. Move people and pets away, ensure Skelly is stable, and check every joint has clearance. These tests can potentially drive more than one motor at once.
2. Disconnect other BLE apps and your existing autonomous ESP32 sketch (reflashing this test sketch replaces the existing Arduino firmware temporarily).
3. In the test sketch, set `TEST_MOVEMENT_MASK = 0x05` for the **next test**. The original 0x03 (head+arm) test has already worked. Compile for the previously working ESP32 Dev Module with Arduino-ESP32 **3.3.12**. Connect Serial Monitor at **115200**.
4. Turn on the prop. The updated sketch retries up to **eight 5-second BLE scans** (10-second delay between misses) without restarting. After connecting, it sends one `AA CA 05` command. Observe whether head and torso **both** start and complete: head ~25 s; torso ~25 s. The sketch sends **no jaw MP3**.
5. Observe whether one motor stops, restarts or ignores the command. **A successful BLE write is not confirmation that the motors moved.**
6. Head+arm `0x03` has already shown both motors moving. Next test `0x05` head+torso, then `0x06` arm+torso, and finally `0x07` for all three only if the pairs work. **Reflash separately for each mask.**
7. Reflash your normal Skelly Studio firmware after testing.

If an animation binds or stalls, turn off the prop and do not leave the configuration unattended.

## How this differs from the jaw-first result

On the original Skelly, **jaw MP3 → two seconds → ARM** and **jaw MP3 → two seconds → TORSO** worked physically. But **jaw MP3 → two seconds → HEAD** was tried twice and the ESP32 logged the head command **without visible head movement**. Subsequent independently scheduled head actions still worked.

That points toward Skelly's animation-priority handling, not a faulty head motor. A combined `AACA 03` packet was subsequently tested and **moved head and arm together**. The absence of torso movement from that test was expected because bit `0x04` was not included. It does **not** require changing the jaw MP3's saved movement metadata.

**Head-after-jaw result:** Both 2-second and **10-second** delays were physically tested using MP3 #13. In both cases the BLE head command was sent, but the head did **not** move. The 10-second failure makes a brief two-second startup-only block less likely; it does not prove the cause or that all times during playback would fail. Keep normal MP3 head protection enabled.

## October 20, 2026 — compound command field result

The user selected `TEST_MOVEMENT_MASK = 0x03` and physically observed **HEAD and ARM moving** in response to a *single* `AA CA 03 ... D7` packet. **TORSO did not move, as expected:** its `0x04` bit wasn't selected. Full animation completion times were not reported in this test.

The initial one-shot sketch failed to discover Skelly on **three separate resets** before discovering and connecting on the fourth. To improve testing, the sketch now **retries discovery automatically** (up to eight 5-second scan attempts, 10 seconds between missed scans) but still transmits the motor packet **only once** on a successful connection. If connection itself fails, reset/retry after closing other BLE connections.

**Next recommended test: change `TEST_MOVEMENT_MASK` to `0x05` (HEAD + TORSO)**, watch whether both start and complete, and report their approximate durations. Jaw MP3 remains disabled in this isolated test.

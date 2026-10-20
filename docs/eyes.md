# Experimental randomized eye expressions

The upstream web controller supports icons **1 through 18** and sends a live `AAF9` frame. **Confirmed on one real Ultra Skelly v2 (October 19, 2026):** the standalone ESP32 one-shot `AAF9` eye-control test successfully changed the eye design. This test also connected immediately after flashing, without an ESP32 reboot. **Update from the user's next on-device test:** randomized eye switching from the ESP32 also worked. The tester did not have to reboot the ESP32 after flashing. A separate, controlled test of whether a stored jaw MP3 can temporarily override the eye icon has not yet been completed.

## Safe first test

1. Save your working `SkellyAutonomous.ino` as a backup; eye testing temporarily replaces the sketch on the board.
2. Power on Skelly and close/disconnect any app or web controller that's connected over Bluetooth.
3. Open `experiments/EyeSingleTest/EyeSingleTest.ino`.
4. Set `TEST_EYE_ICON = 2` (valid 1–18). If the current eye is already #2, choose another obvious icon after visually checking the web controller's grid.
5. Upload for **ESP32 Dev Module**, then open Serial Monitor at **115200**.
6. Confirm one scan, one connection, then one `AA F9 ... CRC` send. Watch the eyes. No head, mouth, torso, or arm commands are sent.
7. If the eye changes, note its number and behavior, and return to the main firmware. If no change, keep eyes disabled and inspect the log before trying other packets.

**This is a live eye change, not editing an MP3's saved eye setting.** After the test, you can use the web controller to restore your preferred live eye icon. The source document for the live packet is [app-modular.js](https://github.com/martinecker/SkellyUltraWebController/blob/main/app-modular.js), around the `apEyeGrid` click handler.

## Enable random eyes (one-shot and random changes confirmed)

Open `firmware/SkellyAutonomous/SkellyAutonomous.ino` and set:

```cpp
const bool EYES_ENABLED = true;
const uint32_t EYE_MIN_INTERVAL_MS = 120000;
const uint32_t EYE_MAX_INTERVAL_MS = 300000;
```

This selects an eye ID from 1–18 at random, avoids choosing the same icon twice in a row, and requests new expressions every 2–5 minutes. It does **not** schedule torso/arm movements. The head and mouth schedules continue independently.

## Caveats

- Different hardware firmware may handle live eye commands differently.
- Random eye changes have worked on the original Skelly. **Whether MP3 playback overrides live eye changes** has not been separately isolated; the uploaded jaw file has its own eye setting that might temporarily take precedence.
- Do not test unverified commands while Skelly can strike people, pets, or nearby items.
- `AAF9` shouldn't be mistaken for the per-file eye metadata editing variant, which includes a file cluster and name.

## Preview what eye IDs 1–18 look like

[Skelly Studio](../studio/) now shows an actual thumbnail for each numbered eye design. Select the patterns you want in your ESP32's random rotation and use **Preview** to enlarge any image. Thumbnails are requested live from the [Skelly Ultra Web Controller's original image files](https://github.com/martinecker/SkellyUltraWebController/tree/main/images/skelly), with attribution; they are not copied into our repository. They require internet access, but generating an Arduino sketch still works offline.

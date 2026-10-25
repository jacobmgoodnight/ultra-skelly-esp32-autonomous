# Experimental randomized eye expressions

The upstream web controller supports icons **1 through 18** and sends a live `AAF9` frame. **Confirmed on one real Ultra Skelly v2 (October 19, 2026):** the standalone ESP32 one-shot `AAF9` eye-control test successfully changed the eye design. This test also connected immediately after flashing, without an ESP32 reboot. **Update from the user's next on-device test:** randomized eye switching from the ESP32 also worked. The tester did not have to reboot the ESP32 after flashing. **New observation:** playing the jaw MP3 appears to restore a different saved eye design, overriding a live expression. Eye restoration and coordinated eye changes have been added as an optional workaround but have **not yet been physically verified**.

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

## Fixing eye changes caused by jaw MP3 playback (new test feature)

Each uploaded MP3 may include its own eye design. When playback begins, the file can override the previously selected live eye expression. This was observed on the original Skelly.

The ESP32 controller now remembers the last eye icon it requested, then can issue live-eye AAF9 commands after AAC6 audio playback begins and after the **approximately 20-second** jaw clip ends. In the sketch:

```cpp
const bool EYES_ENABLED = false;   // Enable after testing on your Skelly
const uint8_t EYE_JAW_MODE = 1;    // 0: MP3 controls, 1: restore, 2: new eye on jaw
```

- **Mode 0 — Use saved MP3 eye setting:** Do not restore an eye just because jaw audio starts. The normal randomized eye timer still runs.
- **Mode 1 — Keep chosen expression (default when eyes enabled):** Reapply the previously chosen live eye about **1.2 seconds** after MP3 starts, and again shortly after the assumed 21-second clip playback finishes.
- **Mode 2 — React to mouth movement:** Choose a new random eye when the MP3 begins (after a short delay), then reapply that eye after playback ends.

The controller also sends its first live eye selection **about two seconds after a BLE connection** when eyes are enabled, so a current eye exists before the first jaw clip. This feature adds no torso or arm commands.

**Status:** Modes 1 and 2 are experimental. The current clip length assumption is **21 seconds**; if you upload longer or shorter MP3 files, adjust `MOUTH_CLIP_MS` and retest. Multiple stored MP3s should be roughly the same length unless the firmware later adds per-file durations. The Web Controller can also edit the eye setting stored with each MP3, which offers another way to avoid switching.

## Caveats

- Different hardware firmware may handle live eye commands differently.
- Random eyes work, but the tester observed that MP3 playback **appears to reset the live eyes** to the file's saved eye design.
- The new controller option `EYE_JAW_MODE` tries to compensate, but the timing and resulting appearance still need testing on the real Skelly.
- Do not test unverified commands while Skelly can strike people, pets, or nearby items.
- `AAF9` shouldn't be mistaken for the per-file eye metadata editing variant, which includes a file cluster and name.

## Preview what eye IDs 1–18 look like

The eye gallery labels designs descriptively while retaining their exact
IDs. Choose stored eyes, one expression or a selected rotation. Clicking a tile
selects/enables it; Preview only enlarges it. All expressions are shown without
favorites, filters or nicknames. Unselected thumbnails retain their full color. The experimental 12-foot model uses its own
number mapping and clearly marks designs without bundled artwork.

[Skelly Studio](../studio/) now shows an actual thumbnail for each numbered eye design. Select the patterns you want in your ESP32's random rotation and use **Preview** to enlarge any image. All 18 previews are bundled locally with [source attribution](../studio/images/eyes/README.md). Thumbnails, enlarged previews and sketch generation work offline from the complete Studio folder.

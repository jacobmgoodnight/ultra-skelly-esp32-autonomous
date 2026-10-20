# Skelly Studio — browser-based ESP32 sketch generator

This is a proposed, **experimental** graphical configuration tool for the [Ultra Skelly ESP32 Autonomous Controller](../README.md).

**Run locally**: open `studio/index.html` in a browser. (All HTML/CSS/JavaScript and the tested firmware snapshot live in this folder.) Alternatively, enable GitHub Pages for the repo and open `https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/` once Pages is enabled.

## What it does

- Pick Subtle, Normal or Haunted presets, or enter independent random **start-to-start** intervals.
- Switch head and jaw on or off, and choose whether their animations may overlap.
- Supply **your jaw MP3's file serial**; it is not a Bluetooth MAC address.
- Choose the Skelly BLE *advertised name* (default `Ultra Skelly v2`); the ESP32 discovers the address itself.
- Opt in to randomized eye expressions, choose which of 18 supported icon numbers may appear, and control their timing. **The one-shot ESP32 eye change is verified on real hardware; randomized eye scheduling alongside jaw audio is not yet field-tested.**
- Add up to **eight** uploaded jaw MP3 file serial numbers to randomly switch between different jaw personalities (new, needs device testing). Each stored file must have saved motor movement flags `0x00`.
- Enable optional **idle breaks** to pause newly triggered movements for a randomized time once any active animation has finished (new, needs device testing).
- Preview an illustrative 5-minute schedule; **not a prediction**, because actual firmware uses fresh randomness and device timing.
- Download a complete `SkellyAutonomous.ino` file or inspect/copy the sketch.

The generator starts from a snapshot of the existing ESP32 firmware as of October 19, 2026, rather than implementing a second BLE client. Its output preserves the tested head animation safety minimum of **32 seconds** and jaw clip scheduling minimum of **22 seconds**. Only allowed settings and scheduler options are changed.

## Important before use

1. **Eyes are off by default.** The [one-shot eye test](../experiments/EyeSingleTest/EyeSingleTest.ino) succeeded on the original ESP32/Skelly. Run it on your own device before using randomized eyes. Audio playback could change the eyes back to the file's saved icon.
2. **Torso and arm commands remain disabled.** On your MP3 set the saved movement flag to **0x00** in the [Skelly Ultra Web Controller](https://martinecker.github.io/SkellyUltraWebController/) before using jaw playback.
3. **No MAC address entry** is needed: scanning is by BLE name. `MOUTH_FILE_SERIAL` is a separate *per-file* number.
4. Generated code is **not compiled in the browser**. Download, open in Arduino IDE, compile/upload to ESP32 Dev Module (tested framework 3.3.12), and monitor serial output at 115200.
5. After an upload the board normally restarts; on some setups an **EN/RESET** button press or ESP32 USB power cycle helps the initial connection. Disconnect any other BLE controller. The regular firmware retries scans automatically.
6. Keep reasonable motor activity and use a weatherproof enclosure if outdoors.

## Project status

This configurator is a **beta**. GitHub Actions run JavaScript syntax checks, generator smoke tests for presets/options/validation, and protocol CRC test vectors. These tests do **not** compile the Arduino C++ against the ESP32 toolchain or replace real-hardware checks. Keep a backup of the proven main firmware. Jaw pools, random eyes during MP3 playback, and idle breaks need field testing.

## Hosting on GitHub Pages

In the repository **Settings → Pages**, configure "Deploy from a branch", branch `main`, folder `/(root)`, and save. When this folder is on `main` and Pages finishes deploying, `/studio/` will be available. GitHub's source-file view of `index.html` is **code, not a rendered preview**. For an immediate local preview, use **Code → Download ZIP** on GitHub, extract, and double-click `studio/index.html`. This app requires no build pipeline, backend, tokens or third-party API.

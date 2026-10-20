# Skelly Studio — browser-based ESP32 sketch generator

This is a proposed, **experimental** graphical configuration tool for the [Ultra Skelly ESP32 Autonomous Controller](../README.md).

**Run locally**: open `studio/index.html` in a browser. (All HTML/CSS/JavaScript and the tested firmware snapshot live in this folder.) Alternatively, enable GitHub Pages for the repo and open `https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/` once Pages is enabled.

## What it does

- Pick Subtle, Normal or Haunted presets, or enter independent random **start-to-start** intervals.
- Switch head and jaw on or off, and choose whether their animations may overlap.
- Supply **your jaw MP3's file serial**; it is not a Bluetooth MAC address.
- Choose the Skelly BLE *advertised name* (default `Ultra Skelly v2`); the ESP32 discovers the address itself.
- Opt in to randomized **experimental** eyes, change intervals, and select which of 18 icon numbers may appear.
- Preview an illustrative 5-minute schedule; **not a prediction**, because actual firmware uses fresh randomness and device timing.
- Download a complete `SkellyAutonomous.ino` file or inspect/copy the sketch.

The generator starts from a snapshot of the existing ESP32 firmware as of October 19, 2026, rather than implementing a second BLE client. Its output preserves the tested head animation safety minimum of **32 seconds** and jaw clip scheduling minimum of **22 seconds**. Only allowed settings and scheduler options are changed.

## Important before use

1. **Eyes are off by default.** Verify [the one-shot eye test](../experiments/EyeSingleTest/EyeSingleTest.ino) on your physical Skelly before enabling. Audio playback could change the eyes back to the file's saved icon.
2. **Torso and arm commands remain disabled.** On your MP3 set the saved movement flag to **0x00** in the [Skelly Ultra Web Controller](https://martinecker.github.io/SkellyUltraWebController/) before using jaw playback.
3. **No MAC address entry** is needed: scanning is by BLE name. `MOUTH_FILE_SERIAL` is a separate *per-file* number.
4. Generated code is **not compiled in the browser**. Download, open in Arduino IDE, compile/upload to ESP32 Dev Module (tested framework 3.3.12), and monitor serial output at 115200.
5. After an upload the board normally restarts; on some setups an **EN/RESET** button press or ESP32 USB power cycle helps the initial connection. Disconnect any other BLE controller. The regular firmware retries scans automatically.
6. Keep reasonable motor activity and use a weatherproof enclosure if outdoors.

## Project status

This configurator is a **prototype**, proposed as a pull request. Until merged, it is separate from the verified default `main` firmware. Please validate compiled output with representative presets and do live-device testing before marking the generator stable.

## Hosting on GitHub Pages

In the repository **Settings → Pages**, configure "Deploy from a branch", branch `main`, folder `/(root)`, and save. After merging the pull request and Pages deployment, `/studio/` will be available. This app requires no build pipeline, backend, tokens or third-party API.

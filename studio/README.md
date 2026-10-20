# Skelly Studio — browser-based ESP32 sketch generator

This is a **beta** graphical configuration tool for the [Ultra Skelly ESP32 Autonomous Controller](../README.md).

**Run locally**: open `studio/index.html` in a browser. (All HTML/CSS/JavaScript and the tested firmware snapshot live in this folder.) GitHub Pages successfully deployed this repository in October 2026. Open **https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/**, which redirects to `/studio/`, or open the `/studio/` URL directly.

## What it does

- Pick Subtle, Normal or Haunted presets, or enter independent random **start-to-start** intervals.
- Enable optional **torso movement** (previously verified for ~25 s) or **arm movement** (now verified: two motions taking 22 seconds). Each has a separate random interval and all body-motor commands are serialized with safety cooldown. The advanced body-overlap switch permits overlapping head/torso/arm motion (not yet tested together), preserving per-motor cooldown and 600 ms spacing between BLE writes. **Haunted enables both torso and arm by default**, but keeps advanced body-motor overlap OFF pending simultaneous-movement tests. See the [body safety guide](../docs/body-movements.md).
- **Subtle turns the silent jaw OFF by default.** Normal and Haunted turn the jaw on. You can override any preset.
- Switch head and jaw on or off, and choose whether their animations may overlap.
- Supply **your jaw MP3's file serial**; it is not a Bluetooth MAC address.
- Choose the Skelly BLE *advertised name* (default `Ultra Skelly v2`); the ESP32 discovers the address itself.
- Opt in to randomized eye expressions, choose which of 18 supported icon numbers may appear, and control their timing. **Both one-shot and randomized ESP32 eye changes were verified on the original Ultra Skelly v2.** The original tester observed that starting a jaw MP3 **does appear to restore its saved eye design**. New eye/jaw coordination modes attempt to handle this; they still need real-device testing.
- Set **what eyes do when the jaw starts**: use the MP3's saved eye, restore the currently selected random eye, or switch to another selected eye and keep that expression. The last two modes send live AAF9 eye commands after playback begins and after the ~20-second clip ends; this is experimental.
- Choose from **18 real eye-pattern thumbnails** in the app. The images are linked from [martinecker's Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController/tree/main/images/skelly), not copied into this repository. Image previews require internet; sketch generation does not.
- Add up to **eight** uploaded jaw MP3 file serial numbers to randomly switch between different jaw personalities (new, needs device testing). Each stored file must have saved motor movement flags `0x00`.
- Enable optional **idle breaks** to pause newly triggered movements for a randomized time once any active animation has finished (new, needs device testing).
- Preview an illustrative 5-minute schedule; **not a prediction**, because actual firmware uses fresh randomness and device timing.
- Download a complete `SkellyAutonomous.ino` file or inspect/copy the sketch.

The generator starts from the project's current Arduino firmware rather than implementing a second BLE client. Its output preserves the tested head animation safety minimum of **32 seconds** and jaw clip scheduling minimum of **22 seconds**. Only allowed settings and scheduler options are changed.

## Important before use

1. **Eyes are off by default.** One-shot and randomized eye changes both worked on the test Skelly. Try the [one-shot eye test](../experiments/EyeSingleTest/EyeSingleTest.ino) on your device if you want to verify compatibility. Audio playback was observed changing the eyes back to the file's saved icon. Eye restoration/reaction options need device testing; the configured MP3 duration is approximately 21 seconds.
2. **Torso and arm commands remain disabled.** On your MP3 set the saved movement flag to **0x00** in the [Skelly Ultra Web Controller](https://martinecker.github.io/SkellyUltraWebController/) before using jaw playback.
3. **No MAC address entry** is needed: scanning is by BLE name. `MOUTH_FILE_SERIAL` is a separate *per-file* number.
4. Generated code is **not compiled in the browser**. Download, open in Arduino IDE, compile/upload to ESP32 Dev Module (tested framework 3.3.12), and monitor serial output at 115200.
5. After an upload the board normally restarts; on some setups an **EN/RESET** button press or ESP32 USB power cycle helps the initial connection. Disconnect any other BLE controller. The regular firmware retries scans automatically.
6. Keep reasonable motor activity and use a weatherproof enclosure if outdoors.

## Project status

This configurator is a **beta**. GitHub Actions run JavaScript syntax checks, generator smoke tests for presets/options/validation, and protocol CRC test vectors. These tests do **not** compile the Arduino C++ against the ESP32 toolchain or replace real-hardware checks. Keep a backup of the proven main firmware. Jaw pools, random eyes during MP3 playback, and idle breaks need field testing.

## Hosting on GitHub Pages

The project's Pages build and deployment were reported successful by GitHub. The repository now includes a root `index.html` that redirects visitors to `/studio/`. When Pages deploys a change, allow a little time for it to propagate; if a browser still shows 404, refresh without cache and inspect **Settings → Pages** and **Actions → pages build and deployment**. GitHub's source-file view of `index.html` is **code, not a rendered preview**. For an immediate local preview, use **Code → Download ZIP** on GitHub, extract, and double-click `studio/index.html`. This app requires no build pipeline, backend, tokens or third-party API.

## Experimental jaw audio personalities

Two synthetic waveform recipes can be generated using [audio/generate_jaw_clips.py](../audio/generate_jaw_clips.py). The [jaw personality guide](../audio/jaw-personalities.md) describes the **three-second open hold** and **whisper-then-gasp** clips. Upload each to Skelly, set saved body-movement metadata to `0x00`, and enter its file serial in Studio. Their physical response needs testing.


## Jaw MP3 priority and shorter body timing

The original test device confirmed **3-second jaw holds** from the Long Open and Whisper Then Gasp files (original file serials **#13 and #14**, device-specific). When MP3 playback started during arm/torso movement, the user observed an apparent interruption of those body animations. MP3 per-file saved movement flags are a plausible cause, but the internal firmware behavior is not proven.

**Protect arm + torso from jaw MP3** now defaults **ON**. It delays AAC6 playback until active arm/torso motions and their cooldowns end, and pauses new arm/torso starts during the MP3. Head/jaw overlap is controlled separately. Choose OFF only to experiment with MP3-overlapping-body behavior. The new priority scheduling remains hardware-experimental.

Studio's per-part **torso and arm minimum start intervals are now 45 seconds**, reduced from the original conservative 90/120 seconds. Torso needs ~25 seconds to animate plus 10 seconds buffer; arm needs ~22 seconds plus 10 seconds buffer. These are **not minimums imposed by Bluetooth or Skelly itself**. Preset timing remains less frequent for motor longevity.


## Experimental jaw-first motor reaction

Skelly Studio now offers **Jaw first → Arm or Torso** with a selectable **1–10-second delay** (default 2 s), initially **OFF**. It sends one `AACA` arm or torso command after the `AAC6` jaw MP3 starts, testing whether command order allows simultaneous mouth and body movement. **The initial implementation permits only one successful follow-up per BLE connection**, so the arm/torso doesn't follow every jaw clip regardless of its normal frequency. A skipped attempt may retry on the next jaw clip. The selected motor must be enabled; the action is skipped if it is still cooling down or blocked by the body lock. The existing **Protect arm + torso from jaw MP3** mode stays enabled for normal scheduling; jaw-first explicitly allows a one-time exception *after* playback begins. The result is **not yet physically verified**. See the step-by-step [jaw-first experiment](../docs/jaw-first-experiment.md).

## Jaw-first overlap verified; recurring mode newly available

On the original Ultra Skelly v2, starting the jaw MP3 then sending an arm `AACA` command **2 seconds afterward** let the jaw maintain its three-second hold while both arm motions finished (~22 seconds). Torso started after jaw also worked. These particular overlaps are physically **verified**.

Studio's new **Repeat when the selected motor's own random interval is due** switch is OFF by default. When enabled, the arm or torso stops firing on its independent timer and instead waits for the next jaw MP3 **after its random interval has elapsed**, starting the motor after the chosen delay. Not every MP3 will trigger a motor. The new recurrence mode needs extended testing, especially if additional body motors or head overlap are enabled.

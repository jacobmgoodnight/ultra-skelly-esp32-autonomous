# Ultra Skelly ESP32 Autonomous Controller 💀

**Randomized Home Depot Ultra Skelly v2 head movement + silent jaw animation from an ESP32. No always-open phone app, browser, Wi-Fi, Home Assistant, motion sensor, or audio-triggered activation required.**

This is a standalone, hobby-built **BLE client** for the Home Depot 6.5-ft *Ultra Skelly v2*. Power the ESP32 continuously from USB; let Skelly's existing timer handle Skelly's own power. When Skelly becomes available, the ESP32 finds its Bluetooth advertisement and connects. The ESP32 uses Bluetooth rather than freeing Skelly from Bluetooth entirely: the phone is replaced as the BLE controller.

> **Project state (October 2026):** Head and jaw animations, with overlapping movement, were tested successfully on one Ultra Skelly v2. Torso-only (~25s) and arm-only (22s, two motions) commands also worked and are now optional in the main controller, while disabled in the default checked-in sketch. Automatic power-cycle reconnection is implemented but has not been end-to-end verified on every firmware. The standalone eye test also connected immediately after flashing without an ESP32 reboot. **Both one-shot and randomized ESP32 eye-design changes have now been verified on the real prop!** Eye changes are still OFF by default so new owners can enable them intentionally. Jaw MP3 playback was observed restoring a different saved eye design; the optional eye-restoration mode remains under visual testing.

## Demo behavior

| Feature | Current behavior | Evidence |
| --- | --- | --- |
| Head | Random starts 32–60 sec apart (25-sec animation + 7-sec safety margin) | Tested on real Skelly |
| Jaw | Plays an uploaded ~20-second MP3 with short, irregular silent-to-the-speaker bursts, every 45–90 sec | Tested on real Skelly |
| Head + jaw | Independent start-to-start schedules; may overlap | Tested simultaneously |
| Arm / torso | Not commanded from main firmware | Torso-only command was separately tested |
| Eye expressions | 18 selectable eye designs; optional random changes every 2–5 min | **One-shot and randomized eye control both worked on the real prop**; OFF by default |
| BLE reconnect | Five-second scan; 30-second retry after misses; rescan on disconnect | Implemented in code; power-cycle behavior may vary |

The audio file itself is not completely silent: the *physical volume knob on the prop* can be set to zero while its jaw still reacts to playback. If you want audible audio, leave the knob turned up; if you want silent animation, turn it down as tested. Do not assume setting the software volume to zero works the same way.

## Hardware

- Home Depot Ultra Skelly v2 (advertises as `Ultra Skelly v2`)
- ESP32-WROOM-32 development board (USB, Bluetooth BLE; project tested with CP2102/USB-C variant)
- USB cable and USB power supply for the ESP32
- Computer with Arduino IDE for flashing
- Optionally a timer/smart plug powering **Skelly itself**

**No electrical connection or wiring from the ESP32 to Skelly is required.** They communicate wirelessly over BLE. Keep the ESP32 powered if you want it to reconnect automatically when Skelly powers up.

## Quick start

1. Install Arduino IDE and the **esp32 by Espressif Systems** board package (tested with Arduino-ESP32 **3.3.12**).
2. Choose **ESP32 Dev Module** and the COM/USB serial port for your board.
3. With Skelly powered on and another Bluetooth controller disconnected, open [Skelly Ultra Web Controller](https://martinecker.github.io/SkellyUltraWebController/) in supported Chrome/Edge.
4. Upload `audio/Jaw_Idle_Random_20s_v2.mp3` to Skelly (or use your own compatible file). In its file settings, **deselect ALL head/arm/torso movement** and apply changes. Verify the saved movement flag reads **`0x00`**. Otherwise playing an audio file may trigger the whole body (`0xFF`).
5. Play the uploaded file once in the web controller and record its **actual file serial**. It may **not** be #12 on your Skelly; never assume file slots are universal.
6. Completely disconnect/close the web controller or phone app; Skelly must be available for the ESP32's BLE connection.
7. Open `firmware/SkellyAutonomous/SkellyAutonomous.ino`, set `MOUTH_FILE_SERIAL` to your file's serial, and upload the sketch.
8. Open **Serial Monitor at 115200 baud**. Verify BLE connection, randomized head commands, and playback commands.

**Optional eyes:** First run `experiments/EyeSingleTest/EyeSingleTest.ino` to verify one `AAF9` eye change on your device. Once verified, restore the main sketch and set `EYES_ENABLED = true`. More in [Eye experiments](docs/eyes.md).

### Bluetooth identity and first boot

**You do not need to enter your Skelly's Bluetooth MAC address.** The ESP32 scans for the advertised name `Ultra Skelly v2` and uses the address discovered at runtime. The `SERVICE_UUID` and `WRITE_UUID` identify Skelly's BLE interface, not a unique prop. Only change `SKELLY_NAME` if your device advertises under a different name.

**You do need to verify `MOUTH_FILE_SERIAL`:** it is the serial number of *your uploaded MP3*, not a Bluetooth identifier. The original tester used file #12; yours may differ.

After flashing, many ESP32 boards reboot automatically and scan immediately. If yours does not connect, with Skelly powered on and the web/phone controller disconnected, press the board's **EN/RESET** button or unplug/reconnect **the ESP32's USB power**. Watch Serial Monitor at **115200 baud**. The normal controller scans for 5 seconds and retries 30 seconds after a miss; a manual reboot is a troubleshooting step, **not meant to be necessary on every startup**. Full power-cycle reconnect behavior still needs testing across devices.

## Easy settings (at the top of the sketch)

```cpp
const uint16_t MOUTH_FILE_SERIAL = 12;   // Change to the serial on YOUR Skelly
const bool MOUTH_ENABLED = true;
const bool EYES_ENABLED = false;        // Experimental: enable after the one-shot test
const uint32_t HEAD_MIN_INTERVAL_MS = 32000;
const uint32_t HEAD_MAX_INTERVAL_MS = 60000;
const uint32_t MOUTH_MIN_INTERVAL_MS = 45000;
const uint32_t MOUTH_MAX_INTERVAL_MS = 90000;
const uint32_t EYE_MIN_INTERVAL_MS = 120000;
const uint32_t EYE_MAX_INTERVAL_MS = 300000;
```

Intervals are **start-to-start**, not waits after each animation. Because a head animation is ~25 seconds and has a 7-second margin, lowering head minimum below **32 seconds** is discouraged.

## Optional torso and arm movements

Skelly Studio now provides separate enable toggles and random start intervals for **torso** and **arm** movement. The **torso-only command** was physically verified (~25 seconds); the **arm-only command has now been verified on the physical Skelly (two arm movements taking 22 seconds)**, though it is disabled by default in the checked-in firmware. Haunted turns on **torso movement every 3–6 minutes and arm movement every 6–12 minutes**. Subtle now turns the silent jaw OFF by default.

A shared motor cooldown serializes physical **head/torso/arm commands** by default. An **advanced opt-in** permits motor overlap, but simultaneous body motions haven't yet been verified; per-motor cooldown and 600 ms write spacing remain. This means enabling additional body movements can postpone a head command past its original target interval. Jaw MP3 and eyes can still overlap. Always leave stored MP3 movement flags at **0x00**.

See the [body movement safety guide](docs/body-movements.md) and [one-shot arm test](experiments/ArmSingleTest/ArmSingleTest.ino).

## Skelly Studio — browser-based configurator (beta)

Want to choose randomized movement timing without editing Arduino C++ yourself? **[Open the Skelly Studio website](https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/)** — the homepage opens the configurator. GitHub reported a successful Pages deployment in October 2026.

**GitHub's HTML source viewer shows code, not a running webpage.** To preview immediately before Pages is enabled, click **Code → Download ZIP**, extract it, and open **`studio/index.html`** in your browser. All assets are local to `studio/`.

Studio allows head/jaw timing, optional overlap, BLE-name discovery, **18 actual eye-design previews and confirmed randomized eye selection**, multiple stored jaw-file serials, and occasional idle breaks. The latest beta also lets Skelly **restore the previously selected eyes after a jaw MP3** or **pick a new expression when the jaw starts**. The MP3 override was observed in hardware; these new correction modes are unverified. The eye thumbnails are linked from the [community web controller's original images](https://github.com/martinecker/SkellyUltraWebController/tree/main/images/skelly), not bundled here. **The jaw-file pool and idle scheduler are new experimental options.** JavaScript generator tests pass, but generated Arduino variants still require compilation and on-device testing. Your original checked-in firmware remains the known-good baseline.


- [Assembly, Arduino, and Bluetooth setup](docs/setup.md)
- [BLE protocol: confirmed commands and references](docs/protocol.md)
- [Experiment log: how we discovered and improved the jaw movement](docs/experiments.md)
- [One-shot eye test and opt-in randomized eye changes](docs/eyes.md)
- [Troubleshooting and safety notes](docs/troubleshooting.md)

## What is verified vs experimental?

**Verified on one real prop:** BLE connection; service `AE00` and write characteristic `AE01`; head-only packet; torso-only packet in an isolated test; stored MP3 file listing; AAC6 playback of file #12; disabling per-file movement flags (`0x00`) leaves mouth motion; short audio bursts make jaw movements shorter; head and jaw can run concurrently.

**Implemented, still needs more field testing:** BLE reconnect after power loss, prolonged unattended stability, eye restoration after MP3 playback, coordinated new-eye-on-jaw reactions, multi-file jaw playback, idle-break scheduling and optional arm movement. MP3 playback has been observed restoring its saved eye design. **One-shot and randomized eye changes have both been confirmed working from the ESP32**. Community protocol implementations may differ between hardware/firmware versions.

## Credits and project relationship

The invaluable [Skelly Ultra Web Controller by martinecker](https://github.com/martinecker/SkellyUltraWebController) enabled browsing audio files, editing saved movement settings, and studying BLE protocol packets. This ESP32 project is a **separate, independently written controller**, not a fork or redistribution of that project's JavaScript/UI. See [protocol references](docs/protocol.md). This is an unofficial community hobby project, not affiliated with Home Depot or the prop manufacturer.

## License

This repository's original firmware, docs, and included synthesized test audio are shared under the [MIT License](LICENSE). Third-party upstream projects retain their own rights/licenses; no upstream source or images are bundled here.

### Jaw audio personalities

New experimental jaw audio recipes include **three-second wide-open holds** and **whisper-then-gasp** patterns. See the [audio guide](audio/jaw-personalities.md) and [source generator](audio/generate_jaw_clips.py). Upload each MP3 through the community web controller with saved movement flags `0x00`, then enter its device-specific file number in Studio. Unlike head/arm/torso commands, jaw shape is not controlled directly; visual timing must be tested.


### Confirmed jaw holds and MP3/body movement scheduling (October 2026)

The **Long Open (#13)** and **Whisper Then Gasp (#14)** audio clips each produced verified **three-second mouth holds** on the original test unit. File serial numbers are device-specific. During testing of body motor overlap, stored MP3 playback appeared to **interrupt arm/torso movement**; it may be applying its saved movement flags `0x00`. That hypothesis still needs direct confirmation.

Studio now defaults to **Protect arm + torso from jaw MP3**, which delays jaw playback until those motors have finished and prevents arm/torso starts while the MP3 is playing. Head/jaw overlap remains a separate option. Studio also lowered the **minimum selectable torso and arm frequency to 45 seconds**; the previous 90/120-second settings were conservative UI limits, not Skelly hardware requirements. These priority and frequency changes have yet to undergo extended on-device testing.

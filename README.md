# 💀 Ultra Skelly — Autonomous ESP32 Controller

**Make your Skelly come alive — even when nobody walks by.**

Give the Home Depot **6.5-foot Ultra Skelly v2** its own personality. An inexpensive ESP32 uses Bluetooth to trigger randomized head, arm and torso movements, change LCD eyes, and control RGB lighting — **without waiting for the motion sensor or keeping a phone connected**.

**[🎛️ Launch Skelly Studio](https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/)** · **[🚀 Quick start](#quick-start)** · [Explore features](#what-can-it-do) · [Hardware compatibility](#compatibility-and-test-status)

**Free & open source (MIT)** · **No Wi-Fi, cloud service or subscription for autonomous operation** · **No wiring to the prop**

![Skelly Studio showing movement controls and a live routine summary](docs/images/studio-routine-overview.jpg)

*Skelly Studio lets you build a routine in your browser. Previews illustrate requested actions; they are not a live feed or proof of physical movement.*

## Why use it?

Normally, Skelly needs its sensor or an app command to perform an action. This project gives it an **autonomous routine**: maybe it looks around, changes expressions, or shifts its lighting while the porch is quiet.

Set it up in **Skelly Studio**, save the routine to an ESP32 over USB, and leave the ESP32 powered near Skelly. It handles the recurring Bluetooth commands on its own. The browser, phone and computer are not needed for everyday operation.

## What can it do?

| Feature | What you can customize |
| --- | --- |
| **💀 Autonomous movement** | Fixed or randomized head intervals; optional independent arm and torso routines with motor cooldowns. |
| **🦴 Combined movements** | Optional compound body animations, with separate controls and protections for more advanced combinations. |
| **👀 Expressive eyes** | Pick from **18 Ultra Skelly LCD expressions**, or randomly rotate through a chosen set. |
| **🌈 RGB lighting** | Separate head and torso colors, brightness, **Static / Strobe / Pulsing** effects, custom palettes and timed palette rotation. |
| **🎭 Personalities & complete looks** | Load a starting look, then customize movement, eyes and lighting together. |
| **🎬 Saved scenes** | Build **up to four named scenes** and rotate them in order or randomly; duplicate, reorder and edit them in Studio. |
| **🔌 USB configuration** | Connect, read existing settings, save a routine or a scene collection, and check read-back and diagnostics. |
| **🛠️ Advanced tools** | Optional jaw coordination, audio experiments, idle breaks, clock windows, JSON backups and standalone Arduino sketch downloads. |

All features have different levels of hardware verification. The core Ultra movements, eyes and lighting have been observed on one prop; newer combinations and browser workflows have additional limits. See [current feature status](docs/status.md) and [hardware verification](docs/hardware-verification.md).

## Take a look inside Skelly Studio

Studio is a browser-based editor — you don't need to edit Arduino code each time you change a routine.

**Eyes:** browse the expression gallery and choose fixed or randomized LCD eyes.

<img src="docs/images/studio-eye-picker.jpg" alt="Skelly Studio compact eye-expression gallery" width="680">

**Lighting:** adjust each channel's colors, palettes, brightness and animated effects.

<img src="docs/images/studio-lighting-controls.jpg" alt="Skelly Studio separate head and torso lighting controls" width="680">

<details>
<summary><strong>See more: scene builder and Connect & save</strong></summary>

**Scenes:** save named looks and inspect the illustrative request timeline.

<img src="docs/images/studio-scene-routine.jpg" alt="Skelly Studio scene library and routine preview" width="680">

**Connect & save:** connect the ESP32, optionally read what's already saved, and explicitly save your changes.

<img src="docs/images/studio-connect-save-desktop.jpg" alt="Skelly Studio connect, read and save workflow" width="680">

</details>

These are browser screenshots. USB examples may use a simulated controller; appearance and timelines are illustrative, not real-time hardware telemetry. [More Studio UI details](docs/studio-ui-refinements.md).

## Quick start

### What you'll need

- A **Home Depot 6.5-foot Ultra Skelly v2** in Bluetooth mode.
- An **original ESP32-WROOM development board with 4 MB flash** and a USB **data** cable.
- A computer running desktop **Chrome or Edge** for the recommended first-time browser setup.
- USB power for the ESP32 during normal operation.

### Set it up

1. **Open [Skelly Studio](https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/).** Under **Connect & save**, choose **First-time setup**.
2. **Install the universal ESP32 firmware.** Follow **Connect ESP32 → Install Firmware → Configure Skelly**. The browser installer uses a versioned, checked package; you don't need Arduino IDE or a GitHub account for this path.
3. **Save a simple routine.** Return to Studio, connect the ESP32 again and wait for **Ready**. If the board already contains a routine, read and back up its settings first. Select **Subtle** (head movement every **60–120 seconds**; arm, torso and jaw OFF), then choose **Save this routine** and wait for **read-back verified**. You don't need to create a scene.
4. **Let Skelly run.** Disconnect USB from your computer, keep the ESP32 powered, put Skelly in Bluetooth mode and disconnect competing Bluetooth controllers. Watch a simple routine **while attended** before trying advanced combinations.

> **Before you install:** Flashing firmware **replaces the ESP32 program and resets saved settings/scenes**. Export backups first. The owner's successful Arduino installation and Studio USB read/save tests **do not yet verify physical browser flashing or recovery**. Browser installation is the recommended workflow, but it remains physically **untested**; [Arduino installation is an advanced fallback](docs/browser-installation.md).

**Changing the routine later?** You generally only need to reconnect over USB and **Save this routine** (or **Save scene collection**), **not reinstall firmware**. Saving a routine sends the current editor settings; saving a scene collection sends the saved Scene builder library and switching policy, not unfinished edits.

[Detailed browser installation & recovery](docs/browser-installation.md) · [Full setup guide](docs/setup.md) · [Troubleshooting](docs/troubleshooting.md)

## Start with a personality

Studio has starting looks for different kinds of activity:

| Look | Example behavior |
| --- | --- |
| **Subtle** | Beginner-friendly, occasional head movement; arm, torso and jaw OFF. |
| **Moonlit Watcher** | Head turns requested at randomized **60–120-second** intervals. |
| **Ember Glow** | Adds occasional arm requests at **150–240-second** intervals. |
| **Haunted Porch** | Includes torso and optional combined movement for a busier routine. |

These are **requests**, not guaranteed exact start times: motor cooldowns, Bluetooth reconnects and other enabled actions can delay them. Adjust the look in Studio before saving.

Want different moods through the evening? The optional **Scene builder** supports up to four scenes, ordered or random rotation, and a default **10-minute hold** per scene. Physical scene-transition and long-duration tests remain pending. [Scene settings explained](docs/usb-settings-scenes.md).

## Advanced features (optional)

The beginner routine requires **no audio upload, scene collection or advanced settings**. If you want more control:

- **Compound / coordinated movement:** opt into supported combined body commands or protected jaw-first arm/torso follow-ups. They are separate modes; arbitrary overlapping body commands are not supported. **Jaw-first head follow-ups failed physical testing.** [Body movement safety](docs/body-movements.md) · [Jaw-first tests](docs/jaw-first-experiment.md) · [Compound tests](docs/body-combo-test.md).
- **Mouth and MP3 routines:** limited, **OFF by default**. Stored clips can drive jaw motion, but audio may take over eyes/lighting and interrupt body actions without protections. Clip numbers belong to your own prop, not a universal preset. [Jaw audio recipes](audio/jaw-personalities.md).
- **Experimental audio scenes:** prepare/trim audio locally, preview it on your computer and configure per-clip movement and appearance. The newer direct Web Bluetooth upload/metadata workflow has **software tests only; real uploads and coordinated playback remain physically untested**. [Audio-scene guide](docs/audio-scenes.md).
- **Idle breaks and time windows:** pause requests between active periods. The experimental weekday/time window needs its clock set over USB **after every restart**; it does not have a persistent real-time clock or automatic daylight-saving adjustment. [Feature status](docs/status.md).
- **Backups, diagnostics and source:** export/import portable JSON, inspect USB status and read-back, and generate self-contained `.ino` source for advanced Arduino use. Studio editing and source generation also work from a complete downloaded folder offline. [Architecture](docs/architecture.md) · [Testing](docs/testing.md).

## Compatibility and test status

| | **6.5-foot Ultra Skelly v2** | **2026 app-controlled 12-foot Skelly** |
| --- | --- | --- |
| Support level | **Primary target; tested on one prop** | **Experimental opt-in; NOT hardware tested** |
| Head | Yes | Experimental |
| Arm / torso / combinations | Optional | **Disabled** |
| LCD eyes | 18 designs | 20 numbered options |
| RGB | Head + torso | Chest channel only |
| Audio / jaw | Optional, limited | **Disabled** |

The 12-foot option is tucked under Advanced and targets **only the newer app-controlled 2026 model**, not older 12-foot props. No physical 12-foot compatibility has been established. [Read the 12-foot precautions and volunteer checklist](docs/experimental-12ft.md).

**Evidence matters:** Individual Ultra movements, eye changes, lighting and USB read/save have been observed on the owner's single test setup. Browser firmware flashing, power-cycle retention, some audio/scene paths and extended unattended reliability still need focused physical confirmation. Software tests or successful BLE writes alone do not prove that a prop moved. Start with conservative, attended testing and keep power accessible.

[Detailed hardware verification matrix](docs/hardware-verification.md) · [Experiment history](docs/experiments.md) · [Next attended checks](docs/next-release-checklist.md)

## No cloud account or subscription

Skelly Studio runs in your browser. It has **no app login, telemetry or server-side profile storage**; settings and scene drafts stay in the browser unless you export them or explicitly save to the ESP32. Firmware uses **local Bluetooth**, not Wi-Fi. The hosted Studio page still makes normal web requests to GitHub Pages; first-time browser installation needs internet for the firmware package and installer library. Optional audio processing stays local.

## Documentation and development

| Looking for… | Start here |
| --- | --- |
| Installation, updates and recovery | [Browser setup](docs/browser-installation.md) · [USB settings and scenes](docs/usb-settings-scenes.md) |
| Troubleshooting and safety | [Troubleshooting](docs/troubleshooting.md) · [Body safeguards](docs/body-movements.md) |
| Actual feature readiness | [Feature status](docs/status.md) · [Verification matrix](docs/hardware-verification.md) |
| Building and testing the project | [Architecture](docs/architecture.md) · [Tests](docs/testing.md) · [BLE protocol](docs/protocol.md) |
| What's changing next | [Changelog](CHANGELOG.md) · [Roadmap](docs/roadmap.md) · [Experiment notes](docs/experiments.md) |

The Arduino firmware, local browser Studio, generators and tests are open source. Generated `.ino` files require an Arduino toolchain to compile; the browser installer instead installs an already-built firmware package. Automated checks include JavaScript, protocol, native firmware and ESP32 compile tests, but **none substitutes for physical hardware testing**.

## Bugs, ideas and contributions

[Open a GitHub issue](https://github.com/jacobmgoodnight/ultra-skelly-esp32-autonomous/issues) for an improvement or a bug. For setup or hardware reports, share your board, browser, settings, expected vs. observed behavior, and whether a result was **physically seen** or only logged. Remove Bluetooth addresses and other private details before posting logs.

Contributions are welcome: [CONTRIBUTING.md](CONTRIBUTING.md) · [Project test instructions](docs/testing.md).

## Credits and license

This is an **unofficial hobby project**, not affiliated with Home Depot or the manufacturer. Thanks to [martinecker's Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController) for protocol research, saved-settings experiments and file-upload groundwork. This is a separate implementation.

Original project code and documentation are distributed under the [MIT License](LICENSE), with upstream assets subject to their own terms. The optional local encoder [lamejs / LAME](studio/vendor/lamejs-1.2.1/NOTICE.md) is distributed with its separate **LGPL-3.0** notices and source.

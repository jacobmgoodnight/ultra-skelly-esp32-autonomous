# Ultra Skelly ESP32 Autonomous Controller 💀

An autonomous BLE controller for the Home Depot Ultra Skelly v2, with randomized
body movement, jaw MP3 playback, optional eyes and live RGB lighting. Configure it
in **[Skelly Studio](https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/)**,
flash an inexpensive ESP32-WROOM board, and let it run without a connected phone,
browser, Wi-Fi, cloud service or subscription. GitHub Pages hosts the static site.

## Current evidence — October 20, 2026

| Feature | Latest result |
| --- | --- |
| Head / arm / torso commands | Physically verified: ~25 / 22 / 25 seconds; arm includes two motions |
| Compound masks `0x03`, `0x05`, `0x06`, `0x07` | All activated the selected motors from one packet, with no MP3 |
| Recurring compound scheduler | Implemented, OFF by default; extended field testing pending |
| Jaw MP3 → 2 s → arm or torso | Physical overlap verified; protected alternating scheduler logged ~30 minutes without reported mid-session reconnects/skips |
| Jaw MP3 → head at 2 or 10 s | **Failed physically** despite logged writes; use protected standalone head |
| Live one-shot / randomized eyes | Physically verified; MP3 eye restoration still needs observation |
| Live torso/head RGB initialization | Both chosen colors physically appeared |
| MP3 lighting override | **Observed:** file #13 restored its saved colors |
| Post-MP3 lighting restoration | Logs showed writes; **actual color return is not yet confirmed** |
| Garbled Serial Monitor output | Reported near playback/restoration; cause unknown |
| Power-cycle reconnect / multi-day endurance | Automatic retries implemented; complete field verification pending |

All observations are from one prop. Logged BLE writes and compile tests do not
prove actuator response. See the [verification matrix](docs/hardware-verification.md)
for evidence limits and the [experiment history](docs/experiments.md) for chronology.

## Quick start

1. Install Arduino IDE and **esp32 by Espressif Systems 3.3.12**. Select **ESP32 Dev
   Module** for the original ESP32-WROOM-32 board. Serial Monitor uses **115200**.
2. With Skelly powered on, use the community [Skelly Ultra Web Controller](https://martinecker.github.io/SkellyUltraWebController/)
   to upload a jaw MP3. Set its saved head/arm/torso movement flags to **`0x00`**.
   Play it once and record its actual file serial. **#12/#13/#14 are specific to
   the original tester's device**, not universal slots. The physical volume knob
   can silence the speaker while the jaw moves; software volume zero is not equivalent.
3. Disconnect the phone/web controller so the ESP32 can connect. Choose settings in
   Studio and download the self-contained `.ino`, or edit
   `firmware/SkellyAutonomous/SkellyAutonomous.ino` and set `MOUTH_FILE_SERIAL`.
4. Compile/upload. The ESP32 finds **Ultra Skelly v2** by name; no MAC entry or
   physical wiring to the prop is needed. It scans five seconds and retries
   misses/connection failures after 30 seconds. A board EN/RESET press can help
   after flashing, but automatic retries are intended for regular operation.

[Full setup](docs/setup.md) · [Troubleshooting](docs/troubleshooting.md)

## Conservative movement scheduling

The checked-in sketch enables head and jaw, with torso, arm, eyes, compound mode,
live lighting and verbose diagnostics OFF. Start intervals are start-to-start
requests; motor locks or playback may postpone them. Cooldowns remain head **25+7 s**,
arm **22+10 s**, torso **25+10 s**. Conservative presets reduce motor activity.

MP3 protection defaults ON and includes **head, arm and torso**. It prevents an
MP3 from interrupting active body motion and blocks standalone body commands
while playback is due/active. Proven jaw-first arm/torso follow-ups are deliberate
exceptions. Keep compound mode OFF to retain the alternating jaw-first setup;
Studio rejects selecting both modes. Separate-write body overlap remains advanced.

[Body safety](docs/body-movements.md) · [Jaw-first guide](docs/jaw-first-experiment.md) ·
[Compound tests](docs/body-combo-test.md)

## Lighting diagnosis in progress

Channel 0 is **Torso Light**, channel 1 **Head Light**; the exact head LED region
has not been mapped to the mouth. Live colors worked before MP3 playback, which
then reapplied saved colors. Restoration remains opt-in and visually unconfirmed.

The reliability changes honor BLE write failures, add timestamped text and boot/reset
information, and complete all six restore writes before the next MP3. Verbose
mode adds heap, connection and write/queue diagnostics. Playback end is still
**estimated at 21 seconds**, with a 500 ms grace before queuing restoration; there
is no playback-ended subscription. Longer MP3s require a conservative
`MOUTH_CLIP_MS` adjustment in the downloaded sketch.

**Next on-device test:** [exact isolated jaw/RGB settings and pass/fail criteria](docs/testing.md).
Do not regard the restoration problem or serial corruption as fixed until observed.

## Studio and development

Studio runs entirely in the browser and can also be opened as `studio/index.html`
from a downloaded ZIP. It supports motor intervals, compound masks, jaw file pools,
jaw-first follow-ups, eye choices, optional idle breaks, static RGB and sketch
copy/download. Eye thumbnails need internet; generation uses local assets. The
five-minute timeline is illustrative, not a full scheduler simulation.

The canonical `.ino` generates `studio/template.js` via
`node scripts/sync-template.cjs`; CI fails if they differ. Checks include generator
and gallery tests, actual firmware C++ with mocked clock/BLE, CRC vectors, canonical
and representative generated ESP32 compilation, and the isolated compound sketch.
Tests do not replace physical observation.

- [Architecture and known limitations](docs/architecture.md)
- [Automated checks and hardware procedure](docs/testing.md)
- [Prioritized roadmap](docs/roadmap.md)
- [BLE protocol](docs/protocol.md)
- [Jaw audio recipes](audio/jaw-personalities.md)
- [Contributor instructions](CONTRIBUTING.md) and [agent instructions](AGENTS.md)

## Credits and license

The [Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController)
by martinecker enabled file upload, saved-settings experiments and protocol
research. This is a separately written, unofficial hobby controller, not affiliated
with Home Depot or the manufacturer. Original code, documentation and synthesized
audio use the [MIT License](LICENSE); upstream assets retain their own terms.

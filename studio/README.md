# Skelly Studio

A static browser configurator for the autonomous ESP32 controller.
[Open Studio](https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/)
or open `index.html` from a local ZIP. No backend, account or build step is needed.
The eye thumbnails require internet; firmware generation works offline.

Choose randomized head/jaw timing, optional arm/torso, live eyes, RGB colors,
jaw-first follow-ups, compound masks, MP3 pools and idle breaks; then download or
copy a self-contained `.ino`. Flash with Arduino IDE, **ESP32 Dev Module**, core
**3.3.12**. The browser does not compile or flash firmware. The five-minute preview
is illustrative and does not model all arbitration. Profiles/import-export remain
planned work, not current features.

## Current feature evidence

See the [current verification matrix](../docs/hardware-verification.md). Head,
arm, torso, live eyes, jaw-first arm/torso and every compound mask have physical
evidence on one prop. Recurring compound automation remains untested. The
alternating jaw-first scheduler has ~30 minutes of serial dispatch evidence;
every full physical cycle was not separately timed. HEAD after jaw failed at
both 2 and 10 seconds; keep that diagnostic OFF in regular operation.

Compound and jaw-first modes are separate. Default MP3 protection covers **all
body motors**, including head, and overrides independent head/jaw overlap. Keep
stored MP3 movement flags **0x00** and discover the serial on your own device.
Intervals are start-to-start targets and may be postponed by locks or restoration.

Both live torso/head colors physically changed before playback; MP3 #13 then
restored its saved purple colors. **October 21: the user confirmed both red body
and green head return afterward in mode 1**, with body motors and eyes OFF. This
is one-prop evidence; mode 2 and motor integration remain unverified.
Channel 1 is protocol-labeled Head Light; a separate mouth channel is not known.
Mode 1 queues restoration 500 ms after the modeled 21-second playback, then waits
100 ms to start its six writes. It does not receive actual end-of-playback status.
The next MP3 waits for all six writes. Mode 2 (during + after) is experimental.
For longer files, increase `MOUTH_CLIP_MS` conservatively in the downloaded sketch.

Verbose diagnostics are OFF by default. Enable them for the
[isolated lighting test](../docs/testing.md): boot/reset, uptime, heap, BLE outcomes
and queue progress help investigate the reported garbled Serial Monitor output.
Its cause is unknown. Use **115200 baud**.

## Development

Edit `firmware/SkellyAutonomous/SkellyAutonomous.ino` and regenerate the embedded
snapshot using `node scripts/sync-template.cjs`. Do not hand-edit `template.js`.
CI checks drift, JavaScript, generator output, gallery markup, packet CRC and
actual C++ behavior with mocked BLE/time, then compiles canonical firmware,
representative generated sketches and the compound diagnostic with core 3.3.12.
[Reproducible commands](../docs/testing.md) · [architecture](../docs/architecture.md).

# Skelly Studio

A static browser configurator for the autonomous ESP32 controller.
[Open Studio](https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/)
or open `index.html` from a local ZIP. No backend, account or build step is needed.
Eye thumbnails and firmware generation work offline from the complete folder.

Advanced & testing includes a collapsed experimental device option for the
2026 app-controlled 12-foot model. It is **Not Hardware Tested**; Ultra stays
the default. See [supported restrictions, installation and rollback](../docs/experimental-12ft.md).

Choose randomized head/jaw timing, optional arm/torso, live eyes, RGB colors,
jaw-first follow-ups, compound masks, MP3 pools and idle breaks; then download or
copy a self-contained `.ino`. Flash with Arduino IDE or CLI, **ESP32 Dev Module**, core
**3.3.12**. The optional [universal firmware](../docs/usb-settings-scenes.md) can
subsequently read/save settings over USB without recompiling. It also supports up
to four saved scenes and optional rotation. The separate USB page accepts reviewed
head-only or universal packages. The owner confirms browser USB connection,
read/save and observing changed behavior; power-cycle recovery and scene transitions
remain physically Untested.
The five-minute preview
is illustrative and does not model all arbitration. Save/load settings keeps your
configuration and named jaw clip mappings in a portable JSON file.

## Current feature evidence

See the [current verification matrix](../docs/hardware-verification.md). Head,
arm, torso, live eyes, jaw-first arm/torso and every compound mask have physical
evidence on one prop. The owner reports recurring compound actions work; the new interleaved
standalone/combined scheduler still needs its focused physical check. The
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

## Studio usability

Scene builder uses visual cards with explicit Update/Save as new, Duplicate,
Rename, keyboard-accessible ordering and one-step library Undo. Saved libraries
keep their existing version-1 format and storage key. A separate recoverable draft
stores valid editor changes locally; importing scenes or replacing unfinished edits
asks first. Editor, browser library and last verified ESP32 program have separate
status. Complete looks combine existing movements, eyes and lights without mouth
or clock scheduling. Their combined physical behavior is not newly verified.

Lighting uses compact per-channel cards, percentage brightness (exact 0–255 values
retained), conditional speed and an individual palette editor. The timing preview
supports five or fifteen minutes for the current editor. Scene builder has a
separate Routine preview using each saved scene’s hold; unfinished changes are
excluded until updated. Both illustrate requests rather than predicting movement. See the
[short scene-builder checklist](../docs/studio-scene-builder-checklist.md).

Everyday body controls are visible first; optional mouth routines stay at the bottom.
Normal starts with fixed eye #1; Haunted selects eyes 1–8 every 150–300 seconds.
Eye/lighting previews stay open; detailed choices
expand on demand. One selected eye stays fixed; multiple eyes switch randomly.
Lighting brightness defaults to 255 and effect speed to 125. Effects/speed and
brightness apply to all palettes in a scene; palettes hold torso/head colors.
Colors can be linked for the current look or individually per palette.
Scene builder sits above Send to your ESP32 and Advanced, uses minutes (10 by default), and supports
ordered or random switching after full old-action cooldowns. Sketch downloads
include a local date/time suffix. The clip library maps readable
names to the user's actual uploaded MP3 serials. Settings and clip mappings can
be saved/loaded as validated version-4 JSON files without an account. Existing
firmware defaults remain unchanged.

See [Studio next steps](../docs/studio-roadmap.md) for pending hardware checks,
browser USB uploading, and ideas for future improvements. Studio currently
generates `.ino` source; it does not compile firmware. USB tools provide the separate
package installer. **Send to your ESP32** groups connect/read/save with separate
USB and Skelly Bluetooth indicators. **First-time setup** folds away the one-time
universal installation. Advanced contains collapsed diagnostics using the same port.
Status refreshes every five seconds while identified and idle; manual operations
cancel the background request, and hidden pages pause polling. An eight-second
timeout marks the last snapshot stale without declaring Bluetooth disconnected.

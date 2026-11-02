# Skelly Studio

A static browser configurator for the autonomous ESP32 controller.
[Open Studio](https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/)
or open `index.html` from a local ZIP. No backend, account or build step is needed.
Eye thumbnails and firmware generation work offline from the complete folder.

The separate [experimental repeat-back lab](talkback.html) records a short phrase
for manual playback. The owner confirms sound and jaw response through Skelly’s
Live speaker. An optional automatic pilot detects nearby sound and repeats at
most two phrases, with bounded capture and a 45-second pause. The owner confirms
both phrases repeated with jaw movement and the pilot stopped in one attended run.
It defaults OFF; longer sessions and recovery remain Untested. See the
[isolated setup and test criteria](../docs/experimental-talkback.md).
The laptop supplies the microphone; no ESP32 mic is required. The lab adds explicit
input selection, an automatic-capture sound meter and an optional lower/slower
Deep voice. Those additions have software coverage; Deep sound/jaw response is
not hardware verified. Raw repeat-back does not filter words.

Eyes and Lighting use the editor's full width. The compact gallery keeps descriptive
names, fixed or multiple selection, and a separate enlarged preview. Your Skelly
summarizes the current eyes and lighting without a second Look panel.
Quick looks default to eyes and lights only;
Complete routine deliberately starts a new scene. Saved scenes can supply just
eyes, lights or both to the current editor.

Effect samples run below Lighting in Your Skelly using each channel's brightness
and speed. Native color pickers stay static and unobstructed. Timing is illustrative,
with browser strobe capped at two flashes per second. A subtle Pause/Resume button,
hidden tabs and reduced motion control animation. Palette
edits are staged until Apply; Cancel/Escape discards them. No preview opens USB
or Bluetooth. Update/save a scene, then explicitly send the collection to keep
controller settings in sync.

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
The 15-minute preview
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

The section shortcuts keep Personality, Movement, Eyes, Lighting, Scenes, Preview
and Connect & save in reach on phones and desktop. First-time setup links directly
to the model-specific browser installer; connecting an identified controller folds
the introductory guidance. Everyday saves still require explicit replacement consent.
Connect & save shows the verified-settings comparison beside its controls. Invalid editor settings
disable only Save this routine; saved scene collections can still be sent. A failed
save/read-back clears the comparison and asks for a fresh read before retrying.
See the [usability audit and before/after screenshots](../docs/studio-ux-audit.md).

Scene builder uses visual cards with explicit Update/Save as new, Duplicate,
Rename, keyboard-accessible ordering and one-step library Undo. Saved libraries
keep their existing version-1 format and storage key. A separate recoverable draft
stores valid editor changes locally; importing scenes or replacing unfinished edits
asks first. Editor, browser library and last verified ESP32 program have separate
status. Complete looks combine existing movements, eyes and lights without mouth
or clock scheduling. Their combined physical behavior is not newly verified.

Lighting uses compact per-channel cards, percentage brightness (exact 0–255 values
retained), conditional speed and an individual palette editor. The timing preview
shows a fixed fifteen minutes for the current editor. Scene builder has a
separate Routine preview using each saved scene’s hold; unfinished changes are
excluded until updated. Both illustrate requests rather than predicting movement. See the
[short scene-builder checklist](../docs/studio-scene-builder-checklist.md).

Everyday body controls are visible first; optional mouth routines stay at the bottom.
Normal starts with fixed eye #1; Haunted selects eyes 1–8 every 150–300 seconds.
Eye/lighting previews, the expression gallery and lighting adjustments start open;
fold the choices when you want a compact view. One selected eye stays fixed;
multiple eyes switch randomly.
Lighting brightness defaults to 255 and effect speed to 125. Effects/speed and
brightness apply to all palettes in a scene; palettes hold torso/head colors.
Colors can be linked for the current look or individually per palette.
Scene builder sits above Connect & save and Advanced, uses minutes (10 by default), and supports
ordered or random switching after full old-action cooldowns. Sketch downloads
include a local date/time suffix. The clip library maps readable
names to the user's actual uploaded MP3 serials. Settings and clip mappings can
be saved/loaded as validated JSON files without an account: version 4 for Ultra
and version 5 for the experimental 12-foot model. Existing
firmware defaults remain unchanged.

See [Studio next steps](../docs/studio-roadmap.md) for pending hardware checks,
browser USB uploading, and ideas for future improvements. Studio currently
generates `.ino` source; it does not compile firmware. USB tools provide the separate
package installer. **Connect & save** highlights the next action through connect,
explicit read, save and verified read-back. Save this routine uses the editor;
the optional scene-collection disclosure sends the saved browser library instead.
USB and Skelly Bluetooth indicators stay separate. **First-time setup** folds away the one-time
universal installation. Advanced contains collapsed diagnostics using the same port.
Status refreshes every five seconds while identified and idle; manual operations
cancel the background request, and hidden pages pause polling. An eight-second
timeout marks the last snapshot stale without declaring Bluetooth disconnected.


Body movement includes automatic purple illustrations in place of the left movement icons.
They respect reduced motion and pause when the page is hidden. They do not
represent live controller activity. Saved scene
cards keep Edit visible and fold other actions; Routine preview displays one saved
scene selected from its dropdown without replacing editor settings.


Audio scenes is an experimental, optional preview collapsed inside Advanced & testing. `audio.js` implements a bounded direct
Web Bluetooth session, prepared MP3 inspection, fresh-file transfer and verified
per-file appearance settings. `audio-ui.js` keeps that preparation separate from
ordinary editing and the ESP32 USB session. Nothing connects or plays on load.
Uploads accept prepared 8 kHz / mono / 32 kbps MP3s. Optional local preparation
loads the bundled lamejs encoder only when conversion is requested; it uses no
cloud service. Metadata read-back is software evidence, not physical playback proof.
See [setup, limits and attended results](../docs/audio-scenes.md).

Local audio preparation is provided by audio-prep.js/audio-prep-ui.js and the
separately licensed bundled encoder. The complete folder works without a converter
CDN. Friendly file labels are optional browser/profile metadata only. See
[current status](../docs/status.md), [release notes](../CHANGELOG.md) and
[next checks](../docs/next-release-checklist.md).

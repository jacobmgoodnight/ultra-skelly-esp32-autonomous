# Attended checks prepared for usb-scheduler-v3

Hardware is not available during this development pass. These are **Untested**
physical checks, not results. Existing verified individual commands, clip identities
and mode-1 restoration do not need rediscovery. Keep the working firmware first.
Use the original ESP32-WROOM, core 3.3.12, clear joints and a stable prop.

1. **Baseline and capture comparison:** keep the same lighting-OFF jaw sketch,
   cable and power as the garbled run. Capture about four minutes using
   `scripts/capture-serial.py` in a second terminal. Save `.bin`, the readable log,
   settings/build marker and whether a reset or visible fault occurred. Pass is
   intact expected text; corruption is useful evidence, not a reason to label a
   guessed cause fixed. Do not change the sketch during this comparison.
2. **New firmware regression:** use Quick06_MotorsLights (roughly four minutes),
   with the confirmed file serial and saved body flags 0x00. Observe standalone
   head completion, due arm/torso follow-ups, jaw continuation and both colors
   returning. Then Test08_Reconnect: three prop-only 30-second power-offs, letting
   each recover. Record actual response, retries and post-connection heap. No
   unrequested motion, interrupted action, stale replay, reset or falling-heap
   trend. A short pass is not endurance proof. Eyes/compound remain separate.
3. **Clock head-only:** configure Watchful, jaw/eyes/lights/arm/torso OFF. Enable
   a window covering the intended test time, preferably a short window ending
   within a few minutes, and set head min/max to 32 seconds for the test. Upload
   and leave USB time unset: no head request should start. Connect USB tools,
   identify support if needed and set time. Observe a full head action inside
   the window; after closing, no new action starts and the existing one finishes.
   Reset the ESP32: it must wait for time again. No physical stop is promised.
4. **Fair-turn contention:** use short allowed jaw intervals, protection ON,
   mode-1 lights and one standalone head/arm/torso or separately compound mode.
   Enable fair turns. Observe several complete jaw and body actions; ensure jaw
   playback never interrupts a body action and no cooldown is shortened. Use
   0x00 file metadata. A normal fast loop may not reproduce the host's coarse-loop
   starvation case; report actual behavior instead of inventing a before/after.
5. **Per-file estimates:** enter conservative measured durations plus padding
   for the selected pool. First verify the actual serial chosen and that model
   timing uses its estimate. Then observe full playback and restoration; a timer
   log is not physical completion proof. Do not test an unknown long clip using
   the default 21-second estimate.
6. **Passive AE02 research:** jaw-only, known file, 60-second intervals and passive
   observations ON. Record bounded BBC6 metadata and the actual visible/audible
   start/end. Determine whether stop appears without another request, whether
   duration units/serials match, and whether duplicates/out-of-order events occur.
   The parser deliberately does not certify CRC or act on these records. Do not
   change motor protection based on an early/absent notification.
7. **Fixed-profile USB installer:** use a spare/recoverable original ESP32 if
   available, close capture, download the reviewed Actions package and check its
   source commit. Select its two files, review the board/preview notice and start
   the installer explicitly. Verify upload, boot marker and complete head-only
   action; no jaw/arm/torso/eyes/lights should be requested. Keep a recovery path
   through Arduino IDE/CLI. No browser flashing was performed during development.

Use the USB page's binary/text/summary downloads for new-firmware runs. Keep files
local until reviewed for personal information. Extend endurance gradually after
short attended success. Stop for binding, unexpected movement, interrupted playback,
resets or connection failures. Transport acceptance alone never passes these checks.

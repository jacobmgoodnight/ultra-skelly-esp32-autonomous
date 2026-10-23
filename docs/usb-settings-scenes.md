# USB settings, scenes and connected diagnostics

October 23 owner confirmation: browser USB identification, reading saved settings,
saving changes and observing the changed routine on Skelly worked. This supersedes
the earlier identification failure. Power-cycle retention, interrupted-transfer
recovery and ordered/random scene transitions remain separately unconfirmed.
The USB workflow refresh changes browser controls only; existing universal firmware
and saved profiles/scenes stay compatible. No additional firmware upload is needed
for this interface update.

## Install once, then change settings

Use the **universal** preview package on the USB tools page, or download universal
firmware from Studio's **Send to your ESP32 → First-time setup** and compile/upload once using
original ESP32-WROOM, ESP32 Dev Module and Arduino-ESP32 **3.3.12**. Its factory
routine is Subtle: head 60–120 seconds, all optional features OFF. The old fixed
head-only installer remains separate at 120–240 seconds; it does not load USB
settings. Neither build requires Wi-Fi, a phone, an account or a backend at runtime.

In desktop Chrome/Edge, close Arduino Serial Monitor and other port users. Connect
with **Connect ESP32** in **Send to your ESP32**, read saved settings, then
choose **Save routine** or **Save scenes** after checking the replacement
notice. The browser waits for chunk acknowledgments, an applied acknowledgment
and a matching read-back checksum. That confirms configuration, not physical motion.
While actions finish, the status reports pending settings. Disconnecting after a
commit may leave it pending/applied; reconnect and read settings before retrying.

The storage design retains settings through restart and a firmware upload that
preserves NVS; this still needs the separate physical power-cycle check. Erasing the
ESP32's data deletes them. Existing saved settings take priority over sketch
defaults; **Restore firmware defaults** replaces them explicitly after current
actions finish. Clock **time** is never saved: enabled clock windows still wait
for USB-set local time after every restart. There is no lights-out scheduling.

Core movement, combinations, eyes, palettes/effects, idle breaks, clock windows,
retry timing and ordinary protected mouth options are represented. Motor runtimes,
safety buffers and BLE spacing cannot be changed through this protocol. Failed
head-after-jaw diagnostics remain generated-sketch-only. Universal jaw-first delay
has a two-second minimum; the earlier one-second diagnostic remains source-only.
Clip file numbers must already exist on the prop. Named clip-library mappings
remain in browser profiles; the actual selected files and estimates are stored.

## Saved personalities and scenes

Save up to four named scenes in Studio. Each captures the full validated settings
and its duration (60–3600 seconds); local browser storage is used only when you
explicitly save/import/change the library. Export JSON to keep a portable copy.
Loading a scene edits Studio; it does not send anything to the prop. Sending scenes
or downloading a scene routine is a separate action.

Optional scene rotation runs in order on the ESP32 without a browser. A scene gets
its full duration after each successful BLE connection. At its boundary the
controller stops starting new routines, lets pending movement/playback/restoration
finish, applies the next configuration and reconnects with fresh request targets.
It never shortens the 32/32/35-second body cooldowns. No NVS write occurs during
scene rotation. Disabled lighting leaves existing LEDs alone; it does not switch
them off. Choose scene durations long enough for their requested intervals.

Runtime servicing retires elapsed cooldown timestamps while disconnected as well
as connected. This prevents a regularly serviced controller from treating old
locks as future deadlines after the signed timer half-range (about 24.9 days),
which would otherwise leave a USB save pending and suppress reconnect. A native
full-loop regression covers 25 days offline, a save, a still-active 32-second lock,
then continued offline servicing through millis wrap. These are software results,
not an endurance or hardware pass.

## Protocol and storage contract

### First setup and identification recovery

Download **universal firmware** in Studio → Send to your ESP32 → First-time setup. Open the timestamped
`.ino` in Arduino IDE, choose **ESP32 Dev Module** and **Arduino-ESP32 3.3.12**,
then compile/upload. Close Serial Monitor and all other serial tools/tabs. In
desktop Chrome/Edge choose **Connect ESP32**, then the board's USB adapter
(for example **CP2102 USB to UART Bridge Controller (COM3)**; the number varies).
Wait for **Ready** under **Computer → ESP32** before read/save.

Opening a serial port can restart this board. The browser now retries only the
read-only `SKELLY HELLO` request every three seconds, for at most 45 seconds;
an initial request may have been lost during boot. This is a plausible software
cause, not a confirmed diagnosis of the owner's board. **Retry identification**
works without closing/reopening the port. The status box distinguishes identifying,
ready and error, and **Download USB log** preserves the received text.

If it still fails, close Studio's USB connection and open Arduino Serial Monitor
at **115200**, line ending **Newline**. Send `SKELLY HELLO`, then `SKELLY STATUS`.
The new firmware should answer `USB CAPS v2 settings=1 ...` and `USB STATUS v2 ...`.
If neither answers, press **EN/Reset** once, wait for boot/connection to finish,
then repeat those two commands. Save the full responses and boot log. Close the
monitor before retrying Studio. No actuator command is issued by these requests.
If the monitor replies but Studio does not, that narrows the problem to the browser
session/adapter interaction; it does not establish an NVS or BLE fault.

October 22 owner log: NVS opens (`storage=1`, sequence 0), the universal build boots
and connects to Skelly at 7,980 ms after one failed connection. No HELLO/CAPS reply
was supplied then, and browser identification failed. On October 23, manual
HELLO/CAPS and STATUS replies were supplied, followed by confirmation that browser
connection, reading, saving and the changed physical routine worked. NVS recovery
and scene transitions remain **Untested** on hardware.

### Everyday controls and live status

The open **Send to your ESP32** panel sits below Scene builder and above Advanced.
Connect, read and save here; scene saving becomes available after at least one
scene is saved in the builder. **First-time setup** is collapsed unless firmware
identification reports that universal settings support is missing. It explains
installing once, closing Serial Monitor and subsequently saving through Studio.
The right-column finishing link scrolls here without opening a USB port.

**Computer → ESP32** describes USB; **ESP32 → Skelly** describes Bluetooth.
Bluetooth can be disconnected while USB is Ready and settings remain available.
The last-received timestamp belongs to a controller snapshot. Idle status requests
run approximately every five seconds with an eight-second timeout. A timeout marks
the snapshot older, preserving its last reported Bluetooth state rather than
claiming a new disconnection. These are reported controller states, not actuator
feedback.

Polling pauses during all manual operations and while the page is hidden. A manual
operation cancels and drains the background request before using the same serial
writer; settings transfers and read-back verification stay serialized. Background
replies never replace progress/error text. USB disconnect clears current details
and returns Skelly to Unknown. Revision, heap, failures, clock details, log download
and restore-defaults live in collapsed **USB diagnostics** under Advanced, sharing
the same port. Clock is needed only for enabled clock windows.

### Scene durations and order

Scene builder sits above Send to your ESP32. Durations display **minutes**, default
**10**, range 1–60 (fractional minutes supported); JSON/USB retain integer seconds.
Automatic switching OFF runs only the first scene. **In order** loops through the
list. **Random** starts with the first scene, then chooses a different scene each
time, without immediate repeats. Each hold starts at a successful BLE connection.
When time expires, pending motion/playback/restoration and conservative cooldowns
finish before switching; reconnect time can add a visible gap. Disconnected scenes
do not advance. Automatic rotation never writes NVS.

The existing version-1 order word extends from 0/1 to 0/1/2; record size and all
field offsets stay the same. Old records and scene exports retain their settings.
Old firmware safely rejects 2. The browser requires the new `randomScenes=1`
capability before sending random order; upload the updated universal build first.

### Focused follow-up after the identification correction

1. Connection/read/save and observing changed behavior are already owner-confirmed.
   For the refreshed UI, check separate USB/Bluetooth indicators and status age,
   including Skelly OFF, an idle auto-refresh, a hidden tab and disconnect cleanup.
   If identification regresses, collect the two manual replies above and
   **Download USB log** rather than repeatedly reflashing.
2. Select one eye with all motors/mouth OFF. Observe it initialize and remain the
   same for two minutes; reconnect and confirm it returns. Then optionally choose
   two eyes in random mode and observe both. Existing random-eye passes need no repeat.
3. Save two distinct mouth-OFF scenes for **1 minute** each, then test ordered
   switching and random switching. With only two, both orders alternate; use three
   to observe random selection. Pass: no immediate repeat, no interrupted motion,
   correct settings per scene, continued operation after USB disconnect.
4. Check linked torso/head colors visually with rotation OFF; for rotation use
   each palette's link checkbox. Effects/brightness apply to **all palettes in the
   scene**, separately for head/torso; a palette stores only its two colors.

Do not repeat the already-confirmed effects/rotation tests solely for this UI
refresh. New fixed-eye, color-link, power-cycle recovery and random-scene behavior remains
software-only until observed on hardware.

`SKELLY HELLO` retains `USB READY v1 CLOCK` and adds `USB CAPS v2 settings=0|1`.
`SKELLY STATUS` reports bounded text: link state, scene index, saved revision/CRC,
pending state, scan/connect/write/failure counters, heap and clock/window state.
Those are controller/transport models, never actuator feedback. The USB diagnostics
download includes this latest status alongside original-byte capture statistics.
No device address or BLE binary payload is logged.

The runtime schema is generated from `studio/runtime-schema.js` into a marked
canonical sketch block by `node scripts/sync-runtime-schema.cjs`; then run
`node scripts/sync-template.cjs` and the asset-version script. Normal generated
sketches retain compile-time settings. Only the universal/scene build defines
`SKELLY_RUNTIME 1`, activating the validated runtime aliases and Preferences storage.

Programs use schema version 1, one to four scenes and a fixed field order. Numbers
are unsigned 32-bit words; CRC-32/ISO-HDLC covers their little-endian bytes.
`BEGIN id count`, contiguous `DATA id offset` chunks of at most eight hex words,
and `COMMIT id crc` all have the `SKELLY CFG ` prefix. Pending work is acknowledged
as `QUEUED`; only validated, stored, read-back-checked configuration is `APPLIED`.
`GET id` emits a stable `DUMP`/`DATA`/`END` snapshot; `ABORT id` cancels a matching
unfinished request; `RESET id` queues sketch defaults. The receiver has bounded
buffers/work and a 30-second incomplete-transfer timeout. An active transfer/dump
defers disconnected scanning, so settings can be configured with the prop absent.

Two fixed-size NVS records alternate. Each stores a sequence, bounded program,
payload CRC and header guard. Read-back verifies a write before applying it;
boot selects the newest valid record, including sequence wrap. A torn/corrupt
inactive record leaves the previous valid slot available; if neither is valid,
the compiled factory scene is used. Incompatible record lengths/schema fail
closed to defaults. Future schema changes need an explicit migration design.

## New attended checks — when ready

1. Save a copy of your working sketch/profile. Install the universal build on a
   spare/recoverable board if available. Read status with Skelly OFF; saving must
   work without BLE discovery monopolizing USB.
2. Save Subtle with a distinct 70–90-second head interval. Read it back, disconnect
   USB, power-cycle and read again. Confirm the interval and name survive; then
   visually confirm a full head motion and no unwanted motors.
3. Start an ordinary movement, then save different settings. Observe pending
   status until the full old motion/cooldown finishes. No next action may cut it
   short. A read-back/checksum alone is not a physical pass.
4. Save two short, mouth-OFF scenes for 90 seconds each, with distinguishable
   movement choices. After isolated lighting tests pass, add distinct eyes/colors.
   Observe at least three scene changes, full motion completion and continued
   rotation with USB unplugged. A delayed transition at a busy boundary is expected.
5. Unplug USB during an incomplete transfer; the old saved routine must remain.
   Reconnect/read before retrying. Test restore-defaults and an ordinary power
   loss; do not deliberately cut power during motor action or force a brownout.
6. With clock windows ON, restart: settings survive but routines await time again.
   Closing a clock window still sends no lights-off command.

Stop for binding, interruption, unwanted movement or resets. Keep the exact
profile/scene JSON and raw USB log; report visible results separately. These
checks supplement, and do not replace, the checklist you are already completing.

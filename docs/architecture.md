# Controller architecture

The optional [2026 12-foot profile](experimental-12ft.md) is Experimental — Not
Hardware Tested. Model selection is fixed in each generated ESP32 build, with a
central capability map, final packet guards and separate USB format/NVS namespace.
Ultra defaults, wire layout and storage remain unchanged. No prop firmware is written.

The canonical Arduino sketch runs one cooperative loop on an original ESP32-WROOM
using Arduino-ESP32 3.3.12's BLE library. Studio is a static HTML/CSS/JavaScript
application that embeds this sketch and replaces validated constants plus several
optional scheduling blocks. It downloads one self-contained `.ino`. No backend,
Wi-Fi, or ongoing browser connection is involved.

## Optional USB settings and scenes

Universal sketches explicitly enable `SKELLY_RUNTIME`; ordinary generated sketches
keep that engine compiled out. `studio/runtime-schema.js` defines bounded fields;
`scripts/sync-runtime-schema.cjs` generates the matching firmware schema, aliases
and safe Subtle seed, then `sync-template.cjs` embeds the canonical source.
Both generated blocks are checked for drift. Cooldowns are never runtime fields.

A validated program holds one to four complete scenes. USB transfers stage a
whole program before CRC/range/cross-field validation. Application waits for active
motions, playback, follow-ups and restoration to finish; new routines pause while
an accepted update waits. Explicit saves use alternating NVS slots with payload
CRC, protected sequence headers and readback before application. Invalid or failed
saves preserve the running program; boot falls back to the newest valid slot or
compiled seed. Scene rotation writes no flash and waits for the same idle boundary.
Every applied scene reconnects by advertised name with fresh intervals. Scene hold
time starts at successful connection and does not advance scenes while disconnected.
Clock validity is never persisted. No lights-out behavior is added.

The browser uses explicit port selection, bounded text protocol queues independent
of its bounded raw-byte capture, acknowledged chunks and matching settings readback.
Saved local scene libraries are separate from controller storage. Status counters
describe transport/model state, never physical completion. See the
[protocol and attended criteria](usb-settings-scenes.md) for limits and recovery.

Studio's open Send to your ESP32 panel and collapsed Advanced USB diagnostics share
one `SkellySerial.Session`. `controller-state.js` manages status snapshots separately
from operation progress. Identified, idle, visible sessions poll every five seconds;
each background request has an eight-second timeout and AbortSignal cleanup.
Manual operations cancel/drain polling before using the writer, and settings
transactions remain serialized. Hidden/page-suspended sessions stop polling.
Timeout preserves an explicitly stale last-reported Bluetooth state; disconnect
clears the current snapshot. Generation/port checks discard late replies after
disconnect. No polling callback changes save progress or error text. This browser
workflow changes neither USB commands nor firmware/program formats.

`scene-model.js` validates complete library mutations before committing them, tracks
the edited scene through ordering/deletion, and retains one library Undo snapshot.
`scenes.js` separates the live editor baseline, the saved browser library and an
acknowledged controller program. Controller comparison uses runtime encoding rather
than display formatting; it is cleared on port changes. A separate bounded draft
envelope validates both the edited profile and revert baseline before explicit
recovery. Invalid input never replaces the last valid draft. File imports and USB
reads preview replacement before applying; asynchronous confirmations are serialized
with the existing controller workflow. None of these browser models opens a port,
applies an actuator command, changes runtime formats or shortens cooldowns.
`routinePreview` draws bounded sample requests for each saved scene using its own
hold, enabled lanes and the existing deterministic schedule illustration. It never
uses an unfinished editor draft or predicts arbitration/physical starts. Ordered,
random and switching-off labels describe selection policy rather than clock time.

`looks.js` owns browser-only eye names/favorites and appearance preview. Scoped
look/copy operations use a fixed field allowlist, preserve the current model and
movement/mouth/clock/restoration configuration, and validate before writing the
editor. Names/favorites never enter profiles or USB records. Palette editing
stages a draft outside `readConfig`; Apply validates and commits, while Cancel,
Escape or loading another config discards it. The saved-sequence strip reads only
the saved library. Nearby controller comparison still requires acknowledged
read-back and clears on disconnect.

Effect previews animate swatch opacity without mutating RGB/config values or
sending commands. Channel brightness and increasing UI speed affect an explicitly
illustrative sample; no physical effect-period mapping is established. Browser
strobe is capped at two flashes per second and entering strobe pauses playback
until Play. Hidden tabs and reduced-motion preferences gate all sample animation.

`scripts/sync-template.cjs` generates `studio/template.js` from the canonical sketch,
normalizing line endings. CI rejects drift. `replaceOnce` in `studio/app.js` rejects
missing/duplicate substitution anchors. Idle breaks, file pools, permitted eye
sets, and the independent head/jaw overlap option are generator extensions; their
substitution architecture is still a maintenance risk and is covered by the
generated compile matrix. The 15-minute UI timeline shows example requested
intervals, without pretending to arbitrate actual starts. Coordination and timing guidance stays beside the relevant settings; the preview
keeps its compact sample-request note.

## Connection lifecycle

`scanAndConnect` deletes the previous advertisement, clears scan results, and
performs a blocking five-second scan. The scan callback copies the matching
advertisement and stops scanning; connection starts only after scanning returns
and a 500 ms settling delay. Startup scans target five seconds between starts during the first minute after
setup, ending early on first success. Scan/connection work consumes that interval;
a full five-second miss can retry immediately. Afterward misses/failures pause
30 seconds. Studio exposes the startup interval and normal pause (5–300 s), plus
the startup period (0–300 s; 0 disables). Blocking connection work can delay
actual scan starts; no second scan starts before the first finishes. The startup period is
latched expired, including across millis wrap; disconnect does not renew it.
One BLE client is reused. Each connection now invalidates the application writer
and explicitly calls `getServices` before looking up AE00/AE01. In pinned
Bluedroid this deletes the old service objects and rebuilds their cache; the old
`getService`-only path could reuse a cache retained across disconnects. Empty
discovery, a missing service/characteristic, or disconnect during discovery rejects
the connection without sending an actuator command. Native tests exercise those
failures. Real stack behavior, repeated-cycle heap stability and physical recovery
still require an attended test; cache rediscovery is not a field-verified fix.

`resetConnection` invalidates the writer, disconnects if needed, cancels eye,
jaw-follow-up, modeled-end, and light work. Reconnection starts fresh randomized
movement targets and a lighting initialization sequence after 1.5 seconds. It
does not replay a failed body/MP3 command immediately. One-shot jaw-first trials
are intentionally eligible again on each connection. This can matter if the
prop continues a physical animation while its BLE link drops: physical state
cannot currently be recovered from the prop.

## Movement and jaw scheduling

Studio defaults to mouth OFF; common presets are audio-free. Its last collapsed
panel owns all mouth-only controls, revealed only on opt-in. Disabling mouth
clears jaw-first selection/recurrence, fair turns and passive playback diagnostics,
preserving clip mappings and independent body/eye/light/clock settings. Loading a
saved profile preserves its explicit settings. This UI change does not alter the
canonical reference sketch's previous head-and-jaw defaults or scheduling code.

Independent body scheduling chooses the most overdue eligible head, arm, or torso.
Each motor has a due time and cooldown, now anchored after a successful BLE call
returns so call latency cannot consume the cooldown. A shared lock serializes body commands by
default, with 600 ms between body writes. Separate-command overlap failed the
owner's physical test: a following action stops its predecessor. Studio removes
the control, forces its emitted constant OFF and clears it on profile import.
The canonical constant remains for historical diagnostic compatibility. Head uses 25+7 s, arm 22+10 s, torso
25+10 s. These are conservative models, not completion telemetry.

Combined-only mode suppresses independent body scheduling and sends one randomly
selected allowed mask. New Studio configurations default to interleaved mode:
a due combined event gets priority after existing movement cooldowns, then
individual requests resume after its full lock. Only one body packet can be sent
in a loop. Selected motors receive fresh individual due targets at combo start;
unselected motors retain their due targets and wait for the shared lock.
The canonical COMPOUND_ALONGSIDE flag stays OFF for legacy diagnostics. It validates selected motors and holds the shared lock
until the longest selected animation plus buffer ends. Studio rejects compound
mode with jaw-first follow-ups and requires MP3 body protection when jaw is ON.
Compile-time guards also reject compound mode with jaw-first follow-ups, or with
configured jaw playback and MP3 body protection OFF. Direct edits still need the
documented timing/mask constraints; Studio performs additional validation.

`startMouth` sends AAC6 for the device-specific stored file serial. Default MP3
protection waits for all body cooldowns and suppresses standalone body starts
while jaw playback is due or modeled active. Jaw-first arm/torso follow-ups are
explicit exceptions: at most one enabled eligible motor starts after the delay,
respecting its cooldown and shared lock. Recurrence gates eligibility by that
motor's own due time; alternating mode prefers the previously unselected motor
when both are due. Jaw-first HEAD remains a failed physical diagnostic.

Playback may restore stored movement flags, eyes, and lights. The current client
does not subscribe to AE02 by default. `mouthPlayingUntil` is **modeled** from `MOUTH_CLIP_MS`
(21 s), beginning after the write call returns. All pooled clips must fit that
duration or use a conservatively increased fallback/per-file estimate. There is no playback
completion confirmation. Optional per-file estimates (21–120 seconds, including
padding) use the selected pool serial; unmapped files use the fallback estimate.
Experimental AE02 observations are separately opt-in and never change these timers.

## Eyes and lights

October 22 adds opt-in palette rotation and per-channel light effects. Static
mode preserves the original six packet bytes and ordering. Strobe/pulsing insert
one F6 speed write per dynamic channel after its F2 mode write: seven or eight
spaced writes total. Speed follows upstream's inverted 0–254 UI mapping.
The owner subsequently confirmed effects and palette rotation work (October 22).
The report did not enumerate channels, speeds or jaw/clock integration.

Studio offers four editable palette slots, each with a name and torso/head RGB.
Names stay in the browser/profile; only validated RGB bytes enter the firmware
table. Palette buttons and rotation both use the edited values.
With rotation enabled, connection starts at the first selected palette.
After a completed light sequence plus the configured 15–3600-second interval,
the low-priority scheduler picks another selected palette, excluding the current
one. A snapshot remains stable throughout each sequence; no partial sequence is
overwritten by a rotation. New rotations wait for the clock window, idle breaks,
jaw work and pending restoration. A restoration uses the current palette and
selected effect/speed, then restarts the rotation interval. Disconnect clears
selection/work; reconnect starts fresh. Clock closure gates new rotations and
does not send a lights-off command. Existing sequences/restoration may finish.

Studio now exports v4 profiles. v1/v2/v3 imports supply defaults for new palette
and retry fields, retain combined-only scheduling, and force failed separate
overlap OFF. Other explicit prior settings remain. The timing preview compacts lanes
and its legend to enabled features; coordination and timing detail disclosures
are omitted from the preview.

Eyes use AAF9, an optional independent random schedule and delayed start/end
corrections around the modeled MP3. Corrections are separate from motor commands.
Studio defaults to one selected eye with eyes still OFF. A single-eye build sends
its expression once after connection, without periodic repeats; reconnect and
opted-in jaw corrections still restore it. Multiple selections use the existing
random schedule. The canonical reference retains its previous random-eye default.

Scene builder displays minutes (10 by default), retaining integer seconds in
compatible exports/wire records. Order word 0 runs the first scene only, 1 loops
in order, and 2 chooses uniformly from other scenes at each idle boundary. Existing
0/1 records retain their meaning and layout. Older firmware rejects order 2; new
firmware advertises `randomScenes=1`, which Studio requires before sending it.
USB identification retries only HELLO, within 45 seconds, to recover an initial
request lost to a USB-triggered boot. Settings writes are never retried implicitly.

Static lights use six spaced requests: torso F2/F3/F4, then head F2/F3/F4. F2 lengths are
11/12 bytes for channel 0/1; F3 is 11 bytes; F4 is 13 bytes. CRC covers every byte
before the final CRC. Initial live colors and MP3 overriding them were physically
observed. On October 21 the user confirmed mode 1 restores both red body and green
head after MP3 #13 in the isolated jaw/lighting configuration. Four restore
sequences appear in the supplied log; their BLE completion delay is 23.499 s
after each accepted AAC6 request. Actual physical color-change times were not
independently measured. Mode 2 and integration with body motors remain unverified.

Restore mode 0 initializes only. Mode 1 discards an unfinished older light
sequence on MP3 start and schedules a complete sequence at modeled end +500 ms,
then a 100 ms queue delay. Mode 2 also queues a full sequence three seconds after
MP3 start. A final restore replaces any unfinished during-playback sequence.
The next MP3 waits for pending restoration and the complete selected sequence
(six writes for Static; seven/eight with effects).
Lighting yields to pending jaw-first follow-ups and waits at least 250 ms after
other BLE writes; a light write yields the loop for 250 ms before other commands.
This can postpone due targets slightly. It does not detect the LEDs' actual state.

## Diagnostics and limits

`sendVariableFrame` checks lengths, computes CRC, honors the pinned BLE API's bool
write result, and also checks connection state. Failure triggers caller cleanup,
not an automatic immediate replay. Accepted WRITE_NR is still no device ACK.
Packet arrays are bounded stack buffers; this audit found no direct binary UART
output or demonstrated buffer overrun. That does not establish a cause for the
reported garbled serial output.

Text event logs use one bounded formatting buffer and an uptime prefix. Boot logs
include a build marker, numeric ESP-IDF reset reason, validated RTC-NOINIT boot count, and
heap. [RTC-NOINIT retains values across software restarts](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/memory-types.html);
the counter is reset on power-on or an invalid guard. RTC memory does not survive
every reset/power loss, so this is not a lifetime boot total. Verbose diagnostics add
per-write outcomes and event-triggered connection/heap/light snapshots. Uptime
wraps at ~49.7 days. Signed deadline comparisons require deadlines within half
that range. The loop now retires elapsed cooldown/model-end/spacing deadlines by
moving them to the current uptime, leaving future deadlines unchanged. Movement
targets are not refreshed: their overdue age determines dispatch priority. This
prevents continuously serviced inactive cooldowns from becoming future locks
after ~24.9 days. As with other signed deadlines, this assumes the cooperative
loop is serviced within the half-range; a loop blocked for weeks is not recovered
by this mechanism. Actual C++ tests cover 60 simulated days and wrap, plus body
cooldowns after a simulated five-second write. Neither is physical endurance
evidence. See [audit follow-up](audit-follow-up.md) for attended regression criteria.

## Optional USB clock, fairness and observations

Boot marker `usb-scheduler-v3` identifies the next software revision. USB accepts
bounded HELLO/TIME lines in ordinary generated sketches; the optional universal
build additionally accepts validated settings transactions described below.
Clock windows default OFF. Enabled windows fail closed after every
boot until USB local time is accepted, use Sunday-based weekday bits and a daily
start-inclusive/end-exclusive interval, including overnight windows owned by their
start day. The cooperative loop accumulates unsigned millis deltas in 64 bits.
There is no NVS time restoration or automatic timezone/DST handling. Window entry
refreshes request targets, exit cancels pending motor follow-ups; existing motion
and eye/light restoration can finish. Firmware does not issue a physical stop.

Fair body turns default OFF. With MP3 protection ON, after a jaw clip an eligible
overdue standalone/compound body request can run before another due jaw clip.
It preserves all body locks/spacing and excludes motors reserved for recurring
jaw-first follow-ups. Tests reproduce jaw-priority starvation with restoration
and coarse loop service, then verify fair turns without bypassing cooldowns.
This is software evidence, not a measured field starvation result.

Passive notification observations default OFF. A callback copies at most seven
pending BBC6 metadata records under a critical section, never logging or allocating
there. The loop drains one text record per iteration. Disconnect invalidates the
source and clears queued records. Short/oversized/malformed status packets are
ignored; CRC, exact framing, duration units and natural EOF are unverified. No
notification can release a motor lock, shorten playback or claim physical success.

The separate browser USB tools retain at most 2 MiB of original UART bytes with
an explicit discarded count, close reader/writer locks and offer text/binary/summary
downloads. No port opens automatically. The fixed-profile installer verifies
package metadata and SHA-256 before offering pinned ESP Web Tools; it does not
compile custom source. See [USB tools](usb-tools.md) for lifecycle and evidence.


## Optional audio-scene ownership

`EYE_JAW_MODE == 3` is an opt-in extension in the existing bounded word layout.
Browser validation, static guards and runtime validation require body protection,
no delayed motor follow-up and post-playback light restoration. Ordinary legacy
modes are unchanged. Universal HELLO adds `audioScenes=1`; the browser blocks new
mode saves to older firmware. No Wi-Fi, new NVS layout or new wire command is added.

The audio start anchors all motor locks after the BLE call returns, for the padded
clip estimate plus the longest conservative motor cooldown. A separate transient
hold suppresses every ordinary actuator path and survives a brief reconnect in the
same boot. USB remains serviced; pending settings cannot bypass active locks.
Normal appearance restoration and due requests resume afterward. This models an
exclusive window, never natural EOF or physical movement completion.

The separate browser `audio.js` BLE session handles prepared MP3 uploads and per-file
metadata with bounded CRC/structure checks, one operation at a time and fresh file
identity/read-back. It never starts playback, deletes files or overwrites names.
`audio-ui.js` keeps radio preparation out of ordinary controls and prevents starting
it with an open USB port; USB also refuses connection while direct BLE is active.
See [audio scenes and physical verification limits](audio-scenes.md).

## October 24 read-only status and Studio preparation

Release 2026.10.24-preview.1 ports only PR #35's USB diagnostics. Firmware/build, modeled wait, remaining protection and last accepted-write age are numeric STATUS additions. A 640-byte bounded text buffer retains the full worst-case line. The idle-break helper reads existing state; no timers, actions, locks, scene behavior or NVS layout change. Audio hold has its own estimated reason. No wireless-status server is included. Older numeric parsers accept additional fields.

Audio preparation decodes/resamples locally and lazily loads the pinned local encoder. Computer preview requires Play. Optional descriptive audio metadata survives browser profile/scene validation but never enters runtime encoding. Fresh known file mismatches block saves without automatically remapping serials. The scene comparison reads saved scenes only.

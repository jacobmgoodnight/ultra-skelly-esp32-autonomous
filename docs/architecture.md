# Controller architecture

The canonical Arduino sketch runs one cooperative loop on an original ESP32-WROOM
using Arduino-ESP32 3.3.12's BLE library. Studio is a static HTML/CSS/JavaScript
application that embeds this sketch and replaces validated constants plus several
optional scheduling blocks. It downloads one self-contained `.ino`. No backend,
Wi-Fi, or ongoing browser connection is involved.

`scripts/sync-template.cjs` generates `studio/template.js` from the canonical sketch,
normalizing line endings. CI rejects drift. `replaceOnce` in `studio/app.js` rejects
missing/duplicate substitution anchors. Idle breaks, file pools, permitted eye
sets, and the independent head/jaw overlap option are generator extensions; their
substitution architecture is still a maintenance risk and is covered by the
generated compile matrix. The five-minute UI timeline is illustrative and does
not reproduce the firmware's full lock/follow-up/lighting arbitration.

## Connection lifecycle

`scanAndConnect` deletes the previous advertisement, clears scan results, and
performs a blocking five-second scan. The scan callback copies the matching
advertisement and stops scanning; connection starts only after scanning returns
and a 500 ms settling delay. Misses and failed connections retry after 30 seconds.
One BLE client is reused, with fresh AE00/AE01 service/characteristic lookup on
each connection. The pinned Bluedroid client clears its services when rediscovering
them (`BLEClient::getServices`). Repeated-cycle heap stability still needs testing.

`resetConnection` invalidates the writer, disconnects if needed, cancels eye,
jaw-follow-up, modeled-end, and light work. Reconnection starts fresh randomized
movement targets and a lighting initialization sequence after 1.5 seconds. It
does not replay a failed body/MP3 command immediately. One-shot jaw-first trials
are intentionally eligible again on each connection. This can matter if the
prop continues a physical animation while its BLE link drops: physical state
cannot currently be recovered from the prop.

## Movement and jaw scheduling

Independent body scheduling chooses the most overdue eligible head, arm, or torso.
Each motor has a due time and cooldown; a shared lock serializes body commands by
default, with 600 ms between body writes. An advanced overlap option bypasses the
shared lock, preserving per-motor cooldowns. Head uses 25+7 s, arm 22+10 s, torso
25+10 s. These are conservative models, not completion telemetry.

Compound mode suppresses independent body scheduling and sends one randomly
selected allowed mask. It validates selected motors and holds the shared lock
until the longest selected animation plus buffer ends. Studio rejects compound
mode with jaw-first follow-ups and requires MP3 body protection when jaw is ON.
Directly edited firmware does not duplicate every Studio validation constraint.

`startMouth` sends AAC6 for the device-specific stored file serial. Default MP3
protection waits for all body cooldowns and suppresses standalone body starts
while jaw playback is due or modeled active. Jaw-first arm/torso follow-ups are
explicit exceptions: at most one enabled eligible motor starts after the delay,
respecting its cooldown and shared lock. Recurrence gates eligibility by that
motor's own due time; alternating mode prefers the previously unselected motor
when both are due. Jaw-first HEAD remains a failed physical diagnostic.

Playback may restore stored movement flags, eyes, and lights. The current client
does not subscribe to AE02. `mouthPlayingUntil` is **modeled** from `MOUTH_CLIP_MS`
(21 s), beginning after the write call returns. All pooled clips must fit that
duration or the constant must be increased conservatively. There is no playback
completion confirmation.

## Eyes and lights

Eyes use AAF9, an optional independent random schedule and delayed start/end
corrections around the modeled MP3. Corrections are separate from motor commands.

Lights use six spaced requests: torso F2/F3/F4, then head F2/F3/F4. F2 lengths are
11/12 bytes for channel 0/1; F3 is 11 bytes; F4 is 13 bytes. CRC covers every byte
before the final CRC. Initial live colors and MP3 overriding them were physically
observed. Post-MP3 restoration has not yet been visually confirmed.

Restore mode 0 initializes only. Mode 1 discards an unfinished older light
sequence on MP3 start and schedules a complete sequence at modeled end +500 ms,
then a 100 ms queue delay. Mode 2 also queues a full sequence three seconds after
MP3 start. A final restore replaces any unfinished during-playback sequence.
The next MP3 waits for pending restoration and the complete six-write sequence.
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
that range; stale inactive-motor cooldown timestamps are a long-run audit item.


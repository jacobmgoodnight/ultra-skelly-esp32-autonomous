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
generated compile matrix. The five-minute UI timeline shows example requested
intervals, without pretending to arbitrate actual starts. Contextual feedback
explains locks, jaw-first follow-ups, restoration, rest and optional clock windows.

## Connection lifecycle

`scanAndConnect` deletes the previous advertisement, clears scan results, and
performs a blocking five-second scan. The scan callback copies the matching
advertisement and stops scanning; connection starts only after scanning returns
and a 500 ms settling delay. Misses and failed connections retry after 30 seconds.
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

Independent body scheduling chooses the most overdue eligible head, arm, or torso.
Each motor has a due time and cooldown, now anchored after a successful BLE call
returns so call latency cannot consume the cooldown. A shared lock serializes body commands by
default, with 600 ms between body writes. An advanced overlap option bypasses the
shared lock, preserving per-motor cooldowns. Head uses 25+7 s, arm 22+10 s, torso
25+10 s. These are conservative models, not completion telemetry.

Compound mode suppresses independent body scheduling and sends one randomly
selected allowed mask. It validates selected motors and holds the shared lock
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

Eyes use AAF9, an optional independent random schedule and delayed start/end
corrections around the modeled MP3. Corrections are separate from motor commands.

Lights use six spaced requests: torso F2/F3/F4, then head F2/F3/F4. F2 lengths are
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
only bounded HELLO/TIME lines; no serial command starts a motor or changes a
configuration. Clock windows default OFF. Enabled windows fail closed after every
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


# Prioritized development roadmap

## P0 — Finish the lighting/serial diagnosis

The first reliability PR honors BLE write failures, records reset/heap/write/queue
diagnostics, cancels stale partial restoration, and prevents a new MP3 from
preempting the complete restore. It does **not** establish physical recovery or
the cause of serial corruption. Run [the isolated test](testing.md) first.

1. Capture three jaw/lighting cycles with timestamps, an unedited serial log and
   visual timings. Determine whether colors return, which LEDs channel 1 controls,
   and whether any BOOT/reset/heap/write-failure evidence accompanies corruption.
2. Investigate AE02 playback notifications independently: upstream parses BBC6
   file serial, playing flag and duration. Confirm CRC/frame length, whether stop
   is unsolicited at natural EOF, duplicate/out-of-order behavior, and device
   differences. Only then design bounded callback-to-loop handoff plus a duration
   fallback. Keep motor protection conservative if a notification is absent/early.
3. Exercise repeated Skelly power cycles with heap diagnostics; verify reused
   client/service cleanup, canceled pending jobs, delayed restart targets and no
   unintended repeat movement. A disconnect loses physical animation knowledge.

## P1 — Scheduler correctness and endurance

Add executable compound/jaw arbitration tests (not just output regexes), including
frequent jaw playback starving compound movements, permitted motor masks, longest
cooldown, recurrence fairness, reconnect while moving, and disabled motors. Audit
stale timestamps beyond the signed half-range (~24.9 days): inactive cooldowns
initialized once can eventually compare as future deadlines. Test both wrap and
multi-week idle conditions before changing the timing representation.

Keep proven jaw-first and compound modes separate. Run a supervised recurring
compound test at 180–360 s only after isolated light testing; log physical duration
and completion, then extend endurance gradually.

## P2 — Lighting capabilities

After static restoration is visually reliable, test channel mapping and independent
enablement. Then evaluate upstream F2 strobe/pulse, F6 speed, presets, rotation and
per-file overrides. New experimental features default OFF.

## P3 — Studio architecture and usability

Template generation/CI drift enforcement is in the first PR. Next consolidate
configuration metadata and validation without rewriting the proven controller.
Replace fragile generator injections incrementally with compatibility tests.
Correct the illustrative timeline before presenting it as an accurate simulator
(it omits jaw-first, compound cooldown arbitration and lighting delays). Add
versioned local profiles, JSON import/export, metadata and mobile improvements.

## P4 — Additional animation experiments

After reliability and field evidence, evaluate personalities, weighted movement
selection, rare full-body events and offline time-of-day schedules. Keep free
static hosting and autonomous operation.


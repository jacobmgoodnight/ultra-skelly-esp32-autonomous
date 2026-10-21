# Prioritized development roadmap

## P0 — Finish the lighting/serial diagnosis

The first reliability PR honors BLE write failures, records reset/heap/write/queue
diagnostics, cancels stale partial restoration, and prevents a new MP3 from
preempting the complete restore. On October 21 the user confirmed mode 1 returns
both chosen colors after MP3 #13 in the isolated jaw/lighting setup. The cause of
serial corruption remains unknown; mode 2 and motor integration remain unverified.

1. Isolate the persistent serial corruption using the comparison procedure in
   [the testing guide](testing.md). Corruption persists in the lighting-OFF
   three-clip log, without reported write failures or mid-session reconnects and
   with steady connected heap. The [serial-only idle test](serial-idle-test.md)
   subsequently passed all four cycles cleanly. Compare the unchanged jaw sketch
   in a second terminal next. Affected controller lines contain exactly 64 Unicode replacement characters. Obtain original byte
   capture before assigning a UART/USB/monitor cause. Exact head LED mapping and
   physical restoration timing are still not independently measured.
2. Investigate AE02 playback notifications independently: upstream parses BBC6
   file serial, playing flag and duration. Confirm CRC/frame length, whether stop
   is unsolicited at natural EOF, duplicate/out-of-order behavior, and device
   differences. Only then design bounded callback-to-loop handoff plus a duration
   fallback. Keep motor protection conservative if a notification is absent/early.
3. Exercise repeated Skelly power cycles with heap diagnostics; verify reused
   client/service cleanup, canceled pending jobs, delayed restart targets and no
   unintended repeat movement. A disconnect loses physical animation knowledge.
   The pinned Bluedroid `getService` can reuse its service cache across reconnects;
   investigate explicit rediscovery with failure/reconnect tests before changing
   that lifecycle. Do not describe the current lookup as forced fresh discovery.

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

The first usability pass adds progressive disclosure, named jaw-clip selection,
and validated JSON profiles. See [Studio's next steps](studio-roadmap.md) for the
prioritized remaining hardware tests and staged browser USB upload proposal.

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


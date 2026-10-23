# Prioritized development roadmap

## October 23 conservative release decision

Prioritize the existing scene reliability observations, helpful bounded status,
guided device-specific jaw preparation and a small portable personality collection.
The [release result sheet](conservative-release-checklist.md) records the remaining
hardware checks without repeating confirmed USB or lighting behavior. Profiles
reuse current formats; no scene rebuild or scheduling-policy change is introduced.

PIR/Hybrid is deferred until a sensor is available, with no firmware hooks or Studio
controls. Weighted/global scheduling, contextual sequences, direct metadata reads,
continuous Wi-Fi and dedicated mobile apps remain deferred. The only new radio
work is a separately generated, disabled-by-default [read-only status experiment](wireless-status-experiment.md).
Wireless configuration requires a later reliability gate and security review.
Older priorities below are historical context, not permission to expand this release.

October 21 follow-up: guided setup/scheduling feedback, bounded original-byte USB
capture, the fixed-profile installer build path, optional fair turns, per-file
clip estimates, passive playback observations and USB-set weekday/time windows
are now implemented in software. Hardware checks are prepared, not performed.
See [implementation status](implementation-progress.md).

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
   The new opt-in passive queue collects bounded metadata without acting on it;
   CRC/framing, duration units and natural EOF still need physical evidence.
3. Exercise repeated Skelly power cycles with heap diagnostics; verify reused
   client/service cleanup, canceled pending jobs, delayed restart targets and no
   unintended repeat movement. A disconnect loses physical animation knowledge.
   The audit follow-up now forces service rediscovery with missing-service,
   missing-characteristic and disconnect tests. Repeated physical reconnect/heap
   validation remains pending; see [attended regression](audit-follow-up.md).

## P1 — Scheduler correctness and endurance

The audit follow-up adds executable all-mask compound/cooldown/jaw protection,
write-latency, reconnect-failure, jaw-pool selection and 60-day/wrap tests. Elapsed
cooldowns are retired during loop service; body timers begin after BLE calls
return. These are software corrections, pending attended regression.
Remaining work includes frequent jaw playback starving compound movements,
recurrence fairness, disconnect during physical movement, and broader fault and
random-sequence coverage. Preserve physical evidence limits.

The opt-in fair-turn policy now has executable contention tests with restoration
and coarse loop service. It preserves cooldowns and existing default jaw priority;
its remaining gate is physical integration, not another speculative policy rewrite.

Keep proven jaw-first and compound modes separate. Run a supervised recurring
compound test at 180–360 s only after isolated light testing; log physical duration
and completion, then extend endurance gradually.

## P2 — Lighting capabilities

The October 22 branch implements opt-in palette rotation and per-channel
Static/Strobe/Pulsing with speed. The remaining gate is physical verification;
use the [focused checklist](studio-lighting-checklist.md). Static defaults and
the original six-packet path remain. These effects must not be described as
hardware-verified.

The upstream
[Ultra Skelly device profile](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/constants.js)
lists Static (1), Strobe (2), and Pulsing (3), separately for torso/head channels.
Live [F2/F6 handlers](https://github.com/martinecker/SkellyUltraWebController/blob/main/app-modular.js)
and the upstream [speed conversion](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/protocol.js)
provide the protocol reference, rather than physical evidence on this controller.

Next confirm channel mapping, both dynamic modes, speed response, complete palette
pairs and integration with restoration/motors. True lights-out scheduling,
independent channel enablement and per-file overrides remain separate work.

## P3 — Studio architecture and usability

The first usability pass adds progressive disclosure, named jaw-clip selection,
and validated JSON profiles. See [Studio's next steps](studio-roadmap.md) for the
prioritized remaining hardware tests and staged browser USB upload proposal.

Template generation/CI drift enforcement is in the first PR. Next consolidate
configuration metadata and validation without rewriting the proven controller.
Replace fragile generator injections incrementally with compatibility tests.
The timeline now explicitly shows requested intervals, with contextual delay
feedback instead of an incomplete arbitration simulation. Profiles remain
versioned JSON with backward-compatible safe defaults for the new controls.
USB capture and a fixed-profile installer are implemented; persistent settings
over USB without recompilation remain a separate firmware migration.

## P4 — Additional animation experiments

Watchful and Storyteller add conservative starting points. Optional offline
weekday/time windows now pause after boot until USB time is set. After reliability
and field evidence, evaluate weighted movement selection and rare full-body events. Keep free
static hosting and autonomous operation.


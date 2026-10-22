# Requested improvements: implementation and evidence

October 21, 2026. Work builds on audit PR #25. The owner requested the full
improvement list, selected USB-set local time with pause after power loss, and
reported that hardware is unavailable. No upload, firmware deployment, physical
regression or serial root-cause finding is claimed. New firmware marker:
**usb-scheduler-v3**. Experimental firmware switches remain OFF by default.

| Requested work | Implemented now | Remaining evidence/work |
| --- | --- | --- |
| Validate the new firmware on the prop | Focused integration, reconnect and extension test criteria prepared in [next attended tests](next-attended-tests.md); existing short packs retained | Physical observation is pending because the prop/board is unavailable. Earlier physical results do not transfer automatically to this revision. |
| Diagnose garbled serial output | Browser original-byte/text/summary capture, explicit port lifecycle, bounded storage and a separate-terminal Python raw capture command | Capture the unchanged affected sketch in a second terminal. No UART/BLE/audio/power/monitor cause or fix is established. |
| Improve scheduling feedback | First-run head-only action, contextual delay explanations, request-only illustration with no false arbitration claims, Watchful and Storyteller starting points | Real starts still depend on locks, playback, breaks, the link and optional clock window. This is not a physical simulator. |
| Handle fairness | Opt-in fair body turns preserve cooldowns and default jaw priority; host tests cover a restoration/coarse-loop starvation scenario, standalone and compound modes, normal time and wrap | Physical integration is untested. No guarantee that every target fires at its exact requested interval. |
| Guided first-run workflow | Explicit 6.5-foot/original-WROOM requirement, 120–240-second head-only setup, upload steps and then own-device clip mapping | A real demonstration and another-device setup report remain valuable. No assumed universal clip numbers or 12-foot compatibility. |
| Browser USB conveniences | Local capture, explicit HELLO/TIME controls, fixed-profile package verification and a pinned browser installer; Actions builds versioned, hashed head-only artifacts | No real USB capture or flashing occurred. Custom settings still need compilation; USB-persistent settings would be a separate migration. |
| Playback flexibility/research | Conservative fallback and per-file estimates for selected pool files, 21–120 seconds; opt-in bounded passive AE02 metadata queue with disconnect cleanup | CRC/framing, duration units and natural EOF are unverified. Notifications never shorten protection or confirm physical completion. Actual playback-end control remains deferred until that evidence exists. |
| Offline clock schedule | Optional weekday/local-time window, including overnight start-day ownership, invalid after every boot until USB time is supplied; fresh interval targets on opening | No battery RTC, automatic DST adjustment or retained time across restart. Existing motion/restoration can finish after closing; no physical stop is sent. |

## Important implementation decisions

- Preserve the default 21-second estimate, body cooldowns, protected head/jaw,
  independent optional eyes and separately selectable jaw-first/compound modes.
  HEAD after jaw remains failed at both tested delays.
- A per-file estimate follows the actual selected pool serial. Missing estimates
  use the fallback; malformed, duplicated or unselected entries fail generation.
- Clock checks refresh uptime at each new motor/jaw request, not only loop entry.
  A slow BLE call that crosses closing time cannot authorize a subsequent request.
  Overnight windows belong to their starting weekday; invalid time never opens one.
- Passive notification callbacks allocate/log nothing, copy bounded numeric
  metadata under a critical section, and never touch motor or playback timers.
- Capture retains the first 2 MiB, reports discarded bytes, flushes partial UTF-8
  on EOF and preserves original bytes separately. No port opens without a click.
- Installer packages identify the full source commit and source/binary SHA-256.
  A checksum detects corruption/mixing, not publisher authenticity. Only the
  fixed head-only image and ESP32 family are offered, with explicit overwrite
  consent. The optional installer loads ESP Web Tools **10.2.1** from unpkg;
  configuration and capture work without that CDN.
- New settings files use version 2, so older Studio rejects them instead of
  silently dropping longer clip estimates or clock protection. Version-1 files
  import with safe defaults only for newly added fields. Existing fields retain
  strict validation. Generator anchors
  still fail closed; the canonical sketch generates the embedded template.

## Validation

- Baseline: 38 Node tests and canonical/template check passed before editing.
- Current Node tests: **50 passing**, including first-run setup, old-profile
  compatibility, new configuration rejection, original bytes/UTF-8, stream cleanup,
  canceled port selection, unplug handling and installer image/hash rejection.
- Native: **30 C++ executables and two expected compile rejections** pass with
  MSVC C++17. Added cases cover contention with preserved locks, passive queue
  overflow/cleanup, per-file timing, no-time pause, malformed USB input, clock
  wrap, overnight boundaries, fresh window-entry targets and blocking writes
  crossing closing time. These execute firmware functions with mocked I/O.
- Python package test passes using synthetic test data, not a flashable artifact.
- CRC vectors, template synchronization and local asset versions pass.
- ESP32: full pinned **3.3.12** matrix is in progress. It includes canonical,
  32 generated settings, four isolated diagnostics, 11 attended, seven quick and
  the fixed head-only installer profile. Each compiled source hash is recorded
  under `.skelly-build/validation/results.json`.
- Browser: local Studio first-run action and advanced controls load; Studio and
  USB pages fit a 390-pixel viewport without horizontal overflow. No hardware
  port was opened. The pinned installer module URL is reachable; flashing is not tested.

## What still cannot be called finished

Physical regression/endurance, the serial root cause, actual playback-end control,
new lighting-effect protocols and USB-persistent settings need further evidence or
their own implementation. Existing RGB modes and the failed jaw-first HEAD path
have not been relabeled. Launch readiness remains a **7/10 hobby preview** while
new firmware behavior is software-only. This pass prepares the feasible software
and diagnostic tools; it does not manufacture hardware results.

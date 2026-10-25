# Product refinement assessment — October 24, 2026

Reviewed main `36cb838aef55de19c36f3e23276ad2d033b98c29` after fetching origin.
The initial local checkout had the same file tree. This assessment covers the
canonical firmware, Studio generator/presets, installer, USB/scene/status/audio
modules, tests, workflows, setup/recovery docs and current hardware matrix.

## Executive assessment

The core product path already exists: browser installation, personality selection,
explicit USB save and read-back, then autonomous operation. Most suggested features
would duplicate working controls or expand unverified firmware behavior. The best
return now is precise update/backup guidance and closing a few hardware evidence
gaps. Keep the existing UI structure and conservative scheduling.

The project has unusually extensive software coverage for this scope. Its main
release limitation is physical validation of browser flashing, saved-program
retention, scene transitions and recent reconnect/audio integration. Passing
software tests cannot close those gaps. No stable release or deployment is part
of this change.

## Prioritized decisions

Ratings describe each proposed action, not the entire existing subsystem.

| Priority / improvement | User benefit | Effort | Regression risk | Added UI complexity | Maintenance | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Accurate installed revision/build comparison | Medium | Low | Low | None | Low | Implement: require both values for current; missing build is unknown, not automatically older |
| 1. Explain browser backup vs controller backup and complete restore | High | Low | Low | None | Low | Simplify existing functionality: clarify sequence and link existing installer guidance |
| 1. Attended browser install, restore and power-cycle retention | High | Medium | Low | None | Low | Investigate further using existing checklist; no software pass substituted |
| 2. Observe ordered/random scene transitions and reconnect recovery | High | Medium | Medium | None | Low | Investigate further before changing timing; retain current protections |
| 2. Raw-byte comparison for intermittent serial corruption | Medium | Medium | Low | None | Low | Investigate further with existing capture tools; no speculative UART/packet fix |
| 2. Guided first-run wizard | Low | Medium | Medium | Medium | Medium | Skip: existing Connect / Install / Configure path, status and retry already cover it |
| 2. Automatic backup, migration and rollback manager | Medium | High | High | Medium | High | Defer: explicit JSON export/import and reviewed local packages suffice for now |
| 2. Additional update polling/service | Low | Medium | Medium | Low | Medium | Skip: installed identity and bundled release comparison already exist; no cloud needed |
| 3. Live motor testing | Medium | High | High | Medium | High | Defer: needs arbitration with autonomous work, cooldowns and restoration; no bypass commands |
| 3. Live eye/light test button | Medium | Medium | Medium | Low | Medium | Defer: no corresponding USB actuator protocol; use existing attended eye/light sketches |
| 3. New natural-behavior modes or eye/head coupling | Low | Medium | Medium | Medium | Medium | Skip: random intervals, presets, rest periods, palettes and scenes already provide variety |
| 3. Notification-driven audio completion | Medium | High | High | None | High | Investigate further passively; do not shorten padded playback/motor protection |
| 3. More audio UI | Low | Medium | Medium | Medium | Medium | Skip: conversion, preview, file labels and mismatch guards already exist under Advanced |
| 3. Accessibility/mobile redesign | Low | High | Medium | Medium | High | Defer broad redesign: existing responsive rules, focus indicators and reduced-motion support; a keyboard/screen-reader usability pass is more useful |
| 3. Dependency/Actions pin hardening | Medium | Medium | Low | None | Medium | Investigate further as a separate maintenance PR; verify versions/provenance before updates |
| 3. Split large generator/firmware files | Low | High | High | None | High | Defer: fail-closed anchors, template checks and compile matrix currently constrain risk |
| 3. New release infrastructure or stable label | Low | High | Medium | Low | High | Skip: versioned packages, hash manifests, CI and free Pages deployment already exist; hardware gates remain |

## Findings behind the decisions

**Installation and updates.** `installer.js` already checks bounded downloads,
same-origin catalog paths, model, core, release identity, image headers and SHA-256.
It requires overwrite consent and explicit USB selection. Unsupported browser and
chip guidance, port-busy recovery, BOOT/EN instructions and local-package/Arduino
fallbacks are present. Exact module/flash capacity still require a board check.
The full image resets saved settings; it is not an in-place settings-preserving
update. No new detector or flashing dependency is justified by this review.

`release.js` compared revisions when deciding whether an update exists, but its
current-release label tested only build equality. A newer revision with the same
build could therefore appear current. Missing build on the current revision was
also treated as build zero and presented as an update. The fix distinguishes a
matching pair, an older identity, a different identity and incomplete evidence.
The comparison describes this Studio release, not a live online latest-version
service or proof of hardware compatibility.

**Settings safety.** `controller.js` verifies CRC and decodes/validates reads;
`scenes.js` previews replacement of a nonempty browser library. Declining that
preview preserves the browser library, so a subsequent Export scenes exports the
browser library rather than the controller read. Accepting can replace browser
labels and settings. The installer now instructs users to preserve browser work
first, then accept the read preview and export a separate controller backup.
The detailed guide restores the complete collection using Save scene collection;
Save this routine alone would replace it with one editor scene. No format or
storage changes are needed.

**Guidance and accessibility.** USB Ready, Bluetooth connection, modeled wait
reason, snapshot age and read-back result already have distinct purposes. Manual
operations cancel background polling; hidden pages suspend it. The page has
explicit labels/live statuses, focus styles, responsive layouts and reduced-motion
rules. Source inspection and DOM tests are not a screen-reader certification or a
full real-browser/mobile usability result. No additional dashboard or wizard is
introduced.

**Behavior and Bluetooth.** Name-based scanning finishes before connecting; the
client is reused and service discovery refreshes its cache. Failed writes clear
queued work without immediate actuator replay. Existing native tests cover timing
wrap, long simulated operation, failed discovery, pending settings and disconnect.
Physical repeated-power-cycle recovery and heap endurance remain separate.
Reconnect cannot reconstruct ongoing prop motion. Investigate that with an
attended test before changing reconnect timing or claiming a reliability fix.
Head, jaw-first follow-ups and compound commands retain distinct protections.
No new traffic, logging, flash writes, settings or cooldown changes are warranted.

**Audio.** AE02 handling is bounded and opt-in; observations do not control timers.
Per-file estimates and conservative settling already exist. Natural EOF semantics,
stored motor effects and full restoration need physical evidence. Isolated mode-1
RGB restoration is owner-verified; mode 2, eye restoration and newer audio-scene
integration are not thereby verified. Audio stays optional and collapsed.

**Maintainability and release.** CI checks template/schema/assets, browser behavior,
native firmware, CRC/packages and the pinned full compile matrix. Packaging builds
PR artifacts; Pages deploys only after a successful main smoke run and checks the
source SHA. Browser installer library is version-pinned; the bundled encoder has
provenance/hash tests. Actions still use major-version tags and the installer uses
a CDN import. These warrant a separate supply-chain review, not an unverified
dependency upgrade or a claim that a vulnerability audit was completed. Existing
contribution and issue templates already collect reproduction information.

## Implemented scope and validation

Only firmware identity presentation, installer backup wording, its existing
documentation and content-based asset URLs change. Firmware, USB protocol,
generator substitutions, profile/scene formats, dependencies and workflows do not.
Regression coverage exercises exact/older/newer/missing revision/build combinations
and stale presentation. Detailed run results are recorded in the accompanying PR.

No USB port was opened and no firmware was flashed. This work adds **Software-only**
evidence. Existing **Verified**, **Failed** and **Untested** hardware classifications
remain as recorded in [the matrix](hardware-verification.md). The matrix's later
owner report confirms recurring compound use, while new interleaving remains
unconfirmed; historical pending statements are not new failures or new passes.

## Next three priorities

1. Run the [browser install/update checklist](browser-installation.md), preserving
   separate browser/controller exports. Pass: observed completed flash, matching
   revision/build, restored collection read-back, retained settings after restart
   and separately observed safe movement. Stop on unexpected movement/reset.
2. Run the [retention and scene result sheet](next-release-checklist.md) and a
   controlled prop power-cycle/reconnect observation. Record actual starts,
   completion, recovery and heap/log behavior separately; do not infer completion
   from accepted BLE writes. Fix only reproducible failures.
3. If serial corruption recurs, follow [the existing isolation plan](testing.md)
   with original bytes and one changed variable. Keep audio EOF research passive
   and optional rather than making it a prerequisite for ordinary movement.

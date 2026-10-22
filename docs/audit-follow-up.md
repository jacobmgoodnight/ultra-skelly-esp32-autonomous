# Audit follow-up: timing, reconnects and launch positioning

October 21, 2026. This report records the local validation before publication
approval. The owner subsequently authorized updating GitHub; the reviewed changes
are being submitted on a review branch, with no merge or firmware deployment.
No new physical observation is claimed. The [initial audit](launch-review.md) retains
its original findings/results for chronology; this document records the follow-up.

## Software changes

1. **Inactive cooldowns:** elapsed safety/model-end/spacing deadlines are retired
   during connected loop service. Future deadlines, per-motor durations and
   overdue movement targets are preserved. This prevents an inactive timestamp
   from becoming a future lock after the signed half-range (~24.9 days). The loop
   must still be serviced normally; this is not recovery from a weeks-long stall.
2. **Blocking writes:** standalone head, arm, torso and compound timers now start
   after an accepted BLE call returns. A slow call cannot consume the configured
   animation/buffer or following body-write spacing. Jaw already used that basis.
3. **Reconnect cache:** the application writer is cleared before explicit
   `getServices` on every connection. Pinned Bluedroid clears its cached services
   in that method. Empty discovery, missing AE00/AE01 or disconnect rejects the
   connection and cancels pending jobs. This does not promise real RF recovery
   or heap stability; those require observation.
4. **Direct-edit constraints:** compile-time assertions reject compound mode with
   jaw-first follow-ups, and compound + configured jaw without body protection.
   Studio already rejected these combinations. Defaults and mode choices remain.
5. **Behavioral coverage:** canonical and generated C++ tests cover post-write
   head/arm/torso cooldowns, protected jaw dispatch at the boundary, 60 simulated
   days and wrap, reconnect failures, every compound mask/longest cooldown and
   all three jaw-pool selections. Test-only random choices can now be queued.

The canonical sketch remains the source of truth; `studio/template.js` was
regenerated and the HTML asset versions refreshed. No packet format, selected
motor, conservative duration, default enable, failed HEAD-after-jaw status or
physical evidence classification was loosened. The boot marker is
`audit-timing-v2` so logs can identify this revision.

## Positioning and owner demand

The README now leads with custom autonomous routines and a head-only example at
120–240-second intervals. The description and all three Reddit drafts emphasize
customizable recurring schedules rather than merely replacing a connected phone.
**Interval schedules are implemented; clock/calendar schedules are not.**

[Community demand research](community-demand.md) records a matching Reddit
complaint, historical DecorPro reviews, two related GitHub feature requests and
the supplied YouTube screenshot. It distinguishes exact matches from broader
requests this single-prop controller does not fulfill. The screenshot appears
to feature the 12-foot model; compatibility remains limited to the tested
6.5-foot Ultra Skelly v2. No external replies or metadata updates were sent.

## Attended regression for this new firmware

This is a focused regression, not a demand to repeat completed isolated discoveries.
Use a stable prop with clear joints, original ESP32-WROOM, core **3.3.12**, Serial
Monitor **115200**, Core Debug Level None. Keep a copy of the working firmware.

1. Export the existing short pack with `node scripts/export-attended-tests.cjs --quick`.
   Use **Quick06_MotorsLights** for about four minutes after connection: head 60 s,
   arm/torso 90 s, jaw 45 s, protected alternating follow-ups and mode-1 colors;
   eyes and compound OFF. Use your own confirmed jaw file serial and saved body
   flags **0x00**, not another prop's #13 by assumption.
2. Observe complete standalone head action, the normal jaw, and any due arm/torso
   follow-up. Pass means expected animations finish, the jaw continues during
   the selected arm/torso action, chosen colors return after playback, and no
   unrequested motor, interruption, reset or failed write appears. If a motor has
   not become due, report that observation as incomplete rather than infer a pass.
3. For reconnects, use **Test08_Reconnect** with body motors/eyes OFF and your
   confirmed clip. Turn only the prop off for 30 seconds, then back on in Bluetooth
   mode; wait for recovery and a complete clip/restore. Repeat three times without
   resetting the ESP32. Pass means expected colors/playback resume with no stale
   command replay, unexpected movement or trend of falling post-connection heap.
   Record misses/retries separately; a short three-cycle pass is not endurance proof.
4. Compound mode remains a separate optional check: **Quick09_Compound**, no jaw,
   eyes or lights, about three minutes. Compare selected masks to visible action
   and full completion. A random sample may not cover every mask; don't invent
   coverage. Individual masks already worked; this checks the new firmware path.

Stop for unexpected movement/binding, interrupted playback or resets. Preserve
garbled serial bytes if possible and report corruption separately; this change
does **not** fix the unresolved serial issue. Accepted BLE writes never count as
physical movement/color confirmation. No upload or attended test was performed
by this software review.

## Remaining work

Launch readiness remains **7/10 for a clearly labeled hobby preview**. The fixes
and stronger tests improve software confidence, but this revision still needs an
attended hardware regression. One-prop evidence, unresolved serial corruption
and unverified endurance limit a broader reliability claim.

- Physical regression/heap/endurance checks above.
- Intermittent serial corruption: same-sketch second-terminal original-byte capture.
- Playback-end notifications/per-file duration handling: still a separate protocol
  investigation; keep the conservative 21-second model for supported clips.
- Eye recovery, mode-2 lighting and broad combined routines: existing unverified
  hardware behavior remains labeled accordingly.
- Compound/body fairness at aggressive jaw intervals: test and decide policy
  before changing motor priority. There is no promise that every target fires
  at its exact requested time.
- SDK upgrades, all-history privacy cleanup, durable release MP3 assets and
  future clock/calendar scheduling require their own reviewed work.

## Validation

- **PASS:** JavaScript syntax, all **38 Node tests**, packet CRC vectors,
  canonical/template synchronization and Studio asset version checks.
- **PASS:** **27 native C++ executables** with MSVC C++17, including canonical
  and generated restore modes, two scheduler fixtures, the serial diagnostic
  and 18 attended/quick fixtures. **Two additional negative compile checks**
  reject the incompatible compound/jaw configurations.
- **PASS:** the updated source ZIP extraction passes all 38 Node tests and the
  template/asset checks without Git metadata or application packages. This is
  the same computer/toolchain, not an independent-machine or physical test.
- **PASS:** 97 local documentation/HTML targets across 28 documents resolve;
  current-tree heuristic credential/address checks found no matches in 70 files.
  These checks do not establish all-history privacy or absence of every secret.
- **PASS:** all **50 Arduino-ESP32 3.3.12 builds**: canonical firmware, 27 generated
  matrix configurations, four isolated diagnostics, 11 attended and seven quick
  sketches. Each source was compiled in a fixed scratch sketch with cached
  libraries. Source hashes and results are saved in ignored
  `.skelly-build/followup-compile-results.json`.
- **PASS:** `git diff --check`; no whitespace errors.
- **NOT PERFORMED during local validation:** firmware upload, physical regression,
  remote CI, publication or external posting. Earlier hardware observations retain
  their original scope; subsequent GitHub checks are recorded on the pull request.

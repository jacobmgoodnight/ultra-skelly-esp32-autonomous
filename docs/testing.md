# Reproducible testing and the next on-device test

For the October 22 UI/palette/effects changes, start with the shorter
[Studio refresh checklist](studio-lighting-checklist.md). The owner now confirms
lighting effects and palette rotation work; integration and exact speed/channel
coverage remain scoped to the observations actually reported.

The October 21 jaw/mix/break/reconnect reports are recorded in the
[experiment log](experiments.md). No completed test needs repetition before
Studio improvements. Remaining checks are optional; use the
[short spot-check pack](attended-test-pack.md) for 90-second eye/light checks and
four-minute combined-routine checks. Longer windows below are references for
endurance work, not a mandatory checklist.

The timing/reconnect changes use boot marker **audit-timing-v2**. Their new
software evidence and focused attended pass/fail checks are in
[audit follow-up](audit-follow-up.md). Existing physical results do not establish
that this newly changed firmware has passed its hardware regression.

## Automated checks

The [scene-builder checklist](studio-scene-builder-checklist.md) covers the latest
browser refresh. Model/DOM tests exercise explicit CRUD and atomic validation,
selection through reorder/delete/Undo, draft recovery and invalid/storage failure
paths, asynchronous confirmation/cancellation, controller snapshot comparison and
longer illustrative preview windows. The three complete look configurations are
included in the full generated ESP32 compile matrix. These are software checks;
they do not establish physical scene transitions or integration results.

USB settings/scene software coverage and a separate future attended procedure are
in [USB settings and scenes](usb-settings-scenes.md). Continue the current Studio
refresh checklist first; no new physical result is implied by these checks.
The October 23 owner report confirms browser connection/read/save and physically
observed changed behavior; retention/recovery and scene transitions remain separate.
Controller-state and DOM-adapter tests mock serial replies, timers and visibility
to cover polling cancellation, late replies, stale status, disconnect cleanup,
manual-operation exclusivity, shared-port controls, incompatible/unsupported
recovery, replacement consent and read-back failure. These tests open no hardware
port and establish software behavior only.
The native runtime-offline case services the real loop across the 24.9-day signed
timer boundary and millis wrap, verifies USB settings persist with the prop absent,
and preserves an active 32-second head cooldown. CI uses the same complete
`scripts/compile-validation.py` driver as local verification, with a shared scratch
sketch/cache and an uploaded source-hash manifest; no compile categories are skipped.

For the new USB/fairness/clock options, see [attended criteria](next-attended-tests.md).
Hardware is unavailable during implementation; software tests never replace those
observations. The full compile matrix can now be run with
`python scripts/compile-validation.py --cli <path-to-arduino-cli>`; it checks the
pinned core and records each source hash under `.skelly-build/validation/`.

From the repository root with Node, Python and a C++17 compiler:

```sh
node --check studio/app.js
node --check studio/template.js
node scripts/sync-runtime-schema.cjs --check
node scripts/sync-template.cjs --check
node scripts/version-studio-assets.cjs --check
node --test studio/tests/*.test.cjs
python tests/test_packets.py
python tests/test_prebuilt.py
python tests/run_firmware_tests.py
node studio/tests/export-samples.cjs
arduino-cli core list
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/SkellyAutonomous
arduino-cli compile --fqbn esp32:esp32:esp32 experiments/BodyComboSingleTest
arduino-cli compile --fqbn esp32:esp32:esp32 experiments/SerialIdleTest
arduino-cli compile --fqbn esp32:esp32:esp32 experiments/ArmSingleTest
arduino-cli compile --fqbn esp32:esp32:esp32 experiments/EyeSingleTest
node scripts/export-attended-tests.cjs
python scripts/compile-attended-tests.py
```

Use Arduino-ESP32 **3.3.12**, board **ESP32 Dev Module**, not the newest core by
accident. On Windows, the IDE bundles `arduino-cli.exe` under
`resources/app/lib/backend/resources/`; `core list` confirms the installed version.
For native tests use `g++` (default), or open a Visual Studio developer PowerShell
and set `$env:CXX='cl'` before running the Python runner. No ESP32 is used by these
tests. They execute actual firmware functions with mocked BLE, UART and time;
they cannot verify RF delivery, motors, LEDs, power quality or the BLE stack.

Compile all generated cases in PowerShell:

```powershell
Get-ChildItem .skelly-build -Directory | ForEach-Object {
  if (Test-Path (Join-Path $_.FullName ($_.Name + '.ino'))) {
    arduino-cli compile --fqbn esp32:esp32:esp32 $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Compile failed: $($_.Name)" }
  }
}
```

On Bash use the guarded loop in `.github/workflows/studio-checks.yml`. Generated
files and native test output are ignored under `.skelly-build/`. After changing
canonical firmware, run `node scripts/sync-template.cjs` before checks/export.
When changing runtime fields or factory scene defaults, run
`node scripts/sync-runtime-schema.cjs` before syncing the template.
After changing Studio JavaScript, CSS or the embedded template, run
`node scripts/version-studio-assets.cjs` to refresh the HTML's content-based
asset URLs. This prevents returning visitors from reusing older modules with a
new page; all modules remain local and work offline.

## Reference hardware test: isolate jaw and RGB, no body motors

1. Keep a copy of the working sketch. In Studio choose **Head OFF, Arm OFF,
   Torso OFF, Eyes OFF, Idle breaks OFF, Compound OFF, Jaw-first OFF**.
2. Enable **Jaw ON**, use the known Long Open clip serial (**13 only on the
   original test prop**), clear extra files, and set jaw minimum/maximum to
   **60 seconds**. Confirm the saved MP3 body-movement flags are **0x00**.
3. Enable lighting: **torso red `#ff0000`, brightness 180**; **head green
   `#00ff00`, brightness 150**. Select **restore after estimated MP3 end (1)**
   and **Verbose diagnostics ON**. These are also the exported
   `.skelly-build/LightingDiagnostic/LightingDiagnostic.ino` settings. The clip
   estimate remains 21 s; do not substitute a longer MP3 in this test.
4. Download/open the sketch. Compile/upload using ESP32 Dev Module and core
   **3.3.12**. Disconnect the phone/web BLE controller. Open Serial Monitor at
   **115200**, with **Core Debug Level: None** to isolate application output.
   Capture the log from boot; allow automatic scan/connect retries.
5. Confirm initial red torso and green head region. Record exactly which LEDs
   channel 1 changes. At the first MP3, note whether saved colors return and
   whether the jaw completes normally. Record actual playback end if observable.
6. Expect `MP3: modeled clip end reached` at ~21 s after the accepted AAC6 write,
   `LIGHTS: queued ... after modeled MP3 end` at +21.5 s, first restore write
   about +21.6 s, then six F2/F3/F4 writes over roughly 1.5–2 seconds. Record
   when each chosen color physically returns. Logs alone are insufficient.
7. Observe **three clips (~4 minutes including connection)**. Stop if any
   unexpected motor action or abnormal behavior occurs. Save the complete log,
   especially a BOOT marker, reset reason, heap/minHeap or TX failures around
   garbled output. A boot marker can be missed if the monitor attaches late;
   absence of one alone does not rule out a reset.

**Pass for this test:** both initial colors appear, each MP3 can override them,
both chosen colors return after every completed restoration, jaw behavior remains
normal, and no unexpected body action/reset occurs. **Fail/needs investigation:**
missing/wrong colors, restore before actual playback finishes, interrupted jaw,
failed writes, new boots/reconnections or corrupted serial output. Report visual
results separately from logs. This is not a full-controller endurance test.

If garbling recurs, keep this exact configuration and capture its timing first.
Then compare a jaw-only run with lighting OFF and a lighting-only run with jaw
OFF, each for the same observation period. A consistent baud mismatch would
usually affect all text; a readable BOOT/reset marker, falling heap, or TX failure
can narrow the investigation but does not by itself establish cause. Numeric
reset reasons come from the pinned core's `esp_reset_reason_t` (for example 1
power-on, 3 software, 4 panic, 9 brownout); retain the complete number/log.

Do not try mode 2 or add motors during this isolated test. Those are separate
integration steps after the visual restoration result is known.


## October 21 result and next serial isolation test

Ready-to-upload sketches, per-test settings and observation cards are provided
by the [attended test pack](attended-test-pack.md). Begin with Test01_JawSerial;
the pack uses this owner's confirmed clip serials and keeps body motors OFF
until the combined routine tests. Recreate it with the export command above.

The user confirmed both colors return after MP3 #13 in mode 1. Four complete
restore sequences are logged, with no reported BLE write failures or mid-session
reconnects and stable connected heap. Serial text corruption persists. The
[experiment entry](experiments.md) separates physical observations from log timing.

For the lighting-OFF comparison, copy the tested diagnostic sketch and change **only**
`LIGHTS_ENABLED` to `false`. Keep jaw #13 every 60 seconds, verbose diagnostics ON,
and every body motor/eye/follow-up/compound/rest option OFF. Keep Serial Monitor at
115200 baud and observe four clips. Saved purple colors are expected in this
comparison; this run is testing serial output, not color restoration.

- If garbling remains, RGB F2/F3/F4 writes are not required to trigger it.
- If it disappears, that narrows the comparison but does not by itself prove a
  lighting-packet or firmware fault.

**Result:** the subsequent lighting-OFF log contains three MP3 requests and two
corrupted lines, each with 64 replacement characters. No RGB writes appear;
connected heap remains 142,540 bytes, with no reported write failures or
mid-session reset/reconnect. RGB writes are therefore not required to reproduce
the symptom. The next attended test is the [serial-only idle sketch](serial-idle-test.md),
which sends no prop commands and reproduces the long pauses between log bursts.
The user subsequently completed all four serial-only cycles with clean output
and stable heap. See the [recorded result](serial-idle-test.md). The next comparison
is the same lighting-OFF jaw firmware in a second serial terminal, capturing
original bytes. A BLE-connected/no-command control remains a possible follow-up;
the clean idle run alone does not establish a cause.

Keep the same firmware and settings when comparing a second serial terminal with
the Arduino monitor closed. Save original received bytes if possible, together
with the readable log and terminal/USB adapter details. A pasted replacement
character cannot reveal the original byte value. Do not change baud, USB cable,
firmware, and lighting settings together; change one factor per comparison.

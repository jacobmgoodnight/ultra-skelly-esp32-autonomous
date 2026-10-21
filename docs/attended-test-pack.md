# Skelly attended test pack — start here

## Current status: short optional checks replace the long checklist

Test01 jaw behavior and the Test04 pool have now been observed. Test05 has logged
pause/resume timing with a tentative physical pass, and Test08 has two logged
reconnect recoveries. **There is no need to repeat these before enjoying Studio.**
Serial text corruption remains intermittent and can be investigated separately.

Export short files with `node scripts/export-attended-tests.cjs --quick`; they
appear under `.skelly-build/quick-tests/`. Compile them with
`python scripts/compile-attended-tests.py --pack .skelly-build/quick-tests`.

| Optional short file | Observation window after connection | Change |
| --- | --- | --- |
| `Quick02_EyeRestore` | ~90 seconds | #13 every 30 s; observe two completed clips and eye #2 recovery. |
| `Quick03_EyeChange` | ~90 seconds | #13 every 30 s; observe two clips with jaw-triggered #2/#6/#18 choices. |
| `Quick06_MotorsLights` | ~4 minutes | Head every 60 s; arm/torso targets 90 s; jaw every 45 s, protected alternating follow-ups and mode-1 colors. |
| `Quick07_AddEyes` | ~4 minutes | Same short routine plus eye recovery, after the relevant isolated check. |
| `Quick09_Compound` | ~3 minutes | No jaw/eyes/lights; one random compound command every 60 s. |
| `Quick10_DuringLights` | ~90 seconds | Mode-2 colors with #13 every 30 s. |
| `Quick11_LightRegions` | ~30 seconds | Static red body/green head; no jaw or motor commands. |

These windows are **spot checks**, not endurance evidence or automatic stop
times. Waits for BLE discovery/retries are additional. The 21-second clip model,
32/35-second motor cooldowns, protection and write spacing are unchanged. The
three-second jaw holds are events within a ~20-second file; the whole file still
needs time to finish. Lighting and eye checks can wait until they are visible.

## Original longer pack (reference / optional endurance)

These sketches are ready for the original tester's **ESP32-WROOM / ESP32 Dev
Module**, Arduino-ESP32 **3.3.12**, and confirmed files **#12 chatter, #13 long
open, #14 whisper and gasp**. They discover **Ultra Skelly v2** by name. No MAC,
Wi-Fi, account or browser connection is required during operation.

1. Extract the ZIP. Open one `.ino` inside its matching folder. No constants
   need changing on the original tester's setup. Keep a copy of your working
   sketch for returning to normal use.
2. Use ESP32 Dev Module, core **3.3.12**, Core Debug Level **None**, upload over
   USB, and open Serial Monitor at **115200**. Disconnect other BLE controllers.
3. Confirm every MP3 used by that test has saved head/arm/torso flags **0x00**.
   Turn the prop's volume knob down for silent jaw operation. Scan/connect
   retries can add time before the first action.
4. Run one test at a time and attend it. These sketches **continue running**;
   the stated time is an observation window, not an automatic stop. Stop for
   abnormal movement, binding or an unexpected actuator.
5. Send the **test name**, complete log from boot, and physical observations.
   Accepted BLE writes do not prove a motor, eye or light changed. Report a
   partial/inconclusive result explicitly; do not advance dependent tests after
   a physical failure.

## Test order

| File / folder | Observe after connection | Purpose / pass criteria |
| --- | --- | --- |
| `Test01_JawSerial` | ~5 min / four clips | Jaw #13 only, 60-second intervals, lighting OFF. Repeat unchanged in a second terminal with Arduino Monitor closed; keep cable/port/baud the same. Capture original bytes if possible. Report whether garbling persists; this is diagnosis, not a new fix. |
| `Test02_EyeRestore` | ~5 min / four clips | No body motors or lights. Eye #2 should return after MP3 overrides at start/end. If the stored MP3 also uses #2, say inconclusive. |
| `Test03_EyeChange` | ~5 min / four clips | No body motors or lights. Jaw-triggered eye choices should be within #2/#6/#18 and recover after playback. |
| `Test04_JawMix` | ~8 min / at least six clips | Match actual jaw behavior to logged #12/#13/#14; no head/arm/torso movement. Random repeats are allowed; extend if one file has not appeared. |
| `Test05_IdleBreaks` | ~8 min / two breaks | #13 only. Observe REST entries, completed jaw animation before each ~30-second pause, and normal playback resumption. The next break targets 120 seconds after the previous break ends. |
| `Test06_MotorsLights` | First 5 min, then up to 20 (optional endurance) | Head 60–90 s, arm 120–180 s, torso 150–210 s, jaw #13 60–90 s. Protected alternating arm/torso start 2 s after a due jaw; standalone head stays protected. Confirm complete motor animations, jaw continuing during arm/torso, and both red body/green head returning after clips. Eyes OFF. |
| `Test07_AddEyes` | First 5 min, then up to 20 | Only after 02 and 06 physically pass: same routine plus eye recovery/rotation from #2/#6/#18 every 120–180 s. Observe motion, eyes and both light channels separately. |
| `Test08_Reconnect` | ~12 min / three cycles | No body motors or eyes; jaw #13 and mode-1 lights. Let one clip/restore finish, power OFF only Skelly for 30 s, power ON, wait for recovery and the next clip; repeat three times without resetting ESP32. Record counters, post-recovery heap, color recovery and unexpected replay. Cached BLE service behavior remains under investigation. |

Mode 1 allows stored MP3 colors during playback and restores afterward. It uses
a 21-second model plus grace and spaced writes, not playback notifications.
The alternating routine will not start a motor on every jaw clip; it also waits
for that motor's own interval. Timing can be deferred by protection/cooldowns.

## Optional experiments — separate from the routine above

| File / folder | Observe | Purpose / pass criteria |
| --- | --- | --- |
| `Test09_Compound` | ~20 min | No jaw, eyes or live lights. One random compound mask every 180–360 s. Match logged masks to visible motor activation and record full durations; repeated random selection need not cover every mask. This tests recurring scheduling, not the already verified individual mask commands. |
| `Test10_DuringLights` | ~5 min / four clips | Jaw #13 with mode 2; body motors and eyes OFF. Observe chosen colors before playback, about 3 s into it, and afterward. Record exact visible response; during-playback restoration is unverified. |
| `Test11_LightRegions` | ~2 min | No jaw or motors. Identify every red channel-0 and green channel-1 LED region, including any mouth LEDs. No separate mouth channel is assumed. |

Do not repeat jaw-first HEAD as a normal test: it already failed at both 2 and
10 seconds. A BLE-connected/no-command serial control may be prepared later if
test 01 warrants it. Playback notifications, multi-week timer behavior and
cached-service lifecycle changes require separate engineering work. Browser
flashing and other roadmap features remain deferred.

## Evidence and reproducibility

Configuration files and `TEST-CARD.md` are included in each folder. Import a
`Studio-settings.json` file to inspect that test in Studio. `manifest.json`
records full settings and SHA-256 hashes; generated sketches are self-contained.

Recreate from the repository with `node scripts/export-attended-tests.cjs`.
Outputs are under ignored `.skelly-build/attended-tests/`. Export/host/compile
checks are **Software-only**; the exact combinations in this pack remain
**Untested** physically until the tester reports results. Existing verified
individual behaviors remain recorded in the hardware verification matrix.

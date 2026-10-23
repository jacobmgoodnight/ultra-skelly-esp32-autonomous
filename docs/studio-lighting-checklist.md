# Studio refresh: checks to confirm

October 23, 2026. The owner now confirms **lighting effects and rotating palettes
work**. The rows below remain references for untested integration, not a request
to repeat completed observations. Browser USB connection, reading, saving changes
and observing the changed routine are also owner-confirmed; use the focused
[USB recovery, fixed-eye and scene checks](usb-settings-scenes.md#focused-follow-up-after-the-identification-correction).
Start with mouth OFF. Use the original ESP32-WROOM, Arduino-ESP32
3.3.12 and a 6.5-foot Ultra Skelly v2. Keep a copy of the working sketch.
Unless a row explicitly uses them, keep clock windows, idle breaks, combined
movements and jaw-first responses OFF so they do not obscure the observation.

## October 22 follow-up status and new spot checks

The owner first reported refresh checks complete except lighting and USB, then
confirmed effects and palette rotation work. On October 23 the owner confirmed
browser USB identification, reading, saving and physically observing changed behavior.
Power-cycle retention/recovery and random scene transitions remain unconfirmed.
Separate motor-command overlap failed (new commands stopped existing motion);
random combined actions worked. Do not repeat completed checks unnecessarily.
The new intervals, startup retry policy and interleaved scheduler below are
Software-only until checked on the prop.

- Subtle: head 60–120 s. Haunted: arm 60–120 s, torso 75–180 s;
  combined masks 3/5/6/7 every 240–600 s, keeping individual routines between.
  For a short isolated combo observation, set combined interval to 60–60 s,
  keep mouth/eyes/lights OFF, and watch at least three events (~4 minutes).
  Pass: combos wait for any current motion, selected motors complete together,
  and single actions resume afterward without cutting a combo short. Restore
  240–600 s afterward. Confirm all four masks separately if random selection
  does not show each. Existing single-frame success does not verify interleaving.
- Boot with Skelly unavailable: miss scans target starts every 5 s during
  the first minute (up to 5 s scanning, with no extra pause after a full miss).
  Afterward the pause is 30 s; logs must report actual waits.
  Power Skelly on within the startup minute and confirm full name discovery and
  connection; after a successful connection, later losses use normal retry timing.
  Try normal retry 10 s; confirm the configured pause. Normal timing is scan duration
  plus pause; startup timing includes scanning. Neither guarantees a connection
  deadline. Save a boot log.
- Edit a palette name and both colors, save/reload the profile, then use its
  button and include it in rotation. Generated RGB must match; verify actual
  colors during the still-pending isolated lighting tests below.
- Eye thumbnails and enlarged previews now use bundled local assets. Reopen the
  saved Studio folder without internet and confirm previews plus generation.
- Browser USB setup now explains the one-time universal Arduino upload, adapter
  selection, closed-monitor requirement and identification retries. Use
  [USB settings/scenes](usb-settings-scenes.md) for the current follow-up.

## Browser checks — reference for the previous refresh

1. Open Studio: three main personalities, no top shortcut bar or head-only button.
   Confirm the purple skull/ribcage/arm icons and purple “Make it yours” title.
2. Select Subtle: head only, 60–120 seconds. Select Normal: head 35–75 seconds,
   arm 150–240 seconds. Select Haunted: arm 60–120 seconds; torso
   75–180 seconds, plus optional combined actions every 240–600 seconds. All three keep mouth OFF.
3. Watch the five-minute preview: Normal shows Head and Arm only; Subtle shows
   Head only. Multiple selected eyes add Eyes; a fixed eye is shown in the summary
   without periodic events. Enabling lighting rotation adds Lighting.
   Combined adds a lane in interleaved mode; combined-only mode replaces body lanes;
   Jaw appears only when mouth is enabled. Long intervals may have no event in
   five minutes. Details stay collapsed; the preview is approximate request timing.
4. Enable palette rotation: lighting turns ON, choices and interval appear. At
   least two palettes and 15–3600 whole seconds are required. A single palette
   button chooses that look and turns rotation OFF; the explicit lighting toggle
   controls activation. Static ignores effect speed.
5. Save/reload a profile with two palettes, a custom interval and pulsing on one
   channel. Confirm settings survive. Older v1/v2 profiles load with rotation OFF
   and Static effects while retaining their explicit movement/eye/mouth settings.
   New profiles use v4 so older Studio cannot silently omit lighting controls.
6. Preview/download the sketch, reopen Studio offline, and repeat generation.
   Eye thumbnails, generation and inline movement icons all work offline.
   Check the layout on a phone and with keyboard focus.

## Physical checks — short, separate observations

| Check | Configuration / time | Confirm visually |
| --- | --- | --- |
| Normal routine | Normal, eyes/lights/mouth OFF; about 5 minutes after connection | Complete head turns and at least one complete two-part arm animation; no torso/jaw action. Requested starts may wait for shared cooldowns. |
| Haunted arm frequency | Haunted, eyes/lights/mouth OFF; about 8 minutes | Head, arm and torso each activate and complete; arm requests use 60–120 seconds (disable combined actions for isolation). Record observed start times; locks can delay them. |
| Eyes, isolated | All motors and mouth OFF; Eyes ON, patterns 2/6/18, every 15–20 seconds; ~1 minute | At least a few changes, all within selected designs; no unexpected movement. Random repeats are allowed. |
| Static lighting baseline | All motors/eyes/mouth OFF; rotation OFF, both effects Static; choose distinct torso/head colors | Both chosen colors and brightness appear. Identify which physical LEDs each channel affects. |
| Palette rotation | Same isolation; effects Static; choose only Halloween + Moonlight, every 15 seconds; ~2 minutes | First selected palette appears, then alternating selected pairs; no unselected colors or half-updated pair left indefinitely. Short stagger while channels update is expected. |
| Pulsing and speed | Rotation OFF; one channel Pulsing, other Static; ~20 seconds per setting, then swap channels | Only the intended region pulses. Compare speed 32 then 96; higher UI speed should be faster. Both colors/brightness remain appropriate. |
| Strobe, optional | Only if flashing is suitable for the surroundings; rotation OFF, one channel Strobe at speed 32; a brief attended observation | Intended channel flashes, other channel remains Static. Skip this test if flashing is unsuitable; leave Strobe unverified. |
| Clock and rotation | Motors/eyes/mouth OFF; two palettes, 15 seconds; enable a short current clock window | No initial lighting sequence before USB time/window. Rotation begins inside the window; no new rotations after closing. An in-flight sequence may finish; lights are **not turned off** by the window. Reset waits for time again. |
| Idle break and reconnect | Same isolated rotation; idle every 120 seconds for 30 seconds, then one prop-only power cycle | No new rotation is requested during the pause; an in-flight sequence may finish. Resume afterward. Reconnect applies the first selected palette and restarts its interval without replaying a partial old sequence. |

Only after isolated success, try Normal plus eyes and static palette rotation for
about five minutes. Confirm full motor actions, selected eyes and complete color
pairs. Mouth integration is optional: with known clips, post-MP3 restoration must
return the **current palette**, retain the selected effect/speed and let the clip
finish. Do not infer this result from a BLE log. Mode-2 restoration remains separate.

Stop for binding, unexpected movement, interrupted playback or resets. Save the
boot/log and exact settings; report visible results separately from transport.
The unresolved intermittent serial corruption and longer endurance/reconnect
checks remain in [the earlier attended list](next-attended-tests.md).

## Practical limits still worth deciding

- A clock window gates new requests; it does not switch lights off or physically
  stop an animation. True lights-out behavior needs its own design and test.
- Custom generated sketches require Arduino compilation/upload. Universal firmware
  needs that upload once, then supports USB settings/scenes in Studio; USB tools
  also accept reviewed universal and fixed head-only installer packages.
- More personalities can eventually include eyes and lighting. The three main
  movement presets remain deliberately simple for this pass.
- Actual playback-end telemetry, automatic daylight-saving adjustment, a retained
  clock after power loss and broad compatibility remain outside current claims.

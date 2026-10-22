# Studio refresh: checks to confirm

October 22, 2026. New rotation and effect behavior is **Software-only / physically
Untested**. Start with mouth OFF. Use the original ESP32-WROOM, Arduino-ESP32
3.3.12 and a 6.5-foot Ultra Skelly v2. Keep a copy of the working sketch.

## Browser checks — no prop needed

1. Open Studio: three main personalities, no top shortcut bar or head-only button.
   Confirm the purple skull/ribcage/arm icons and purple “Make it yours” title.
2. Select Subtle: head only, 120–240 seconds. Select Normal: head 35–75 seconds,
   arm 150–240 seconds. Select Haunted: arm 120–240 seconds; torso remains
   180–360 seconds. All three keep mouth OFF.
3. Watch the five-minute preview: Normal shows Head and Arm only; Subtle shows
   Head only. Enabling eyes adds Eyes; enabling lighting rotation adds Lighting.
   Combined replaces the separate body lanes only when that mode is enabled;
   Jaw appears only when mouth is enabled. Long intervals may have no event in
   five minutes. Details stay collapsed; the preview is approximate request timing.
4. Enable palette rotation: lighting turns ON, choices and interval appear. At
   least two palettes and 15–3600 whole seconds are required. A single palette
   button applies that look and turns rotation OFF. Static ignores effect speed.
5. Save/reload a profile with two palettes, a custom interval and pulsing on one
   channel. Confirm settings survive. Older v1/v2 profiles load with rotation OFF
   and Static effects while retaining their explicit movement/eye/mouth settings.
   New profiles use v3 so older Studio cannot silently omit lighting controls.
6. Preview/download the sketch, reopen Studio offline, and repeat generation.
   Eye thumbnails still need internet; generation and inline movement icons do not.
   Check the layout on a phone and with keyboard focus.

## Physical checks — short, separate observations

| Check | Configuration / time | Confirm visually |
| --- | --- | --- |
| Normal routine | Normal, eyes/lights/mouth OFF; about 5 minutes after connection | Complete head turns and at least one complete two-part arm animation; no torso/jaw action. Requested starts may wait for shared cooldowns. |
| Haunted arm frequency | Haunted, eyes/lights/mouth OFF; about 8 minutes | Head, arm and torso each activate and complete; arm requests use 120–240 seconds. Record observed start times; locks can delay them. |
| Eyes, isolated | All motors and mouth OFF; Eyes ON, patterns 2/6/18, every 15–20 seconds; ~1 minute | At least a few changes, all within selected designs; no unexpected movement. Random repeats are allowed. |
| Static lighting baseline | All motors/eyes/mouth OFF; rotation OFF, both effects Static; choose distinct torso/head colors | Both chosen colors and brightness appear. Identify which physical LEDs each channel affects. |
| Palette rotation | Same isolation; effects Static; choose only Halloween + Moonlight, every 15 seconds; ~2 minutes | First selected palette appears, then alternating selected pairs; no unselected colors or half-updated pair left indefinitely. Short stagger while channels update is expected. |
| Pulsing and speed | Rotation OFF; one channel Pulsing, other Static; ~20 seconds per setting, then swap channels | Only the intended region pulses. Compare speed 32 then 96; higher UI speed should be faster. Both colors/brightness remain appropriate. |
| Strobe, optional | Only if flashing is suitable for the surroundings; rotation OFF, one channel Strobe at speed 32; a brief attended observation | Intended channel flashes, other channel remains Static. Skip this test if flashing is unsuitable; leave Strobe unverified. |
| Clock and rotation | Motors/eyes/mouth OFF; two palettes, 15 seconds; enable a short current clock window | No initial lighting sequence before USB time/window. Rotation begins inside the window; no new rotations after closing. An in-flight sequence may finish; lights are **not turned off** by the window. Reset waits for time again. |
| Idle break and reconnect | Same isolated rotation; idle every 120 seconds for 30 seconds, then one prop-only power cycle | No new palette change starts during the pause; resume afterward. Reconnect applies the first selected palette and restarts its interval without replaying a partial old sequence. |

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
- Custom generated settings still require Arduino compilation/upload. The browser
  installer remains a separate fixed head-only profile, regardless of Normal's arm default.
- More personalities can eventually include eyes and lighting. The three main
  movement presets remain deliberately simple for this pass.
- Actual playback-end telemetry, automatic daylight-saving adjustment, a retained
  clock after power loss and broad compatibility remain outside current claims.

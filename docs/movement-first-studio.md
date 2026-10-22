# Movement-first Studio update — October 21, 2026

Studio starts with mouth OFF. Normal and Haunted also leave it OFF; Subtle and
Watchful already did. Head, arm, torso, eye rotation, static RGB and brightness
need no uploaded MP3 or web controller. Motor cooldowns and optional clock-window
requirements still apply.

The last configuration panel is collapsed and labeled **Optional mouth routines ·
limited**. Only its explanation and enable switch appear until mouth is enabled.
Clip mapping, Storyteller, MP3 protection, jaw-first responses, fair turns,
duration estimates, passive observations and MP3 eye/light restoration live
inside it. Turning mouth OFF clears jaw-first selection/recurrence, fair turns
and passive observations, retaining clip mappings and independent settings.
Imported profiles preserve their explicit settings, including mouth ON.

The canonical reference sketch keeps its previous head-and-jaw defaults and
behavior. Direct-source users should set `MOUTH_ENABLED = false` for an audio-free
setup; Studio emits that setting automatically. No scheduler, packet, motor
duration or safety guard changes in this update.

## Software evidence

- 53 Node tests pass, including audio-free defaults/presets, disabling jaw
  coordination without losing other settings, and profile preservation.
- 31 native C++ executables pass, with two expected compile-time rejections.
  The added 20-minute simulated audio-free run observes all three body motors,
  eyes, lighting and idle breaks, validates packet CRCs and rejects any AAC6.
- CRC vectors, prebuilt packaging, template and asset consistency checks pass.
- 58 pinned Arduino-ESP32 3.3.12 cases: three changed/new generated sketches
  compiled in this pass (Normal, HauntedWithBothMotors, MovementEyesAndLights);
  55 source SHA-256 hashes match previous successful builds, including canonical,
  compound diagnostic and attended sketches. The matrix now has 34 cases.
- Desktop and 390-pixel browser checks cover collapsed defaults, opt-in reveal,
  disabling with clip retention, unique IDs, valid download and no horizontal overflow.

These are **Software-only** results. Hardware is unavailable; no new physical
motion, USB flashing, lighting-effect or endurance result is claimed. Review
this focused change separately from the preceding firmware PR before merging.

## Animated lighting follow-up

The upstream [Ultra Skelly profile](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/constants.js)
lists Static, Strobe and Pulsing for torso/head. Studio currently emits static
RGB and brightness only. Animated effects appear feasible through direct BLE
commands without uploaded audio. They need implementation, packet/CRC and
generated-build checks, then an attended effect/speed and channel-mapping test.
See the [lighting plan](roadmap.md#p2--lighting-capabilities).

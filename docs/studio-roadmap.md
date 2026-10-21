# Studio usability and next steps

The October 21 usability pass separates body movement and mouth routines, uses
short everyday labels, and folds optional appearance, coordination and testing
controls away. Firmware defaults, timing, packet formats and generator anchors
are unchanged. Existing settings remain accessible. The five-minute timeline stays visible
and is explicitly illustrative; it is not a firmware simulator.

## Mouth routines

The clip library offers **Chatter**, **Long open**, **Whisper & gasp**, and a
**Surprise me** mix of the entered clips. Each button selects actual stored MP3
file numbers. It cannot create jaw movement from a label, upload audio to Skelly,
or position the jaw directly. Clips must already be uploaded, have body movement
flags `0x00`, and fit the existing 21-second playback model. Silence is controlled
by the prop's volume knob.

New clip-library fields start blank. File numbers are device-specific; the
original user's confirmed mapping is 12 / 13 / 14, not a universal numbering
scheme. Saving a version-1 JSON profile keeps the settings and library together
without an account or browser storage. Imports validate the full profile before
applying changes. A file mix is existing generated firmware behavior, but its
combined hardware integration still needs an attended run.

## Pending hardware work, in practical order

| Priority | Test | Result criteria |
| --- | --- | --- |
| Next diagnosis | Repeat the lighting-OFF jaw sketch using a second serial terminal, then a BLE-connected/no-command control if needed | Save original bytes and timing; compare the same cable, baud and sketch. Serial-only idle passed once, so no UART/monitor or BLE cause is established. |
| Before relying on a combined routine | Known jaw clip + standalone head + alternating arm/torso + mode-1 lights, adding eyes separately | Observe each motor finishing, jaw continuing during arm/torso, both colors returning, and no unexpected movement/reset. Start with a short attended run, then extend endurance. |
| Before using eye recovery | Keep selected eyes / choose new eyes around MP3 | Visually confirm the requested expression survives start/end; serial acceptance is insufficient. |
| Before using file mixes or breaks | Uploaded-file random selection and idle breaks | Verify each actual file, no body metadata actions, no interrupted animation at rest entry, and normal resumption. |
| Reliability | Several prop power cycles, reconnects, then extended runtime | No unexpected replay, stable post-connection heap, fresh usable service handles and canceled stale jobs. Cached service lifecycle remains an audit item. |
| Optional experiment | Recurring combined body mode, separate from jaw-first | Confirm each permitted mask, full motion durations and conservative cooldowns over repeated cycles. |
| Optional experiment | During-playback light restoration, exact head LED region | Observe channel mapping and both chosen colors during/after audio without breaking the routine. |

Jaw-first HEAD already **failed** at both 2 and 10 seconds. It stays an advanced
diagnostic rather than a routine choice. Mode-1 color recovery and individual
compound masks are already physically verified; they do not need to be repeated
as new discoveries. AE02 playback-end notifications and multi-week timer behavior
are separate engineering investigations, not prerequisites for improving the UI.

## Uploading without Arduino IDE

Arduino IDE is optional. Arduino CLI can compile and upload the same sketch.
Compilation is required somewhere: the ESP32 executes firmware binaries, not an
`.ino` file. Studio currently generates source only.

[Espressif's esptool-js](https://github.com/espressif/esptool-js) flashes compiled
images from Chrome/Edge over USB using Web Serial.
[ESP Web Tools](https://esphome.github.io/esp-web-tools/) provides an embeddable
installer, firmware manifests and a serial console on a secure web origin. USB
flashing requires no prop Wi-Fi or continuously connected browser. A prebuilt
image must match the chip, flash layout and reviewed firmware revision.

Recommended staged implementation:

1. Add a browser serial monitor with plain-text and original-byte downloads. This
   would also help the current log investigation; keep opening a port an explicit
   user action and handle resets/disconnects.
2. Publish reviewed, versioned prebuilt firmware and a browser USB installer.
   Start with fixed tested profiles; do not imply custom source is compiled by
   the upload button. Include chip validation and clear overwrite/recovery steps.
3. Move validated settings into versioned persistent ESP32 configuration, written
   over USB. Then one firmware installation can support changes from Studio
   without recompiling. This requires firmware migration, input validation,
   safe application between actions, and power-loss/reconnect tests.

A hosted compiler would add infrastructure and privacy/availability concerns;
it is not needed for the preferred static, account-free approach. An in-browser
compiler would be a separate substantial toolchain project.

## Further usability and fun

- Add named color palettes and more personality starting points using existing
  controls; show which motors and clips each personality needs.
- Offer downloadable jaw clips with animated waveform examples clearly labeled
  as illustrative, followed by a short upload/number-mapping wizard.
- Add a read-only connected status and guided hardware check after a future USB
  protocol exists. Do not present unconfirmed writes as successful physical tests.
- Add additional synthesized patterns such as double take, yawn and sudden gasp
  as opt-in audio experiments. Physical response must be checked per clip.

Browser flashing, a serial console, extra waveforms and persistent firmware
configuration are proposals, not capabilities in this UI pass.

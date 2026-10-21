# BLE protocol notes

## Discovery

- Advertisement name: `Ultra Skelly v2` (name-based scan; no fixed MAC required)
- Service: `0000ae00-0000-1000-8000-00805f9b34fb`
- Write without response: `0000ae01-0000-1000-8000-00805f9b34fb`
- Notify: `0000ae02-0000-1000-8000-00805f9b34fb`
- The ESP32 must **finish/stop BLE scanning before beginning the connection**. An earlier version connected inside the scan callback and stalled.

## Frame layout and CRC8

Most short frames have 2-byte tag (`AA xx`), an eight-byte payload (zero-padded as appropriate), and a final CRC8 byte. Start CRC at zero; for each input byte XOR and shift 8 times with reversed polynomial `0x8C` when bit 0 is set. Compute over **all bytes except the CRC**.

Known test vectors:

| Intent | Request | Status |
| --- | --- | --- |
| Head | `AA CA 01 00 00 00 00 00 00 00 51` | **Confirmed** (~25-second animation) |
| Torso | `AA CA 04 00 00 00 00 00 00 00 07` | **Confirmed** (~25 seconds); optional, OFF by default |
| File 12 play | `AA C6 00 0C 01 00 00 00 00 00 DF` | **Confirmed** and received `BBC6` playing/stopped acknowledgments |
| Eye icon 2 (live) | `AA F9 02 00 00 00 00 00 00 00 [CRC]` | **Confirmed:** one-shot and randomized live eye changes |

Movement selector flags from upstream: `0x01` head, `0x02` arm, `0x04` torso, `0xFF` all. When editing an audio file, setting saved movements to **`0x00`** disabled head/arm/torso but did **not** disable the jaw responding to that audio.

For playback `AAC6`: payload = two-byte big-endian file serial, byte `0x01` for play or `0x00` for pause, remaining padding zeros, and CRC. **Always query the actual audio file serial on YOUR Skelly**: #12 was the original test device's first jaw clip, not a universal slot.

## Live eye expressions (`AAF9`)

The upstream controller's [app-modular.js](https://github.com/martinecker/SkellyUltraWebController/blob/main/app-modular.js) uses eye ID 1–18, 4-byte *zero* cluster, empty filename marker/length (`00`), and CRC to change eyes in **live** mode. This differs from per-file eye metadata editing, which targets a specific file cluster/name. This repository's firmware sends exactly one 11-byte live eye frame at a time.

**Physical evidence:** one-shot and randomized live eye changes worked on the original prop. Test `experiments/EyeSingleTest` for a different device; restoration after MP3 remains unconfirmed.

## Further upstream references

- [Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController)
- [BLE UUIDs, command tags, movement flags, and supported eye ID range](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/constants.js)
- [CRC8 implementation and frame builder](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/protocol.js)
- [Live-mode `AAF9` eye command](https://github.com/martinecker/SkellyUltraWebController/blob/main/app-modular.js)
- [Device-specific per-file settings](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/device-settings.js)

Do not confuse `AAF9` for live eyes with the movement command `AACA` or stored-file playback `AAC6`.

## Optional body commands and motor serialization

The upstream movement-bit mapping is **head `0x01`**, **arm `0x02`** and **torso `0x04`**. Torso-only `AA CA 04` was physically tested (~25 seconds). Arm-only `AA CA 02` has **been physically tested** (two motions in ~22 seconds) and is disabled by default in checked-in base firmware. All physical body motor commands are sent sequentially, with per-command cooldown. For procedure and conservative durations see [body movement guide](body-movements.md).

## Arm measured, experimental concurrent body movements

On October 20, 2026 the individual `AA CA 02` arm command was verified: **two arm movements taking 22 seconds total**. The torso-only `AA CA 04` action had previously taken ~25 seconds. The controller now provides an advanced opt-in `ALLOW_BODY_MOTOR_OVERLAP` setting. It bypasses the shared body-motor lock but preserves independent cooldown periods (head 25+7 seconds, torso 25+10, arm 22+10) and inserts at least 600 milliseconds between body BLE commands. Simultaneous head/torso/arm behavior is not verified. Review [body-movement guide](body-movements.md).


## Jaw-first head failure and combined AACA movement bitmasks (October 20)

The jaw-first HEAD experiment (`AAC6` file #13, then `AA CA 01` two seconds later) was physically unsuccessful on **two** runs despite successful-looking BLE writes; ordinary head motion worked independently. Jaw-first ARM and TORSO *did* move with the mouth. Do not infer physical motor success from `sendFrame` logging.

The community web controller's live movement grid **combines selected bits**: `0x01` head, `0x02` arm, `0x04` torso, and a special `0xFF` ALL value. Combined masks `0x03` (head+arm), `0x05` (head+torso), `0x06` (arm+torso) and `0x07` (all three) are protocol-grounded requests. All four were subsequently physically verified (see below). The opt-in recurring compound scheduler is implemented but not field-verified.


## Physically tested multi-motor AACA mask and head/MP3 arbitration

In the October 20 tests, `AA CA 03 00 00 00 00 00 00 00 D7` (movement mask `0x03 = HEAD + ARM`) **physically moved both requested body parts**, with no MP3 playing. Torso remained still as expected because `0x04` was not set. This directly validates a combined movement **bitmask**, not every possible motor combination. Mask `0x05` (head+torso) was subsequently physically verified: both moved from a single `AA CA 05 00 00 00 00 00 00 00 44` packet. Masks `0x06` (arm+torso) and `0x07` (all three) were subsequently verified too; see the final result below.

In contrast, head command `AA CA 01` during ongoing jaw MP3 #13 playback, at both **2-second and 10-second** offsets, was transmitted but **did not physically move the head**. This suggests an MP3-specific suppression/arbitration effect, not a limitation of all combined body-motor commands. Exact firmware internals are unknown.


## All supported combined body masks verified on the original Skelly

October 20 physical tests established that **one AACA command can activate multiple body motors** using the combined bitfield. `0x03` activated HEAD+ARM, `0x05` activated HEAD+TORSO, `0x06` activated ARM+TORSO, and **`0x07` activated HEAD+ARM+TORSO**. The latter two were confirmed after the original `0x03` and `0x05` tests. The individual completion durations were not recorded for the combination tests; the observation validates simultaneous activation rather than long-term endurance.

The AACA 0x07 command was `AA CA 07 00 00 00 00 00 00 00 C2`. These physical results are **independent of AAC6 jaw playback**, which wasn't used for the combined-mask tests. The main autonomous controller uses individual head/arm/torso commands by default; the separate opt-in compound scheduler is implemented and still needs an extended field test.


## New experimental live RGB channel commands

The upstream Skelly profile identifies two live lighting channels: `0x00` **Torso Light** and `0x01` **Head Light**. The latter may illuminate the mouth but has not been physically mapped on this user's device. The live-mode commands use tags `AAF2` (static effect mode 1), `AAF3` (brightness 0–255), and `AAF4` (RGB + color cycle OFF). Based on the upstream `app-modular.js`, the RGB request is **13 bytes** (two-byte tag + ten-byte payload + CRC8) and the shorter brightness request is **11 bytes**. F2 static-mode request size depends on the channel as implemented by the upstream code (11 bytes for channel 0; 12 bytes for channel 1).

The new firmware can reapply both live colors after AAC6 playback or, experimentally, during and after it. Both initial live colors and MP3 #13 resetting them to saved colors were physically observed. October 21: mode 1 correction was visually confirmed for both red body and green head after file #13, with all body motors and eyes OFF. Mode 2 and lighting/motor integration remain unverified. The client currently uses a 21-second duration estimate plus 500 ms grace and does not subscribe to AE02 playback status. These live commands are **not enabled** in the base sketch. See [setup/testing guide](compound-body-and-lighting.md).

## Playback status and transport limits

The upstream `js/protocol-parser.js` parses BBC6 as a two-byte file serial, a
playing flag and a duration. This does not establish that every Skelly sends an
unsolicited natural-EOF stop notification. Before using it to shorten safety
locks or trigger restoration, capture real frames, verify CRC/length and
file identity, and test missing/duplicate/out-of-order notifications. Keep a
conservative duration fallback. No such subscription is added in the diagnostic PR.

Arduino-ESP32 3.3.12 `BLERemoteCharacteristic::writeValue` returns a bool even for
WRITE_NR. The firmware now checks it and connection state; an accepted request
still does not confirm a motor, light, or audio response on the prop.

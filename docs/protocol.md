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
| Torso | `AA CA 04 00 00 00 00 00 00 00 07` | **Confirmed** (~25 seconds); not used in main firmware |
| File 12 play | `AA C6 00 0C 01 00 00 00 00 00 DF` | **Confirmed** and received `BBC6` playing/stopped acknowledgments |
| Eye icon 2 (live) | `AA F9 02 00 00 00 00 00 00 00 [CRC]` | **Derived from upstream; not yet tested on ESP32** |

Movement selector flags from upstream: `0x01` head, `0x02` arm, `0x04` torso, `0xFF` all. When editing an audio file, setting saved movements to **`0x00`** disabled head/arm/torso but did **not** disable the jaw responding to that audio.

For playback `AAC6`: payload = two-byte big-endian file serial, byte `0x01` for play or `0x00` for pause, remaining padding zeros, and CRC. **Always query the actual audio file serial on YOUR Skelly**: #12 was the original test device's first jaw clip, not a universal slot.

## Live eye expressions (`AAF9`)

The upstream controller's [app-modular.js](https://github.com/martinecker/SkellyUltraWebController/blob/main/app-modular.js) uses eye ID 1–18, 4-byte *zero* cluster, empty filename marker/length (`00`), and CRC to change eyes in **live** mode. This differs from per-file eye metadata editing, which targets a specific file cluster/name. This repository's firmware sends exactly one 11-byte live eye frame at a time.

**Caution:** This is based on upstream source reading, not an independently confirmed on-device observation. Test `experiments/EyeSingleTest` before opting in.

## Further upstream references

- [Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController)
- [BLE UUIDs, command tags, movement flags, and supported eye ID range](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/constants.js)
- [CRC8 implementation and frame builder](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/protocol.js)
- [Live-mode `AAF9` eye command](https://github.com/martinecker/SkellyUltraWebController/blob/main/app-modular.js)
- [Device-specific per-file settings](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/device-settings.js)

Do not confuse `AAF9` for live eyes with the movement command `AACA` or stored-file playback `AAC6`.

## Optional body commands and motor serialization

The upstream movement-bit mapping is **head `0x01`**, **arm `0x02`** and **torso `0x04`**. Torso-only `AA CA 04` was physically tested (~25 seconds). Arm-only `AA CA 02` has **not** been physically tested and is disabled by default. All physical body motor commands are sent sequentially, with per-command cooldown. For procedure and conservative durations see [body movement guide](body-movements.md).

## Arm measured, experimental concurrent body movements

On October 20, 2026 the individual `AA CA 02` arm command was verified: **two arm movements taking 22 seconds total**. The torso-only `AA CA 04` action had previously taken ~25 seconds. The controller now provides an advanced opt-in `ALLOW_BODY_MOTOR_OVERLAP` setting. It bypasses the shared body-motor lock but preserves independent cooldown periods (head 25+7 seconds, torso 25+10, arm 22+10) and inserts at least 600 milliseconds between body BLE commands. Simultaneous head/torso/arm behavior is not verified. Review [body-movement guide](body-movements.md).


## Jaw-first head failure and combined AACA movement bitmasks (October 20)

The jaw-first HEAD experiment (`AAC6` file #13, then `AA CA 01` two seconds later) was physically unsuccessful on **two** runs despite successful-looking BLE writes; ordinary head motion worked independently. Jaw-first ARM and TORSO *did* move with the mouth. Do not infer physical motor success from `sendFrame` logging.

The community web controller's live movement grid **combines selected bits**: `0x01` head, `0x02` arm, `0x04` torso, and a special `0xFF` ALL value. Combined masks `0x03` (head+arm), `0x05` (head+torso), `0x06` (arm+torso) and `0x07` (all three) are therefore protocol-grounded requests, **not** confirmed concurrent physical animations. They are implemented only in an [isolated one-shot test](../experiments/BodyComboSingleTest/BodyComboSingleTest.ino), not in the default autonomous scheduler.

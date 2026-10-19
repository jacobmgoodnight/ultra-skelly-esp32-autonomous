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

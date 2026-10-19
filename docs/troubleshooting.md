# Troubleshooting

| Symptom | What to check |
| --- | --- |
| `expected unqualified-id before string constant` on the UUID | Keep each `#define SERVICE_UUID "..."` or string assignment complete on one line. Broken line wraps can cascade into `scanner not declared` errors. |
| `getService()` / `getCharacteristic()` no matching function | The calls need UUID arguments: `client->getService(SERVICE_UUID)` and `service->getCharacteristic(WRITE_UUID)`. |
| Skelly found, stuck at `Connecting...` | Don't call `connect()` inside BLE scan callback; connect only after the scan returns. Close other controllers. Power cycle/restart if needed. |
| No COM port | Correct ESP32 board/USB data cable/CP210x driver and Tools > Port selection. |
| Upload completes but ESP32 doesn't connect until reboot | Most boards auto-reset after upload. On some setups press EN/RESET or power-cycle the **ESP32 USB** after flashing; keep Skelly powered on, disconnect web/phone controller, and watch the 115200 baud Serial Monitor. The main sketch repeats its 5-sec BLE scan after ~30 sec; frequent manual resets indicate something to investigate, not a normal configuration step. |
| Which Bluetooth address do I enter? | **None**: the sketch scans by advertised name `Ultra Skelly v2` and discovers the MAC automatically. Don't change `SERVICE_UUID` / `WRITE_UUID`; set your **MP3 file serial** in `MOUTH_FILE_SERIAL` separately. |
| Skelly isn't found | Check it's powered, in BLE range, and not already owned by another phone/browser connection. Wait for next scan/retry. |
| Jaw file plays but whole body moves | Set that file's **saved movement flag to 0x00**, not `0xFF` in the web controller. |
| Wrong audio file plays | `MOUTH_FILE_SERIAL` is specific to your prop's file table, not universal. Read actual serial and rebuild. |
| Eyes don't change | They are OFF by default. Run isolated `EyeSingleTest`; confirm live-mode packet on your device. Eye changes may be overwritten by per-file playback eye metadata. |
| No sound is heard | Intentional with prop's *physical volume knob at 0*. If you want audible audio, turn knob up. |
| First jaw event takes some time | Scheduling waits random 45–90 sec after connection by default. File playback behavior and BLE connection delay also vary. |

## Safety and limitations

- **Keep clear of all joints and motorized parts.** The prop can move unexpectedly while testing.
- Use a suitable USB power supply and weatherproof enclosure/location for the ESP32; do not expose bare circuit boards to rain.
- Automatic reconnection and indefinite unattended operation require validation on your firmware; watch your first full power cycle and several hours of operation.
- Head 25 sec + 7 sec buffer yields the **32 sec minimum**. Shortening it can cause overlapping motor cycles.
- The code does not prevent all possible conflicts inside the Skelly firmware; future device updates could change the BLE protocol.
- This project does **not** modify the prop's mechanical or electrical safety interlocks.

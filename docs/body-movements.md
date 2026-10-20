# Optional torso and arm movements

This project started as a silent autonomous **head + jaw** controller. **Torso** and **arm** movements have been added as optional advanced features; both are **OFF by default** in the checked-in firmware.

## What has been verified

| Movement | BLE frame payload flag | Field status | Assumed runtime |
|---|---|---|---|
| Head | `AA CA 01 ... CRC` | Tested | ~25 s |
| Torso | `AA CA 04 ... CRC` | Tested separately | ~25 s |
| Arm | `AA CA 02 ... CRC` | **Not yet tested on physical Skelly** | 30 s *estimate* |

The movement bit mapping comes from the community [Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/constants.js). A supported protocol bit **does not establish** independent physical movement without a test.

## Test the arm alone before enabling it

1. Keep the moving arm clear of decorations, props, people, and pets. Ensure Skelly is secure and stable.
2. Back up the firmware currently running on your ESP32.
3. Turn on Skelly and close any web controller or phone app using Bluetooth.
4. Flash **[ArmSingleTest.ino](../experiments/ArmSingleTest/ArmSingleTest.ino)** to the ESP32 Dev Module, with Arduino-ESP32 3.3.12 (or your known working version).
5. Open Serial Monitor at **115200**. It should scan for `Ultra Skelly v2`, connect **after** scanning stops, and send one `AA CA 02` packet.
6. Watch which joint actually moves and **time the full animation**. Do not assume the arm lasts 25 or 30 seconds.
7. Restore the normal controller when finished. Report arm movement and duration so the code's timer and cooldown can be calibrated.

## Safety and scheduling

The controller uses a **single body-motor lock**. It never intentionally starts another head/torso/arm command while one is assumed to be operating. An extra cooldown follows each physical motion.

- **Head:** measured ~25 seconds + 7-second buffer = at least 32 seconds before next body command.
- **Torso:** measured ~25 seconds + 10-second buffer = at least 35 seconds.
- **Arm:** *unverified* 30-second working estimate + 15-second buffer = at least 45 seconds. Increase this if your arm movement lasts longer. Do not leave the arm enabled unattended until verified.

The independent silent jaw MP3 and live eye commands can still overlap body movement. Each jaw MP3 must have its **saved head, torso and arm movement flags set to `0x00`**, or MP3 playback may unexpectedly move body parts.

Body animation scheduling is **best effort**: the app's random ranges are the target start-to-start delays for each part. If another motor is already running, movement can start *later* than its scheduled target. The most overdue body request gets the next turn. The 5-minute timeline is illustrative only.

## Studio presets

- **Subtle:** torso OFF, arm OFF.
- **Normal:** torso OFF, arm OFF.
- **Haunted:** torso ON (random 180–360 seconds), arm **OFF** pending the arm-only hardware test.

In all modes, each body part has its own enable switch and frequency controls. **Choosing Haunted is an explicit decision to enable torso movement.** The generated sketch preserves the other tested behaviors, but combinations with torso and arm still need field testing.

## Checked-in sketch defaults

```cpp
const bool TORSO_ENABLED = false;
const bool ARM_ENABLED = false;
const uint32_t TORSO_MIN_INTERVAL_MS = 240000; // 4 min
const uint32_t TORSO_MAX_INTERVAL_MS = 420000; // 7 min
const uint32_t ARM_MIN_INTERVAL_MS = 360000;   // 6 min
const uint32_t ARM_MAX_INTERVAL_MS = 720000;   // 12 min
```

To opt in, customize the settings in [Skelly Studio](../studio/) and download a generated sketch. No external sensors, phone or Wi-Fi are needed after programming.
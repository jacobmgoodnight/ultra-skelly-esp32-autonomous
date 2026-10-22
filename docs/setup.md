# Setup guide

## 1. Obtain hardware

A standard Bluetooth-capable ESP32 development board is sufficient (the confirmed test device was an ESP32-WROOM-32 USB-C/CP2102 board). It needs a USB power supply. No wires or modifications connect the ESP32 to the Skelly prop.

## 2. Prepare Arduino IDE

- Install [Arduino IDE](https://www.arduino.cc/en/software).
- Add the **ESP32 Espressif package** through Boards Manager. If needed, use `https://espressif.github.io/arduino-esp32/package_esp32_index.json` in Preferences > Additional Boards Manager URLs.
- Install `esp32 by Espressif Systems`. This project was last tested with version **3.3.12**.
- Board: **ESP32 Dev Module**.
- Select the USB serial port under Tools > Port; on the original Windows testing machine it was COM3, but other PCs will differ.
- If the port is absent, install the driver for the USB-UART chipset used by your board (the tested board used CP2102).

## 3. Upload the jaw clip once

1. Power on Skelly (not in the middle of a power cycle).
2. Disconnect the ESP32 if it is connected to Skelly. Only one app/controller should command the prop at once.
3. Open the [Skelly Ultra Web Controller](https://martinecker.github.io/SkellyUltraWebController/) with Chrome or Edge and connect via Web Bluetooth.
4. Go to device files, upload `audio/Jaw_Idle_Random_20s_v2.mp3`, and disable **all file movement**. Set all selection buttons OFF and **Apply All Settings**. Confirm `0x00` for head/arm/torso movement.
5. Play once to see if the jaw responds without body movement. On the test Skelly, the physical volume knob was at zero, so the jaw moved with no sound audible from the speaker.
6. Read the file serial from the web controller log when playing (`Playing file #NN`). The developer's original jaw clip was #12; a later upload could have a different number.
7. Disconnect web controller before returning to the ESP32.

The file's own eye/lights metadata may apply during playback; keep that in mind if experimenting with live eyes.

## Bluetooth address: no manual MAC setup

The sketch uses `SKELLY_NAME = "Ultra Skelly v2"` to discover the prop. It reads the **Bluetooth address dynamically during the BLE scan**, so **do not replace the code's service/characteristic UUIDs with your own MAC**. Those UUIDs describe the device's BLE service; they are not per-unit serial numbers.

The one per-device setting you normally *must* change is `MOUTH_FILE_SERIAL`, which is the **stored MP3 file number** reported by the web controller. The original test unit used #12, but others might differ. If your prop has been renamed and advertises a different BLE name, update `SKELLY_NAME` as well.

## 4. Flash firmware

Open `firmware/SkellyAutonomous/SkellyAutonomous.ino`, change `MOUTH_FILE_SERIAL` to the actual file number and upload. Open the Serial Monitor at **115200**.

### After flashing: first connection

Most ESP32 boards restart automatically after a successful upload; the normal controller then begins scanning. **On the original test setup, manually turning the ESP32 off and back on sometimes appeared necessary before it connected.** If the scan or connection doesn't begin:

1. Power on Skelly and close/disconnect the official app and web controller.
2. After the upload completes, press **EN/RESET** on the ESP32, or unplug and reconnect **ESP32 USB power** (not Skelly's power).
3. Reopen Serial Monitor at **115200**, looking for `Scanning for Ultra Skelly v2...`, `Found Skelly by advertised name.`, and `CONNECTED`. The controller does not log device addresses.
4. Give it time: each scan lasts approximately **5 seconds**; after an unsuccessful scan or connection the sketch waits roughly **30 seconds** before retrying.
5. If it only ever connects after an ESP32 reboot, report your board, Arduino-ESP32 version and serial output; manual power cycling should not be a prerequisite for normal automatic reconnect.

The one-shot eye test is different: it scans **only once** per reset, while the main controller retries automatically. This distinction matters when testing immediately after flashing.


Sample log (illustrative):

```text
Found Skelly by advertised name.
Connecting to Skelly (scan is finished)...
CONNECTED. Head ON, jaw ON, torso OFF, arm OFF.
First head in 47 seconds.
Jaw file serial 12; first attempt in ~68 seconds.
HEAD command sent; next head in 39 sec.
JAW command sent (file #12); next jaw in 77 sec.
```

## 5. Long-running installation

Leave ESP32 powered through USB, near Skelly but protected from rain and moisture. The ESP32 periodically scans while Skelly is off and should reconnect when it is powered. Keep a sensible motor duty cycle. Inspect the animatronic regularly; this project does not bypass the prop's built-in safety interlocks.

**Important:** Verify full off/on cycle recovery in your own setup before trusting it unattended. Default MP3 protection makes standalone head and jaw take turns; MP3 playback has interrupted head movement in testing. Keep protection enabled. Behaviors may differ across firmware versions.

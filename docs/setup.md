# Setup guide

For everyday use, install universal firmware once, then use Studio’s **Connect & save** controls for subsequent read/save operations. [Current release and install/save distinction](status.md) · [next attended checks](next-release-checklist.md). Advanced experimental audio is optional; ordinary movement/eye/light routines need none.


## 1. Obtain hardware

A standard Bluetooth-capable ESP32 development board is sufficient (the confirmed test device was an ESP32-WROOM-32 USB-C/CP2102 board). It needs a USB power supply. No wires or modifications connect the ESP32 to the Skelly prop.

## 2. Install universal firmware in your browser

Open [Studio](../studio/index.html) → **Connect & save → First-time setup**.
Follow **Connect ESP32 → Install Firmware → Configure Skelly**. Use an original
ESP32-WROOM development board with 4 MB flash, desktop Chrome/Edge and a USB data
cable. The installer fetches the versioned package directly; no Arduino software,
manual Actions download or GitHub account is needed.

**Installation replaces ESP32 firmware and resets saved settings/scenes.** Export
existing settings and keep your working sketch first. Leave Skelly OFF while
installing. Confirm the overwrite notice, prepare the package, choose its USB port
and wait for the installer to report completion. Close the dialog to release USB.
Browser flashing remains **physically Untested**; see the
[installation/recovery guide and short attended checklist](browser-installation.md).

## 3. Configure and save one routine

Return to Studio, choose Connect ESP32, then wait for Ready (up to 45 seconds).
Choose **Subtle** for an attended head-only first try; eyes and lights are optional.
Check replacement confirmation and choose **Save this routine**. You do not need
Scene builder. Wait for read-back verified before unplugging. Use **Save scene
collection** only for a saved collection built in Scene builder. Neither button
installs firmware; ordinary edits need no reinstall. Read saved settings first
when keeping an existing controller's setup.

### Advanced Arduino fallback

Studio's First-time setup contains a collapsed **Advanced Arduino fallback** with
model-specific universal source. Install [Arduino IDE](https://www.arduino.cc/en/software)
and **esp32 by Espressif Systems 3.3.12**, select **ESP32 Dev Module** and your USB
port, then compile/upload the downloaded .ino. Close Serial Monitor before using
Studio USB settings. A custom fixed sketch can also be generated offline; it does
not accept USB settings unless universal support is enabled. The canonical reference
sketch retains its previous head/jaw defaults: disable mouth for audio-free use.

### Optional mouth setup · limited

Skip this whole subsection unless you explicitly enable mouth routines in the
collapsed section at the bottom of Studio. Playback can interrupt motors, replace
eyes/colors and delay other scheduled requests. Clip-end timing is estimated.

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

Only mouth routines require the per-device `MOUTH_FILE_SERIAL`, the **stored MP3 file number** reported by the web controller. The original test unit used #12, but others might differ. If your prop has been renamed and advertises a different BLE name, update the Studio name or `SKELLY_NAME` as well.

## 4. Check the first connection

After either installation method, power Skelly in Bluetooth mode and disconnect
other BLE controllers. Confirm actual behavior visually; firmware installation,
USB read-back and BLE write acceptance are separate from physical movement.

### After flashing: first connection

Most ESP32 boards restart automatically after a successful upload; the normal controller then begins scanning. **On the original test setup, manually turning the ESP32 off and back on sometimes appeared necessary before it connected.** If the scan or connection doesn't begin:

1. Power on Skelly and close/disconnect the official app and web controller.
2. After the upload completes, press **EN/RESET** on the ESP32, or unplug and reconnect **ESP32 USB power** (not Skelly's power).
3. Reopen Serial Monitor at **115200**, looking for `Scanning for Ultra Skelly v2...`, `Found Skelly by advertised name.`, and `CONNECTED`. The controller does not log device addresses.
4. Give it time: each scan lasts approximately **5 seconds**; startup targets scan starts every **5 seconds** for the first minute or until first success (scanning time counts toward the interval). Later unsuccessful scans/connections wait roughly **30 seconds** before retrying. Both settings are configurable in Studio.
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

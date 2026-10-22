# USB diagnostics, offline clock and fixed-profile installation

These tools are software-tested; physical USB capture/flashing and the new
firmware options have not been exercised on the prop. They do not resolve the
intermittent serial corruption by themselves. All original motor defaults and
cooldowns remain unchanged. Boot marker: **usb-scheduler-v3**.

## Capture original bytes

Open `studio/usb.html` in desktop Chrome/Edge from the local repository or HTTPS
site. If Web Serial is unavailable, the page explains that and opens no port.
Close Arduino Serial Monitor, choose **Connect ESP32 USB · 115200**, then explicitly
choose the board's port. Opening a port can reset some boards; this tool does not
toggle DTR/RTS itself or automatically connect on page load.

The page retains the first 2 MiB of UART input, counts any excess, and displays
only a recent text excerpt. **Save original bytes** preserves every captured
byte, including malformed UTF-8 and NULs. The decoded text and summary are useful
for reading, not substitutes for the binary when diagnosing corruption. A UTF-8
replacement character does not identify the cause or prove a particular byte was
sent. Disconnect closes the reader/port; reconnect starts a fresh capture, so save
first. Nothing is uploaded or saved to browser storage.

An independent terminal comparison is available without changing the sketch:

```sh
python -m pip install pyserial==3.5
python scripts/capture-serial.py --port COM3 --seconds 240 --output serial-comparison.bin
```

Replace COM3 with the actual port. The optional tool reads at 115200 and writes
original bytes without commands. Output files use exclusive creation. It stops
after the requested time, Ctrl+C or about 64 MiB; opening USB can still reset a
board despite requesting inactive DTR/RTS. Keep the same cable, power, sketch and
settings across terminals. The clean serial-only idle result remains a comparison,
not proof that USB/UART, BLE or audio caused the intermittent controller issue.

## Optional clock windows

In Studio's Advanced section, enable a clock window, choose local start/end times
and days, then compile/upload that sketch. Clock windows are **OFF by default**.
After every boot/reset, new routines stay paused until you explicitly set time.
Connect USB tools; if the READY line was missed, choose **Identify USB clock
support**. It sends only `SKELLY HELLO`. Once the firmware advertises support,
choose **Set controller clock from this computer** and look for `USB TIME accepted`.
Sending a value is not a prop-response confirmation.

The USB protocol accepts `SKELLY TIME <10-digit-local-civil-seconds>` within
2024–2099. The browser derives local civil time from the computer's clock/offset.
Input is bounded to 63 printable characters with a 64-byte processing budget per
loop; malformed/overflowed lines cannot set time or start a motor. No time is
restored from profiles, NVS, the network or RTC after boot. Time continues while
powered and the loop is serviced, including normal millis wrap. Set it again for
DST/timezone changes or clock drift; it is not a battery-backed precision clock.

Start is inclusive, end exclusive. For an overnight Friday 22:00–02:00 window,
Saturday 01:00 belongs to Friday. Equal start/end is rejected. Outside the window,
new routines and pending motor follow-ups do not start; already-started motion
can finish, and playback eye/light restoration may complete. This does not send
a physical stop command or necessarily turn off the prop's stored lights. Opening
a window schedules fresh intervals rather than replaying overdue requests.

## Fixed head-only USB installer

The `Build head-only USB installer package` Actions workflow creates a downloadable
artifact, not a release or deployment. It uses Arduino-ESP32 3.3.12, the original
ESP32 target and a fixed profile: head every 120–240 seconds; jaw/arm/torso/eyes/
lights/clock/fairness/notification experiments OFF. The package contains a merged
4 MiB image, `manifest.json` and `build.json` with commit/source/binary hashes.

Download the artifact from your reviewed commit, extract it, and select `build.json`
plus `head-only.bin` on USB tools. The page checks profile, chip, core, length,
image headers and SHA-256 before offering the installer. Hash matching detects a
mixed/damaged package; it does **not** authenticate its publisher. Use a build you
reviewed. The firmware package is read locally, not uploaded to a server.

Actions artifacts are a maintainer preview channel and require GitHub sign-in to
download. They are not an account-free public release. The source/Arduino route
and locally compiled packages require no account. Public, durable release assets
can be published after review; this work does not publish a firmware release.

Close the capture connection. Confirm the overwrite/preview notice. Loading the
installer fetches pinned **ESP Web Tools 10.2.1** from unpkg; this optional action
needs internet/HTTPS or a supported secure localhost origin. The configurator and
serial capture load no CDN scripts. ESP Web Tools selects the supported chip family
from the manifest; only **ESP32** is offered, not C3/S3/ESP8266. Installation can
overwrite firmware and erase ESP32 data, so keep your working source/settings.
No account, prop Wi-Fi, backend compiler or paid service is introduced.

Custom Studio settings still generate a self-contained `.ino` and need Arduino
IDE/CLI. The installer does not compile that source or transfer its settings.
Changing persistent settings over USB without recompilation remains future work.

Primary references: [Web Serial lifecycle](https://developer.chrome.com/docs/capabilities/serial),
[ESP Web Tools manifests and merged images](https://esphome.github.io/esp-web-tools/),
[upstream BBC6 observation fields](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/protocol-parser.js).

## Optional fair turns and playback estimates

Fair turns stays OFF by default. With protection ON, after jaw playback one due
standalone/compound body request can take a turn before another due jaw clip.
The normal overdue-body selection and all cooldowns still apply. It does not
override jaw-first recurrence or the failed HEAD-after-jaw diagnostic. Host tests
reproduce starvation with short jaw intervals, restoration and coarse loop service;
they are not a measured physical starvation report. Fair turns need an attended
run before relying on them.

Default playback remains 21 seconds. You can increase the fallback estimate and
enter per-file estimates for selected clips (`13:24,14:30`), including padding.
Estimates are 21–120 seconds; pools use the selected file's value, with the fallback
for unmapped files. A longer estimate can delay routines but does not create a
playback-end signal. Measure the clip; do not assume 21 seconds covers a longer file.

Passive AE02 playback observations are separately OFF by default. The bounded
queue copies only BBC6 serial/playing/raw-duration/length metadata; it drains text
in the main loop, never prints binary buffers and never changes any timer. Short,
oversized or malformed status frames are ignored; CRC, exact length, duration
units and natural-EOF behavior are not established. Missing AE02 retains the
model. Disconnect clears the queue. These observations prepare protocol research;
they are deliberately not authoritative playback-end control.

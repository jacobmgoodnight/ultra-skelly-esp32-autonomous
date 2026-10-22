# Reddit launch drafts — customizable autonomous routines

These are alternatives, not a posting sequence. They emphasize customizable
recurring schedules. Here, **scheduled** means fixed/randomized intervals after
connection, not clock/calendar times. Use the applicable r/ESP32 AI flair when
posting a substantially unchanged draft. Do not paste generated text into
communities that prohibit it. See [owner requests and comparison evidence](community-demand.md).

### Recommended — r/ESP32

**Title: I wanted my Ultra Skelly's head to move on its own every few minutes, so I built an ESP32 controller**

I wanted my Ultra Skelly v2 to look alive between visitors: an occasional head
turn, a little jaw movement, and my own timing rather than starting each routine
on a phone or waiting for a sensor trigger.

So I built a small ESP32 BLE controller and a browser configurator called Skelly
Studio. Choose which movements you want and how often they should start, download
an Arduino sketch, and flash the ESP32. After setup, the ESP32 runs the schedule
on USB power. No connected phone, Wi-Fi or account is needed, and nothing is wired
into the prop.

For example, a head-only routine can request a movement every 120–240 seconds.
You can use matching minimum/maximum values for a fixed interval, or a range for
random timing. Other routines and conservative cooldowns can delay a start.

Optional settings add jaw clips you've uploaded to the prop, arm/torso movement,
eye changes, torso/head colors and idle breaks. Settings can be saved to JSON,
and the sketch generator works offline from a downloaded copy.

The useful difference from manual DecorPro operation or stock sensor triggers
is that the ESP32 repeatedly sends your chosen commands on your chosen intervals.
The stock sensor has its own active-window timer; this is a separate recurring
routine. It doesn't add clock-time scheduling or simultaneous app/sensor control.

This is a free, MIT-licensed hobby project tested on one **6.5-foot Ultra Skelly
v2 with an original ESP32-WROOM**, not a compatibility claim for the 12-foot
app-controlled Skelly. You'll need Arduino IDE/CLI for the initial upload. Some
combinations and long unattended runs still need hardware testing; intermittent
serial corruption is still under investigation. The Subtle preset is a head-only
starting point.

- [Source and setup](https://github.com/jacobmgoodnight/ultra-skelly-esp32-autonomous)
- [Skelly Studio](https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/)

Thanks to martinecker's Skelly Ultra Web Controller for the protocol and MP3
upload groundwork. If you've wanted occasional independent head movement too,
I'd appreciate feedback on the setup and interval controls. Another-device
reports, bug reports and contributions are welcome on GitHub.

### Short and casual — alternative r/ESP32 post

**Title: Custom head turns every few minutes, without babysitting my Ultra Skelly's app**

I wanted my Ultra Skelly v2 to move occasionally on its own, without tapping a
phone button each time or waiting for someone to trigger the sensor.

I built an ESP32 controller that runs custom recurring routines. Pick the moves
and intervals in a browser, download an Arduino sketch and flash the board. A
simple starting point is head-only movement every 120–240 seconds; fixed or
randomized intervals are supported. The ESP32 keeps the schedule going on USB
power with no connected phone, Wi-Fi or account.

[Code and setup](https://github.com/jacobmgoodnight/ultra-skelly-esp32-autonomous)
· [Studio](https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/)

Free/MIT. Tested on one 6.5-foot Ultra Skelly v2 and an original ESP32-WROOM.
You'll need Arduino IDE/CLI for setup. This schedules intervals, not clock times;
advanced combinations and long runs still need testing, and occasional garbled
serial output remains unresolved.

If that sounds like the behavior you've been wanting, I'd love setup feedback
or a GitHub bug report. Credit to Skelly Ultra Web Controller for the upload and
protocol groundwork.

### Technical/open-source — alternative r/ESP32 post

**Title: Custom recurring Ultra Skelly routines on ESP32: interval scheduling without a phone or sensor trigger**

I wanted my Ultra Skelly v2 to perform occasional head and jaw routines without
manually starting each animation in a phone app or depending on a sensor trigger.
That became an Arduino-ESP32 BLE client plus a static browser configurator.

You choose enabled movements and their minimum/maximum start intervals. Equal
values request a fixed interval; a range randomizes it. After flashing, the ESP32
runs those recurring requests locally, with per-motor cooldowns and protection
against jaw playback interrupting body motion. Scheduling is best effort; safety
locks can delay starts. There is no wall-clock/calendar scheduler.

The default routine uses protected standalone head/jaw operation. Optional
jaw-first arm/torso and compound modes are separate selections. MP3 pools, eyes,
RGB and idle breaks are available, with physical evidence limits documented.

Studio is plain HTML/CSS/JavaScript and generates a self-contained `.ino` from
canonical source. It works offline with bundled eye thumbnails, and exports/imports
settings as JSON. Runtime needs a powered original ESP32-WROOM in BLE range;
there is no Wi-Fi, account, backend or ongoing phone connection. Initial setup
still requires Arduino IDE/CLI, pinned Arduino-ESP32 3.3.12 and your actual
uploaded MP3 serials if using jaw routines.

The test suite executes real firmware C++ with mocked BLE/time, checks packet
CRCs and generator constraints, and compiles representative ESP32 configurations.
The audit follow-up adds cooldown/write-latency, 60-day simulated timer/wrap,
service rediscovery, all-mask and jaw-pool tests. These are software evidence,
not proof of physical endurance. Playback end is still modeled at 21 seconds,
and intermittent serial corruption remains open.

[Repository and MIT license](https://github.com/jacobmgoodnight/ultra-skelly-esp32-autonomous)
· [Try Studio](https://jacobmgoodnight.github.io/ultra-skelly-esp32-autonomous/studio/)

The tested prop is the 6.5-foot Ultra Skelly v2; 12-foot compatibility and
multi-prop show synchronization are not claimed. Credit to Skelly Ultra Web
Controller for the MP3 upload/protocol groundwork. I'd welcome another-device
reports and scheduler/reconnect feedback, with physical observations reported
separately from accepted BLE writes.

### Alternative titles

1. **I wanted my Ultra Skelly's head to move on its own every few minutes, so I built an ESP32 controller** — recommended: directly answers the clearest owner request.
2. **Custom Ultra Skelly routines: choose the movements and timing, then let an ESP32 run them** — emphasizes customization and autonomous operation.
3. **Ultra Skelly on your schedule: recurring head and jaw routines without a connected phone** — concise; clarify interval scheduling in the opening.

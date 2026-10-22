# Public launch review — October 21, 2026

Review branch: `codex/public-launch-audit`. This report records the original local
audit and follow-up. The owner subsequently authorized updating GitHub; the changes
are being submitted for review. No merge, release, firmware deployment, visibility
change or Reddit submission is included.

## Current follow-up status — October 21, 2026

The owner requested implementation of actionable audit items and clearer
customizable/scheduled/autonomous positioning. The firmware now retires elapsed
cooldowns during normal loop service, anchors body timers after BLE calls return,
forces service rediscovery on reconnect, and rejects incompatible compound/jaw
configuration at compile time. New C++ tests cover those paths, all compound masks
and all jaw-pool choices. This is **Software-only**; no new physical pass is claimed.
See [audit follow-up](audit-follow-up.md) for current validation and attended criteria,
and [community demand](community-demand.md) for linked owner requests and the
supported comparison with DecorPro/sensor mode. Initial findings/results below
are retained as the pre-follow-up audit snapshot, not the current fix status.

## 1. Project overview

**Ultra Skelly ESP32 Autonomous Controller**, with the **Skelly Studio** browser
configurator, lets Home Depot Ultra Skelly v2 owners schedule movement without
keeping a phone connected. A USB-powered original ESP32-WROOM discovers the prop
by its advertised BLE name, then sends local commands. No wiring to the prop,
Wi-Fi network, account, API key, backend or subscription is required.

Studio is plain HTML/CSS/JavaScript hosted on GitHub Pages. It generates a
self-contained Arduino `.ino` from the canonical C++ sketch; it does not compile,
flash, upload MP3s or remotely control the prop. Users need Arduino IDE/CLI and
the pinned Arduino-ESP32 **3.3.12**, board **ESP32 Dev Module**. Jaw preparation
uses the separately maintained community web controller, a compatible Web
Bluetooth browser, stored MP3s with body flags **0x00**, and the actual file
serials from the user's prop. Silence uses the physical volume knob.

The strongest reasons to try it are autonomous operation after setup, no prop
wiring, randomized head/jaw timing with conservative motor protection, optional
arm/torso/eyes/RGB, a device-specific jaw clip library, and portable JSON settings.
Generation works offline from an extracted ZIP; external eye thumbnails do not.
There are no npm runtime dependencies. Python and a C++17 compiler support tests;
Python plus ffmpeg can synthesize two additional jaw clips. Original code,
documentation and synthesized audio have an MIT license. Hardware is not included.

Compared with the credited [Skelly Ultra Web Controller](https://martinecker.github.io/SkellyUltraWebController/),
the useful distinction is scheduled operation on a dedicated ESP32 after setup.
The upstream controller remains part of MP3 preparation. This review does not
establish superiority over every commercial or community controller.

## 2. Launch readiness score

**7/10 for a clearly labeled hobby preview.** The narrow use case is useful, the
static site is reachable, licensing/setup/evidence documentation exist, and the
project has substantial automated coverage. The local generator and setup fixes
make first use more reliable. It is not ready to promise arbitrary device
compatibility or indefinite unattended operation.

The score is limited by one-prop evidence, unresolved intermittent serial
corruption, modeled playback completion, incomplete integration/endurance work,
and the two timing limitations reproduced below. New physical testing was not
performed during this audit. Existing results come from the verification matrix.

## 3. Repository audit

### Critical before promoting the reviewed revision

- **Verified, fixed locally: invalid dormant controls could generate broken C++.**
  For example, disabling jaw playback allowed malformed extra serials through
  validation, while the generator still emitted the file pool (`NaN` in C++).
  Disabled numeric/color/compound settings had similar validation gaps. Validation
  now checks every emitted setting's type and bounds; download fails closed.
- **Verified privacy hygiene issue, fixed in the working tree:** an experiment
  log contained a real device address, and all three BLE experiment sketches
  printed addresses. The historical excerpt is redacted and diagnostics now log
  discovery by name. Old commits can retain the old address. No history rewrite
  was attempted; this change is not a claim that previous copies were erased.
- Review and publish the local fixes through the normal reviewed process before
  advertising them as deployed. The live site still represents the published
  revision, not this working tree.

### Recommended

| Finding | Evidence and practical consequence | Next step |
| --- | --- | --- |
| Stale inactive motor deadlines at the signed half-range | **Software-reproduced:** actual canonical C++ with mocked BLE/time defers a due jaw after `2^31` ms (~24.9 days) since unchanged inactive arm/torso deadlines. This can affect the default continuously connected routine. | Use explicit active cooldown state or safely expire timestamps; add multi-week behavioral tests and attended regression before claiming indefinite operation. |
| Motor timing starts before BLE write completion | **Software-reproduced:** a simulated 5-second blocking write leaves only 27 seconds of the head's 32-second model after return. Head/arm/torso/compound timers use the earlier argument; jaw already refreshes time after its write. Actual device latency and physical impact are unmeasured. | Anchor body cooldowns to completion conservatively in a focused firmware PR, with blocking-write tests and attended motor/jaw checks. |
| Cached service/characteristic lifecycle | **Potential concern:** client reuse and `getService` do not establish fresh service discovery on every reconnect in the pinned stack. Mock services always succeed, so host tests do not prove real rediscovery or heap stability. | Test missing services, stale handles and repeated real reconnects before a lifecycle change. |
| No actual MP3-end feedback | **Verified design limit:** the 21-second estimate controls jaw protection, eyes and RGB recovery; AE02 is not subscribed. Longer clips can outlast the model. | Keep clips within the model, or increase it conservatively; investigate notifications separately. |
| Broad combinations lack physical coverage | **Untested:** recurring compounds, mode-2 RGB, eye recovery and full mixed routines are not all physically established. Jaw-first HEAD **failed** at 2 and 10 seconds. | Retain OFF defaults and separate modes. Use the existing attended test cards for the selected combination. |
| Intermittent serial corruption | **Verified historical physical report:** clean jaw/pool excerpts and the clean serial-only test do not resolve later corruption. | Capture original bytes in a second terminal with unchanged firmware/settings. Do not attribute a cause from replacement characters. |
| Compound/body fairness at very frequent jaw rates | **Potential concern:** due jaw playback suppresses body dispatch, and lighting can extend the effective clip cycle. Boundary rates can starve movement. | Add timestamped executable fairness/cooldown tests; do not promise all configured start intervals will be met. |
| Deterministic host coverage | **Verified test limit:** the random stub selects fixed values; attended harnesses check permitted commands and cancellation, but do not exhaust randomized masks/pools or assert every motor's start spacing. Scan and service stubs also omit real failure modes. | Add controlled selection sequences, timestamped dispatch assertions and explicit scan/service/characteristic failures when addressing scheduler/reconnect work. |
| Template substitution maintenance | **Verified architecture:** source-text anchors and generated code injections require coordinated edits. | Keep drift/anchor/compile checks; consolidate configuration metadata incrementally. |
| First-time audio availability | **Verified:** two named clips are generated or obtained from expiring Actions artifacts; visitors cannot necessarily run maintainer workflows. | Publish reviewed MP3s as durable release assets. The included chatter MP3 and local generation are available now. |

The two timing reproductions are audit probes under ignored `.skelly-build/`, not
new passing regression tests asserting that the defective behavior is desirable.
They are software evidence only. Firmware scheduling was preserved for review and
physical regression work.

### Security and privacy

No obvious embedded API credentials, tokens, Wi-Fi passwords, account flows,
application telemetry, server data store, `eval`, or HTML injection sink was found
in the current application source. Settings are explicitly downloaded/imported;
imports have a 64 KB cap, schema/type checks and validation before application.
Generated device-name strings are escaped. A heuristic source review is not a
forensic secret scan of all historical commits.

GitHub Pages and upstream thumbnail requests disclose normal web request
information to their hosts. Profiles contain clip mappings and a Bluetooth name;
review them before attaching to issues. BLE discovery by name and CRC are not
cryptographic device identity or authorization. Nearby identical/spoofed names
are not disambiguated by a secure pairing flow in this application. No remote
internet control surface or Wi-Fi credentials are configured by this sketch.

No applicable dependency vulnerability was established. The checked official
[Arduino-ESP32 release information](https://github.com/espressif/arduino-esp32/releases)
identifies 3.3.12 with ESP-IDF 5.5.5. The published
[WebServer authentication advisory](https://github.com/espressif/arduino-esp32/security/advisories/GHSA-w887-pg2w-mfj2)
concerns a component this sketch does not use. Other
[upstream advisories](https://github.com/espressif/arduino-esp32/security/advisories)
and [ESP-IDF vulnerabilities](https://github.com/espressif/esp-idf/blob/master/docs/en/security/vulnerabilities.rst)
still need component/version applicability review over time; this is not a clean
bill of health for the entire compiled SDK. Keep the tested pin until upgrades
are reviewed. CI has read-only contents permissions and no `pull_request_target`
execution path; Actions use mutable version tags, so SHA pinning is a useful
supply-chain improvement.

### UX, organization and optional enhancements

Desktop and a 390×844 viewport were inspected in the browser. The mobile page
fits horizontally, sections fold, controls have labels/focus styling, errors use
an alert, and reduced-motion styling exists. Invalid disabled jaw settings block
download in the actual UI; valid settings recover and open the generated preview.
The code dialog now has an explicit accessible name. A full screen-reader audit,
iOS/Safari testing, touch testing and all browser/OS combinations remain untested.

Presets previously retained incompatible jaw-first coordination from earlier
settings. Normal/Subtle now reset that mode and restore MP3 protection. They
remain starting points, so appearance/library preferences can remain customized.

Repository organization is clear, generated/native output is ignored, and no
checked-in build binaries were found among the source files. The MP3 is an
intentional asset. Optional additions: rendered documentation navigation,
thumbnail failure feedback, explanatory empty-state guidance for clip mappings,
headless browser smoke tests, a changelog, durable release packages, and a real
prop demonstration. Browser USB flashing and playback notifications are future
work, not current capabilities.

## 4. Changes made and validation

- `studio/app.js`: validates emitted dormant controls; type checks malformed
  settings; resets incompatible jaw-first state in Normal/Subtle presets.
- `studio/tests/generator.test.cjs`: three regression tests covering dormant
  values/types, missing/duplicate template anchors and preset transitions.
- `studio/index.html`: regenerated app cache version; named code-preview dialog.
- `README.md`: audience, requirements, feature overview, actual screenshot,
  head-only first try, offline steps, privacy and bug-report guidance.
- `CONTRIBUTING.md` and `.github/ISSUE_TEMPLATE/`: reproducible development and
  focused bug/feature forms separating physical observations from logs.
- `docs/setup.md`: current log text and protected head/jaw sequencing.
- `docs/architecture.md` and `docs/hardware-verification.md`: record the two
  reproduced software timing limits without adding physical claims.
- `docs/compound-body-and-lighting.md`: corrected a claim of fully field-proven
  recurring operation to the actual dispatch/individual-pair evidence.
- `docs/experiments.md` and the three BLE experiment sketches: address redaction
  and address-free discovery logging; no motor packet/timing changes.
- `.github/workflows/studio-checks.yml` and `docs/testing.md`: cover changes to
  all experiment sketches and compile the previously omitted arm/eye diagnostics.
- `audio/jaw-personalities.md`: direct included MP3 link and accurate artifact/
  workflow permission guidance.
- `docs/images/studio-desktop.jpg`: actual local Studio screenshot.
- This report: findings, launch guidance and post drafts.

The initial audit left canonical firmware unchanged. The follow-up now updates
firmware and regenerates its embedded template; see the current follow-up status
above and [regression procedure](audit-follow-up.md). No new hardware result is
claimed. Initial validation results are retained below for chronology.

## 5. GitHub recommendations

Suggested description:

> Custom autonomous routines for Ultra Skelly v2 on ESP32. Schedule movement at your own intervals with an offline-capable browser configurator. No Wi-Fi, phone or account required after setup.

Suggested topics: `esp32`, `arduino`, `bluetooth-low-energy`, `halloween`,
`animatronics`, `home-depot`, `skelly`, `javascript`, `github-pages`, `open-source`.
Public metadata currently has an empty description/topics. Do not change it or
publish a release until the maintainer approves.

The README now has a real Studio screenshot. Add a short real-device video showing
a standalone head cycle, silent jaw, and a separately labeled jaw-first arm/torso
pairing. Show setup hardware and disclose the tested revision/settings. Do not
substitute an illustrative schedule for evidence of movement.

Use a hobby-preview prerelease with known issues, supported board/core, source
ZIP, settings examples with clearly device-specific clip IDs, durable synthesized
MP3 assets and SHA256 checksums. Confirm a fresh extracted ZIP can generate and
compile on another computer. Link a successful smoke-test run for the exact
release revision; a successful Pages deployment does not establish firmware QA.

## 6. Reddit communities, ranked

Rules were checked from community pages on October 21, 2026. They can change;
read the live rules and composer/flair requirements before submitting. These are
candidate destinations, not a recommendation to post everywhere.

| Rank | Community and fit | Format and restrictions |
| --- | --- | --- |
| 1 | [r/ESP32](https://www.reddit.com/r/esp32/) — best practical first launch: direct ESP32 BLE engineering and project-sharing audience. | Detailed text with source, setup, a useful engineering observation and optional real demo. Rule 7 limits a project to one post per quarter; participate in replies and avoid excessive cross-posting. The page announces AI flair for posts/code primarily generated by AI; apply it when using these drafts substantially. |
| 2 | [r/HalloweenProps](https://www.reddit.com/r/HalloweenProps/) — strongest end-user fit; actual Ultra Skelly posts exist. | Real prop photo/demo plus a self-contained build explanation; DIY/Homemade flair is visible. Must concern props; no paid-content sharing or reposts. Rule 5 requires human-generated posts/comments. **Do not paste these generated drafts there; write your own account or clarify assistance rules with moderators.** No explicit free-software promotion exception was established. |
| 3 | [r/arduino](https://www.reddit.com/r/arduino/) — approachable Arduino/ESP32 build audience. | Descriptive project post with board/core/source and the engineering lesson; use the applicable project flair. No bare promotional links, commercial channel spam, URL titles or drive-by posting. The rules reject do-my-project requests; share what you made and answer questions. |
| 4 | [r/diyelectronics](https://www.reddit.com/r/diyelectronics/) — readers interested in making an existing prop autonomous. | Text/photos and explanation of the external BLE controller. Video submissions are usually disallowed; purchase/crowdfunding/store promotion and cross-linking questions for visibility are prohibited. A free GitHub build is a plausible fit, not a blanket self-promotion exemption. |
| 5 | [r/ArduinoProjects](https://www.reddit.com/r/ArduinoProjects/) — project showcase, includes Arduino-programmed ESP32. | Describe the actual build in the post; no link-only submission, product promotion or collaboration/help solicitation. Rule 1 specifies projects made by the poster rather than AI or someone else. Suitability depends on actual authorship; clarify if needed. A pinned notice also addresses minimum text/no cross-posting. |
| 6 | [r/opensource](https://www.reddit.com/r/opensource/) — licensing, offline tooling and contributor interest, but fewer prop owners. | Requires an OSI license (MIT qualifies), Promotional flair for project sharing, no excessive self-promotion or drive-by posting. Rule 3 rejects all AI-generated content. **These drafts are not suitable to paste there.** Only consider a human-authored post that follows the rules. |
| 7 | [r/Halloween](https://www.reddit.com/r/halloween/) — broad seasonal owner audience, restrictive promotion rules. | No main-feed app/site promotion; use the current self-promotion megathread if eligible. AI-generated text is prohibited in posts and comments. October accounts must be at least two weeks old. **Write your own comment; these drafts are not suitable there.** |

The strongest end-user community has a generated-content restriction, so the
recommended copy-ready draft below targets r/ESP32. None of these rules should
be worked around with near-identical cross-posts or undisclosed authorship.

## 7. Reddit posts

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
canonical source. It works offline except for eye thumbnails, and exports/imports
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

## 8. Final launch checklist

- [ ] Review the local diff; approve any commit/push/release separately.
- [ ] Publish only the reviewed revision and wait for its complete smoke-test CI,
      not just Pages deployment. Recheck the published generator/cache URLs.
- [ ] Confirm a fresh download works outside this development environment with
      the documented board/core and a real user's file serials.
- [ ] Keep experimental defaults OFF and disclose one-prop evidence, serial
      corruption, 21-second playback modeling and unverified hardware endurance.
- [ ] Complete the focused timing/reconnect regression in
      [audit follow-up](audit-follow-up.md), plus the existing short attended card
      for whichever advanced combination you intend to demonstrate.
      Pass means complete expected movement, expected
      eyes/colors and no interruption/reset/unexpected activation. Log writes alone
      do not pass. No need to repeat already completed isolated tests.
- [ ] Capture an authentic demonstration and remove addresses/private information
      from profiles, screenshots and logs. Current redaction does not erase history.
- [ ] Add description/topics and a hobby-preview release with durable MP3 assets
      only after approval. Confirm upstream assets/credits retain their terms.
- [ ] Start with one suitable community, follow current flair/authorship rules,
      and remain available to answer questions. Do not paste these drafts into
      communities prohibiting generated text or mass-post identical content.
- [ ] Track physical timing/reconnect regression separately from the passing
      software tests. The local firmware corrections do not establish a physical pass.

### Initial audit validation record — before the firmware follow-up

- **PASS:** JavaScript syntax, canonical/template synchronization and asset cache
  version checks.
- **PASS:** all **38 Node tests** (35 baseline plus three added regression tests).
- **PASS:** native firmware runner with MSVC C++17: six canonical/generated
  restore-mode executables, one serial-idle executable and 18 attended/quick
  executables, with mocked BLE/time. These are 25 host executables, not physical
  tests.
- **PASS:** packet CRC vectors in `tests/test_packets.py`.
- **PASS:** **50 Arduino-ESP32 3.3.12 compilations**: canonical firmware, all
  **27** generated matrix cases, all **four** isolated diagnostics, **11** attended
  and **seven** quick sketches. Generated/diagnostic/pack sources used a fixed
  scratch sketch to reuse compiled libraries; per-source SHA256 results are saved
  locally in ignored `.skelly-build/launch-compile-results.json`. Canonical was
  compiled directly from its own sketch directory. No firmware was uploaded.
- **PASS:** all 27 valid matrix sketches are byte-identical to output from the
  pre-audit generator, preserving valid configuration behavior. Baseline probes
  independently reproduced the malformed disabled jaw pool and preset bug.
- **PASS:** an isolated source ZIP extraction runs all 38 Node tests and the
  template/asset checks without `.git` or installed application packages. This
  is still the same computer/toolchain, not independent-machine validation.
- **PASS:** browser checks of hosted load, local validation/recovery, code preview,
  a complete **41,194-character `.ino` download**, and 390×844 horizontal fit.
  The README screenshot is an actual local desktop capture. Full screen-reader
  and cross-browser/device testing remain open.
- **PASS:** 83 relative documentation/HTML targets resolve across 25 Markdown/HTML
  files. All 33 checked project/upstream external URLs, including 18 eye images,
  returned HTTP 200. Community rules/advisory sources were researched separately.
- **PASS:** current-tree heuristic credential/address scan found no matches among
  65 tracked/new source and asset files (binary assets excluded from text scanning).
  No all-history secret-scan guarantee is implied. `git diff --check` is clean.
- **PARTIAL:** both synthesized PCM inputs have the expected 20-second/8 kHz mono
  float32 length. ffmpeg/ffprobe were unavailable on PATH, so MP3 regeneration and
  encoded metadata verification were not rerun locally.
- **DEPLOYMENT:** public repository, Studio, Issues and upstream setup links were
  reachable. Public metadata reports `main`, Pages enabled and Issues enabled.
  The observed Pages deployment succeeded; two observed smoke-test runs were
  still in progress at inspection. This branch has not been committed or pushed,
  so no remote CI run validates these local changes yet.
- **OPEN:** the two C++ timing probes reproduce limitations described above;
  neither is fixed by the generator changes. No new motor/LED/BLE endurance result
  was obtained.

Local verification used Node **24.21.0**, Python **3.12.14**, MSVC C++17 and the
installed pinned ESP32 core. CI is configured for Node **22**; its final result
for an eventual published revision still needs checking.

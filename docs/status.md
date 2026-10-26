# Current feature status

Release **2026.10.24-preview.2** · firmware revision **5**, build **2026102402**.
This page is the current overview. Dated experiment logs and archived roadmaps
retain their historical statements. The [hardware matrix](hardware-verification.md)
records physical evidence; the [changelog](../CHANGELOG.md) records software releases.

| Feature | Available | Evidence / remaining work |
| --- | --- | --- |
| 2026 app-controlled 12-foot compatibility | Advanced, explicit opt-in | Experimental — Not Hardware Tested. Head, eyes 1–20 and chest RGB only; audio/jaw, arm, torso and compound disabled. [Volunteer checklist](experimental-12ft.md). Ultra remains the default. |
| Autonomous head, arm and torso; fixed/random eyes | Yes | Individual behaviors owner-confirmed on one 6.5-foot Ultra Skelly v2 / original ESP32-WROOM; no new endurance claim. |
| Combined body commands | Yes, optional | Owner confirms combinations/random combined movement; newer interleaving and extended durations remain separately unconfirmed. Separate-command overlap failed and stays removed. |
| Lighting effects, custom palettes and rotation | Yes | Owner confirms effects and palette rotation; exact channels/speeds and new audio integration are not all enumerated. |
| Studio scene editing and local draft recovery | Yes | Earlier focused checklist owner-reported pass. Simplified eye/lighting controls, compact lighting sample in Your Skelly, scoped looks/copying and palette drafts have Software-only browser coverage; no new hardware result. |
| Universal USB connection/read/save | Yes | Owner confirms connection, reads, changed settings and observed changed routine. Power-cycle retention, recovery and physical scene transitions remain unconfirmed. |
| Firmware identity and modeled activity/wait | Yes, revision 5 | Read-only additions adapted from PR #35, tested in software. Older firmware remains usable and may report no version/activity. These values never confirm actual motion or natural audio completion. |
| Browser firmware installer | Recommended first-time setup | Public versioned, hash-checked universal package; no manual Actions download/account. Physical flashing/recovery Untested. [Setup/checklist](browser-installation.md). Arduino is an advanced fallback. |
| Offline clock windows | Advanced, experimental | USB-set time only; invalid after every restart, no retained clock, automatic DST or lights-off action. Physical checks pending. |
| Audio scenes and local audio preparation | Advanced → Audio scenes, experimental and optional | OFF in ordinary presets. Local trim/mono/8 kHz/32 kbps conversion, computer preview, upload and metadata read-back have software checks only. Real uploads, stored motor masks, exclusive playback/restoration and recovery remain Untested. |

## Install versus save

Install universal firmware once, then **Connect ESP32 → Read saved settings → Save
this routine / Save scene collection** for ordinary changes. Reinstall only to upgrade controller
software or recover it. A generated `.ino` is source and requires Arduino IDE/CLI;
the browser installer consumes a compiled, hash-checked package. It does not
compile a sketch. Source downloads include the release and timestamp; packages
include full source commit, source/image hashes and release identity.

Core editing, generation, bundled eyes and audio conversion can work offline from
the complete Studio folder in a compatible browser. First-time toolchain setup
and browser firmware package/library downloads need internet. No cloud receives audio,
profiles or USB commands. No Wi-Fi, account or ongoing browser connection is
required for the ESP32 to run its saved routine.

## Remaining checks

Use the [short next-check list](next-release-checklist.md). Do not repeat completed
Studio/lighting/USB read-save checks as new discoveries. Audio is optional; ordinary
routines remain usable while its checks are pending.

Known limits: conservative estimated completion rather than motor/EOF telemetry;
one to four saved scenes; scene changes can wait for active work and reconnect;
audio serials belong to the prop's current file list; browser labels are not
stored on the ESP32; original serial text corruption is not assigned a root cause.
Phone/BLE wireless diagnostics from draft PR #35 are not included or enabled.

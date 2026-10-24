# Optional audio scenes — preview and attended result sheet

Status: **Software-only / physically Untested**. No device was flashed, no real
Bluetooth upload was performed, and no new motor/eye/light result is claimed.
Existing isolated jaw and lighting confirmations retain their previous scope.

## Workflow

1. Export your current Studio settings. Leave ordinary presets audio-free.
2. Unplug ESP32 power, close Studio's USB session and disconnect phone/web
   controllers. Power Ultra Skelly v2 in Bluetooth mode.
3. Open **Audio scenes · optional preview** and connect directly to the advertised
   Skelly name. This is browser → Skelly BLE, not browser → ESP32 USB.
4. Select a stored file or upload a newly named, prepared **8 kHz, mono, 32 kbps
   MP3**, up to 118 seconds and 1 MiB. Studio checks complete MPEG-2.5 Layer III
   frames and derives a minimum 21-second padded estimate. Other formats require
   prior conversion; automatic conversion is not included. One local example is
   `audio/Jaw_Idle_Random_20s_v2.mp3` (silent jaw, not a spoken greeting).
5. Edit the selected clip's stored head/arm/torso flags, fixed eye, both channel
   colors, brightness, effects, speed and color cycling. Save its look and require
   **read-back verified** before continuing. Unsaved clip edits block Use clip in
   routine and reopen the clip look controls; they are never silently ignored. These are per-file settings; ordinary
   routine controls remain separate. Copy current eyes & lighting fills the form
   without sending anything. Saved head flags are a different path from the
   physically failed head-after-jaw command, and still need their own observation.
6. Enter a conservative estimate including padding. Uploaded files supply a
   measured minimum; stored files need your own duration measurement. Choose
   request intervals (60–3600 seconds), then **Use clip in routine**. This changes
   only the editor. It enables the selected regular eyes/lighting for restoration,
   full body protection and fair body turns, and disables overlap and jaw-first
   follow-ups. Scene cards and timing tracks identify the audio file/action.
7. Disconnect Skelly here. Power the ESP32 again. Install the updated universal
   firmware once, then use the normal USB Save routine/Save scenes workflow.
   Older firmware lacks `audioScenes=1`; Studio reveals setup and blocks the save.
   A generated standalone sketch also supports the option.

No audio playback button or destructive file management is included. Uploads use
new names and reject case-insensitive collisions. Studio never deletes or replaces
stored audio. Cancel disconnects the GATT link; a partial upload may remain and
must be inspected after reconnecting. Failed transfers never auto-replay a file.
Adding/deleting files in another controller can renumber serials. Reconnect,
reselect the correct clip and save the routine again after such changes. Firmware
stores the device-specific serial; it does not remotely verify a filename/hash
before each playback. The browser refuses to use a file if the editor Bluetooth
name changed during preparation.

Files/MP3 bytes are not sent to a server or stored in browser profiles. The
browser and its compatible BLE implementation are still required for preparation;
the ESP32 runs independently afterward. Real BLE range/MTU/notification behavior
is not established by mocks.

## Scheduling and compatibility

Mode **3** of the existing eye/playback field is reserved for audio ownership.
It waits for full existing motor locks, then the AAC6 file owns all motor, eye and
lighting actions for its padded estimate **plus the full longest motor cooldown
(currently 35 seconds)**. No routine eye changes, follow-ups or light writes are
sent in that window. Afterward the chosen regular appearance is restored and due
body requests resume. No clock schedule or idle break can cut the protected window
short. A brief BLE reconnect in the same powered ESP32 boot preserves that hold;
physical playback state cannot be recovered after an ESP32 power loss.

Estimates are not natural EOF telemetry. If a clip's real playback/movement exceeds
its padded estimate and settling period, protection is insufficient: stop and
increase the estimate rather than infer completion from a BLE success. Stored
movements, LED regions and synchronized playback require attended validation.

Existing profile v4, scene v1, USB commands and NVS word layout remain unchanged;
this is an additive enum value with an explicit firmware capability check.
Legacy values/defaults retain their previous behavior. Older software/firmware
rejects audio mode 3; export a backup before downgrading. A successful fresh upload
means transfer acknowledgments plus its exact name/assigned serial in a complete
refreshed list, **not** a remote byte-for-byte hash. Settings verification compares
fresh identity, movement, eye and both lighting records. Reply CRC/framing and file
metadata use the upstream protocol as a reference and remain physically untested
in this implementation. Unsupported/malformed/incomplete replies fail closed.

Protocol reference (original implementation, no upstream source bundled):
[transfer](https://github.com/martinecker/SkellyUltraWebController/blob/871efa15ff0dda5e41325b19753dffba4a5c35ee/js/file-manager.js),
[per-file settings](https://github.com/martinecker/SkellyUltraWebController/blob/871efa15ff0dda5e41325b19753dffba4a5c35ee/js/device-settings.js),
[response fields](https://github.com/martinecker/SkellyUltraWebController/blob/871efa15ff0dda5e41325b19753dffba4a5c35ee/js/protocol-parser.js).

## Focused attended pass — not yet completed

Use a short harmless clip at low physical volume; remain near the prop with power
accessible. Start with its saved body flags OFF. Preserve your working firmware.

| Check | Pass criterion | Owner result |
| --- | --- | --- |
| Browser connection/list | Complete own-device list, correct names/serials; no playback | Untested |
| New prepared MP3 | Upload acknowledged and new file listed; other files unchanged | Untested |
| Clip metadata | Read-back matches both channel settings, fixed eye and chosen motor flags | Untested |
| First audio action | Correct clip, eyes and colors; no ordinary commands interrupt it | Untested |
| Return to routine | After estimate + 35 s and restoration, normal eyes/lights and body requests resume | Untested |
| Stored motor masks | Test head, arm, torso separately before combinations; selected motion observed | Untested |
| Cancellation/disconnect | No later browser writes, no false success; reconnect/list recovers | Untested |
| Brief BLE loss | No routine eye/light/motor command before the original hold expires | Untested |
| Saved scenes/retention | Save/read-back verified; check transitions and power-cycle retention separately | Untested |

Stop for unexpected movement, interrupted playback, wrong restoration or a timing
estimate shorter than observed activity. Record physical observations separately
from logs. Existing unrelated refresh checks do not need repetition.

# Hardware verification center — attended result sheet

Copy this sheet for each session and edit it manually. Record **Pass**, **Fail**,
or **Untested** for each row, with observations; leave omitted steps Untested.
A software test, USB read-back, log, or accepted BLE write cannot mark a physical
test Pass. Report firmware revision/build, generated sketch and settings with every
result. Keep personal addresses, visitor recordings and transcripts out of reports.

Date: ______  Prop: Ultra Skelly v2  ESP32 firmware revision/build: ______
Sketch/profile and settings backup: ______  Operator: ______

Before starting, save the current known-good sketch and exported settings. Keep the
prop clear, remain present, and know how to remove power from both Skelly and the
ESP32 (including USB). Stop and remove power for unexpected movement, noise, heat,
or uncontrolled behavior. Reconnect only after it is safe. Avoid changing several
settings at once. Do not upload firmware unless you explicitly choose to.

| Test | Pass requires observing | Result | Notes, timing and version |
| --- | --- | --- | --- |
| Power-cycle retention | Save and read back a recognizable safe routine; power-cycle both devices; read back the same settings and observe the expected routine after reconnect. | Untested | |
| Scene transitions | With two visibly different mouth-OFF scenes, observe each scene and a transition after its hold and current protected work. Record settings and actual appearance/movement. | Untested | |
| Bluetooth reconnection | With an ordinary safe routine, power-cycle Skelly, observe automatic reconnection and the expected routine; repeat three times. Note timing, unexpected replay, resets or failures. | Untested | |
| Stored jaw playback | With body motors OFF and a known device-specific short clip with saved body flags 0x00, observe sound and jaw through the complete clip; record clip ID and actual duration. | Untested | |
| Lighting restoration | In a separate jaw/lighting test, observe chosen colors before and after each of three completed clips; record both colors and any eyes or lighting overrides. | Untested | |
| Return to autonomous | After an interactive/audio session, stop playback, close its Bluetooth clients, reconnect the known-good controller and observe a complete expected routine without unexpected action. | Untested | |
| BLE and Live Stereo coexistence | Complete the separate controlled procedure below, including baseline, concurrent run, interruption and recovery; record audio, jaw, head and connection observations for each. | Untested | |

Prior isolated lighting restoration was reported successful for MP3 #13; this row
tests the particular firmware and integration being assessed, not a global fix.
See [the verification matrix](hardware-verification.md) for existing evidence and
[USB settings and scenes](usb-settings-scenes.md) for detailed save/recovery tests.

## BLE and Windows Live Stereo coexistence — experimental

**Unknown:** classic Windows Live Stereo audio and the ESP32 BLE link may use
different Bluetooth transports, but that alone does not establish that this prop
accepts both links or that audio, jaw and motion coexist safely. The reported
repeat-back and conversation tests in draft PRs #54 and #55 used the ESP32
unplugged; they are not evidence of concurrent operation. Never send a live-enable
BLE setup request while the ESP32 owns the link. Do not add a second BLE controller.

1. Preserve the known-good firmware/settings. Use an already-established Windows
   Live Stereo pairing and a known-good short, non-visitor audio clip at low volume.
   If pairing or live mode needs setup, do it separately with the ESP32 fully
   unplugged, following the existing attended repeat-back instructions. Close the
   setup BLE connection before continuing. No microphone is needed.
2. Baseline A: ESP32 fully unplugged; play the clip once. Record whether sound is
   complete and audible through Skelly, jaw opens/closes, and any body motion.
   Stop if this baseline fails.
3. Baseline B: stop Windows audio; run the known-good ESP32 configuration with
   **head only**, jaw/MP3, eyes, lights, arm, torso, compound and jaw-first OFF.
   Observe a complete head cycle and its return, and the connection status. Keep
   existing head interval and 25-second modeled motion plus 7-second cooldown;
   do not force an extra movement. Stop if the baseline fails.
4. With that same head-only schedule, play the short clip once while a naturally
   scheduled head cycle is visibly in progress. Do not send any additional motor
   command. Record the audio start/end, gaps or distortion; jaw response; whether
   head completes, stops or changes; unexpected arm/torso movement; and reported
   BLE connection, write failures and resets. Wait until motion has visibly stopped
   and the full existing cooldown has elapsed before any further test. A modeled
   timer alone does not prove the prop is still or that a motor completed.
5. Stop audio. Observe the next naturally scheduled head cycle and whether the
   controller remains connected. Then, if safe, interrupt the prop's power once,
   restore it, and observe reconnection and a complete head cycle without replay.
   Stop on unexpected motion; retain observations and a bounded diagnostic report.
6. Stop audio and close other Bluetooth clients. Restore the saved known-good
   routine only when the prop is visibly still and the conservative cooldown has
   elapsed; watch a complete routine. Record any failure and leave uncertain rows
   Untested. No repeated concurrency or other motors are authorized by this sheet.

**Pass:** both baselines and the concurrent trial show complete audio, expected jaw
and head behavior, no unintended body motion or reset, followed by observed reconnect
and return to the original routine. A failed or missing observation is not a pass;
record what happened and when. One pass does not establish endurance or every audio
clip. If it fails, use the known-good autonomous-only setup while investigating.

## Control ownership and recovery design (not implemented)

The current firmware does not offer an interactive ownership protocol. Treat the
following as a proposal, not an operational safety guarantee:

| State | Command ownership and transition gate |
| --- | --- |
| Autonomous | Existing ESP32 scheduler alone owns motion. Interactive handoff requires an explicit request, cancellation of new starts, and an idle boundary after every existing modeled lock/cooldown. Physical stillness must be observed; there is no motor-completion feedback. |
| Interactive | One explicit owner; autonomous starts remain inhibited, no concurrent motor commands or shortened cooldowns. Stop, cancellation, lost link, timeout, page closure or uncertainty enters Recovery. |
| Recovery | Reject new movement and interactive playback; stop local audio and cancel queued work. Preserve outstanding conservative timing across the transition; reconnect by advertised name after scanning completes. Require an attended stillness check and explicit return after the longest applicable cooldown, then restore the known-good autonomous configuration. |

The existing ESP32 cannot receive or enforce this handoff, and reboot/disconnection
cannot establish physical state. Use physical separation of control today: stop the
interactive client and fully unplug the ESP32 for live setup, then reverse the
steps to return to autonomy. Coexistence testing above is a controlled exception,
not a general ownership implementation. Review and hardware validation are needed
before using any future state machine to gate motors.

The downloadable JSON diagnostic summary uses an allowlist of numeric controller fields. Raw serial captures are separate and can contain unfiltered data; review them before sharing.

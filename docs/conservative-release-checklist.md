# Conservative owner-tools release: attended checks

Status: **Untested on hardware**. This is a result sheet, not a completed test.
No hardware port was opened during development. Existing verified USB read/save,
lighting effects and isolated mode-1 restoration do not need rediscovery.

Use the original ESP32-WROOM, ESP32 Dev Module, Arduino-ESP32 **3.3.12**.
Keep your working sketch/profile first. Record build, exact JSON, date, observations
and the bounded USB log. Stop for interrupted/binding movement, unexpected actions,
reset or abnormal behavior. Do not cut power during a motor action.

## Scene reliability — remaining observations only

| Check | Procedure and pass criteria | Result |
| --- | --- | --- |
| Power-cycle retention | Save a distinct mouth-OFF routine, read it back, disconnect USB, then power-cycle while idle. Read again and observe the retained routine. Same settings/CRC and expected full movement. | Untested |
| Incomplete transfer | With motors idle, disconnect USB during DATA, before COMMIT. Reconnect/read: previous program remains. Do not erase NVS. | Untested |
| Pending application | Save changed settings during a normal head action. Pending status appears; the original movement and complete cooldown finish before application. No interrupted action. | Untested |
| Ordered scenes | Save two mouth-OFF scenes with distinguishable settings, 1-minute holds. Observe three safe transitions and continued operation after USB removal. | Untested |
| Random scenes | Use three distinguishable scenes, 1-minute holds. Observe several selections with no immediate repeat. A short sample need not select every scene. | Untested |
| Reconnect | With motors idle, turn the prop off and let the ESP32 report disconnected; restore power. Correct scene settings return with fresh intervals. Repeat three times. | Untested |
| Browser compatibility | Load an older saved profile/library, inspect before sending, and confirm its explicit settings. Disconnect clears current controller details; timeout labels the last snapshot stale. | Untested |

These checks extend [the existing scene procedure](usb-settings-scenes.md); they
do not redesign scenes or establish endurance. Serial dispatch/readback alone
cannot pass a physical-motion row. Record failures without guessing their cause.

## New diagnostics and Studio guidance

Normal builds still have wireless OFF. Upload updated universal firmware only if
you want its extra numeric status fields; older firmware remains usable with Studio.

- Open Advanced USB diagnostics. Confirm `usb-scheduler-v4`, build `2026102301`,
  activity/wait, jaw estimate and last accepted-write age are reported.
- During a head action, observe modeled cooldown; save during the action and
  confirm pending status without interruption. Pending can also mean scene rotation.
- With your known clip and body flags **0x00**, observe estimated jaw playback
  and restoration state. Do not infer actual EOF from the countdown.
- Last accepted-write age is relative to the snapshot, not live completion feedback.
  A failed status request must label old information; disconnect must clear it.
- With mouth OFF, no new setup requirement appears. With mouth ON, confirm
  selected files using the fallback are named and longer estimates remain editable.
- Download a portable profile, use **Load settings**, inspect/cancel its preview,
  then import. It must not send settings automatically. Profiles have mouth OFF
  and contain no personal clip mapping. Existing personality buttons retain their
  previous behavior and unlisted custom settings.

## Evidence to report

For each row: **Verified / Failed / Untested**, exact build/profile and what you
actually saw. Keep software test results separate. No PIR purchase is needed.
PIR/Hybrid, weighted scheduling, direct audio metadata, continuous Wi-Fi and mobile
apps remain deferred. Wireless status has its own isolated experiment below.

See [wireless-status experiment](wireless-status-experiment.md).

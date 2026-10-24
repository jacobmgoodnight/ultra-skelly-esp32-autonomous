# Next attended checks — short result sheet

No new physical pass is claimed by the October 24 software update. Existing Studio,
lighting and USB connection/read/save confirmations remain. Keep working firmware
and exported settings. These checks are separate; audio is optional.

| Check | Observe / pass criterion | Result |
| --- | --- | --- |
| Saved routine retention | Save/read-back a recognizable ordinary routine; unplug/restart ESP32 and Skelly. Same routine/settings return after discovery, without an unintended replay/reset. | Untested |
| Ordered scenes | Use two clearly different mouth-OFF scenes. First starts, next takes over after its hold and current work completes. Observe both moves/eyes/lights; do not demand an exact wall-clock start. | Untested |
| Random scenes | Use three mouth-OFF scenes. First starts, then another is selected without an immediate repeat. Several switches do not establish uniform probabilities. | Untested |
| Browser installation | Close other USB sessions, use a reviewed original-WROOM package and explicitly accept overwrite. After upload/reconnect, firmware identity matches; read/save a safe ordinary routine. Preserve the Arduino recovery route. | Untested |
| Experimental audio | Follow the separate [audio result sheet](audio-scenes.md): short clip, low volume, body flags OFF first; verify upload/read-back, exclusive playback, return to appearance/routine, then individual stored motors. | Untested |

New firmware revision 5 also reports a modeled wait reason in Studio. Compare it
with what you see, but a status value/BLE write is not proof of physical completion.
Power-cycle retention and interrupted-save recovery are different tests. A deeper
recovery test is optional, attended and should follow ordinary retention; never
report it passed based on the mocked storage tests.

For any failure, provide firmware/build, exported settings, what physically
happened and a log if available. Intermittent serial corruption remains unresolved;
retain original bytes when it recurs. No need to repeat unrelated completed checks.

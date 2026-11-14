# Skelly Live operator preview

This is an **experimental, attended** Windows conversation interface. The
conversation companion and its current models are prerequisites; it does not
replace ordinary Studio or change the autonomous firmware. The local conversation
files live under `experiments/pocket-conversation`; setup for the local Python
environment, models and runtimes is below.
Setup requires public downloads; everyday local use does not require an account
or cloud service. Skelly Live uses the local Piper voice, or the clearly labeled
Windows voice fallback if Piper is missing. It does not require the gated Pocket
cloning weights. Optional cloud services need separate configuration and explicit
permission in the page. The conversational model can generate replies: its
content guard rejects recognized unsafe output but cannot guarantee suitability.
An adult must remain present and monitor the actual speech.

For a fresh Windows setup with Python 3.12 available, from the project folder run:

```powershell
py -3.12 -m venv .skelly-build/voice-research-env
& .\.skelly-build\voice-research-env\Scripts\python.exe -m pip install numpy scipy requests
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup-talkback-local.ps1
& .\.skelly-build\voice-research-env\Scripts\python.exe experiments/pocket-conversation/prepare-brain.py
```

The setup script verifies its pinned speech/model downloads. The separate brain
preparation verifies its public LFM model. Allow disk space for the downloaded
speech and model assets. This does not install globally. The family reply mode
uses only the reviewed catalog, although the current launcher still starts the
local conversation model. See [Character Director](character-director.md).
The optional Pocket voice assets and their local lock files are not included in
this source package. Use the launcher, which explicitly selects Piper; a direct
`chat_server.py` invocation must also select `--voice piper` unless those
optional assets have been separately prepared.

## Start

1. Keep `Skelly Live.cmd` in the project folder. Right-click it and choose
   **Send to → Desktop (create shortcut)**; launch the shortcut, not a copied
   `.cmd` file. No administrator permission or global installation is needed.
2. Disconnect the autonomous ESP32, including USB, and other Skelly control
   apps. Connect the **Ultra Skelly v2(Live) Stereo** output in Windows. Keep
   the volume low and attend the prop. If live audio needs enabling, follow the
   existing [repeat-back setup](experimental-talkback.md) with the ESP32 off.
3. Launch Skelly Live and leave its small window open. It starts the local
   companion and its model, then opens the default browser. Use desktop Chrome
   or Edge if the default browser lacks microphone or output selection support.
   The microphone does not open on launch.
4. Choose **Check local engine**, then **Enable devices**. Allow microphone
   access; the permission check closes the microphone immediately. Choose the
   Windows input (for example, the FLOW 8 USB input) and Skelly's Bluetooth
   Stereo output separately. Saved device IDs are local to this browser. If a
   device is unavailable, reconnect it or explicitly select another. Windows
   or the browser may change device IDs after a reconnect; reselect as needed.
5. Confirm attendance, choose **Test microphone**, say a short, appropriate test
   phrase, and then **Play test on speaker**. The test repeats microphone audio
   without a content guard; browser noise suppression and echo cancellation may
   be applied. It is discarded after playback, Stop, a device change or leaving
   the page.
   Listen at the prop and watch the jaw; a browser playback completion is only a
   software result. A conservative pause follows test playback. In Voice &
   conversation settings, choose **Family · reviewed replies only** for the
   catalog-guarded mode; the separate Open mode uses generated replies. Choose
   a character, confirm attendance, and choose **Talk to Skelly**. Each turn
   is explicit and retains the normal 45-second pause after a completed reply.

Ports 8777, 8776 and launcher reservation 8778 are required. If occupied, close
the other application normally and restart; the launcher will not kill an unknown process. It also
reports occupied legacy ports 8765–8767. If startup fails, its window reports
the error and points to the setup notes. The page's connection check reports
optional cloud configuration locally and reports incomplete or malformed
environment configuration; it does not verify provider credentials.
Processing has a bounded timeout; Stop cancels the current request and suppresses
late browser playback. A model or runtime that fails during a turn requires a
new explicit attempt or companion restart.

## Stop and return to autonomy

1. Select **Stop** in the page. Confirm the microphone indicator says OFF.
   Stop releases browser capture and playback; it cannot physically stop an
   animation already sent to the prop, and queued Bluetooth audio may continue.
2. Choose **Stop and exit** in the launcher. It requests shutdown only from
   the companion process it started and waits for that companion to close its
   model. If normal shutdown times out, the launcher reports that Windows will
   force-close its owned process tree as the launcher exits; it does not stop
   unrelated processes. Confirm that live audio has stopped before continuing.
3. Disconnect Windows from Skelly Live Stereo, power-cycle Skelly, and only
   then reconnect the known-good autonomous ESP32. Verify the expected normal
   behavior while attending. Do not run autonomous movement concurrently with
   live conversation; coexistence has not been physically verified.

## Attended acceptance (Untested)

With the ESP32 unplugged, use low volume and an adult at the prop. Confirm the
chosen USB microphone captures speech, the selected Skelly speaker actually
plays the test, and the jaw's physical response. Disconnect each selected
device in separate trials and require capture/playback to stop without silently
switching to another microphone or speaker. Test Stop during capture, thinking,
and speaking, and watch for any queued sound or movement after Stop. Wait out
each pause and perform one guarded conversation turn. Finally follow the
recovery procedure above and observe autonomous operation. Stop the trial for
unexpected movement, feedback, incorrect speech, lost device selection, or
failure to recover. Record physical observations separately from software logs.

## Optional local startup checks

After setup, these Windows checks start the actual local companion and model on
isolated loopback ports, then verify that they shut down. They do not open a
browser, microphone, speaker, or Bluetooth device. Close any application using
ports 18776–18778 first; the checks refuse to start if those ports are occupied.

```powershell
& .\.skelly-build\voice-research-env\Scripts\python.exe tests/smoke_skelly_live_startup.py
& .\.skelly-build\voice-research-env\Scripts\python.exe tests/smoke_skelly_live_launcher.py
```

Both should report `PASS`. These checks establish local software startup and
shutdown only. They do not replace the attended speaker, jaw, or recovery checks.

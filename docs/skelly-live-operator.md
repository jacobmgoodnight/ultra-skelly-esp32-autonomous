# Skelly Live

**Experimental. Optional. Attended use only.** Skelly Live lets visitors talk to
Skelly: a microphone near the prop feeds a Windows laptop, which recognizes the
speech, picks a reply and plays it through Skelly's own Bluetooth speaker so the
jaw moves. It is separate from the autonomous ESP32 controller and never changes
its firmware or saved routine.

Skelly Live and the autonomous ESP32 do not run at the same time. Unplug the ESP32,
including USB, before starting Live, and follow
[Back to normal operation](#back-to-normal-operation) afterward.

## What has been confirmed

| | Status |
| --- | --- |
| Live speaker pairing in Windows; sound from Skelly with jaw movement | Owner-confirmed (October 2026, ESP32 unplugged) |
| Repeat-back of a recorded phrase, manual and in a two-phrase automatic pilot | Owner-confirmed |
| One reviewed (Family) reply through Skelly with jaw movement | Owner-confirmed |
| Prepared voice samples (Qwen, MOSS, Supertonic) moving the jaw | Owner-confirmed for those clips |
| This single-page layout, Family-by-default flow and the speaker button on this page | Untested on hardware |
| Physical Stop, longer sessions, recovery and return to autonomy | Untested |
| Live audio while the ESP32 is also connected | Untested; do not attempt |
| Claude or ElevenLabs cloud options with a real account | Untested |

Details and dates are in the [hardware verification matrix](hardware-verification.md).

## One-time setup (Windows)

You need Python 3.12 and desktop Chrome or Edge. From the project folder:

```powershell
py -3.12 -m venv .skelly-build/voice-research-env
& .\.skelly-build\voice-research-env\Scripts\python.exe -m pip install numpy scipy requests
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup-talkback-local.ps1
& .\.skelly-build\voice-research-env\Scripts\python.exe experiments/pocket-conversation/prepare-brain.py
```

The setup script downloads and checks the speech recognizer, the Piper voice and
the local model runtimes. Everything stays inside the project's `.skelly-build`
folder; nothing is installed globally. Everyday use needs no account or internet.

Then right-click `Skelly Live.cmd` and choose **Send to → Desktop (create
shortcut)**. Keep the `.cmd` file in the project folder.

## Each time

1. Unplug the autonomous ESP32, including USB, and close other Skelly apps.
2. Open the **Skelly Live** shortcut. Leave its small window open. It starts the
   local companion and opens the page. The microphone stays off.
3. On the page:
   1. **Skelly's speaker.** Skip this if Windows already lists
      **Ultra Skelly v2 (Live) Stereo** as a sound output. Otherwise tick the
      ESP32-unplugged box and choose **Turn on Skelly's speaker**, pick Skelly
      in the browser's Bluetooth chooser, then pair the Live speaker in Windows
      Bluetooth settings (PIN 1234 if asked). The button sends one request and
      never retries by itself.
   2. **Microphone and speaker.** Choose devices, pick your microphone and
      Skelly's Live speaker, then use **Test microphone** and
      **Play test through Skelly**. Listen at the prop and watch the jaw.
   3. **Talk.** Pick a character, tick the box confirming you're with Skelly,
      and choose **Talk to Skelly**. Stay quiet for a second, then speak.

After each reply there is a pause of about 45 seconds before the next **Talk**.

## Reply modes

- **Family** (default): Skelly only plays replies from a catalog of 80 lines a
  person has reviewed. Only first names on a fixed allowlist can be spoken.
  If the reviewed catalog is unavailable, **Talk** stays disabled; Family never
  falls back to Open.
- **Open** (Advanced): a language model writes replies. A content check rejects
  recognized unsafe output but cannot guarantee suitability. Use it only while
  you are listening.

Cloud options (Claude for Open-mode replies, ElevenLabs for the voice) are off
by default. They need setup through **Advanced → Optional cloud setup** and
permission for each visit. Raw microphone audio never leaves the laptop. Claude
receives recognized speech and recent chat; ElevenLabs receives Skelly's reply
text. Provider billing and retention terms apply.

## Voice

The launcher uses the local **Piper** voice, so **Advanced → Local voice** shows
one option. The other voices listed there need separately prepared Pocket voice
files that this repository does not include. Voice quality is the main open
problem; see the [research archive](archive/skelly-live/README.md).

## Stop

**Stop** ends recording and playback in the browser. Sound already queued over
Bluetooth may finish. **New visitor** also clears the visit's short memory, which
stays in the laptop's memory only and expires after five idle minutes. Leaving
or hiding the page does the same.

## Back to normal operation

1. Choose **New visitor**, then **Stop and exit** in the launcher window.
2. In Windows, disconnect the Skelly Live speaker.
3. Power-cycle Skelly.
4. Plug the ESP32 back in and watch one complete normal routine.

This procedure has not yet been confirmed on hardware. Record what you see.

## Attended acceptance check

With the ESP32 unplugged, low volume and an adult at the prop:

1. The page opens with the microphone off and **Family** selected.
2. **Test microphone** and **Play test through Skelly** play from Skelly, and the
   jaw moves.
3. One Family turn plays a reviewed reply from Skelly with jaw movement.
4. **Stop** during listening, thinking and speaking: nothing new plays
   afterward (queued Bluetooth sound may finish).
5. Unplugging the selected microphone or speaker stops the turn; nothing
   silently switches devices.
6. [Back to normal operation](#back-to-normal-operation) ends with a normal
   routine and no unexpected movement.

Stop the check for unexpected movement, feedback, wrong speech, or failure to
recover. Write down what you physically saw and heard, separately from any log.

## Troubleshooting

- **Page says the companion is offline:** use **Reconnect**. If that fails,
  choose **Stop and exit** in the launcher and open it again.
- **Port in use (8776, 8777 or 8778):** another copy or application is running.
  Close it normally; the launcher never stops unknown processes.
- **Speaker missing:** use step 1, or power-cycle Skelly in Bluetooth mode and
  try once more.
- **Recognition is poor:** move the microphone closer, or try
  **Advanced → Microphone sensitivity**.

Optional startup self-checks (no microphone, speaker or Bluetooth is opened):

```powershell
& .\.skelly-build\voice-research-env\Scripts\python.exe tests/smoke_skelly_live_startup.py
& .\.skelly-build\voice-research-env\Scripts\python.exe tests/smoke_skelly_live_launcher.py
```

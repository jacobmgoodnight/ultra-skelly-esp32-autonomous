# First night back: one attended session

One sitting with the prop to check everything that changed while it was packed
away. The core takes about 30–35 minutes; optional steps are marked. Stay with
Skelly the whole time and fill in the [results table](#results) as you go.

**Stop immediately** (unplug the ESP32 and switch Skelly off) for grinding,
repeated bursts of movement, a motor that keeps straining, a hot smell, or
anything else that looks wrong. Write down what you saw.

## Before you go outside (5 minutes, computer only)

1. Open Skelly Studio and choose **Save settings (.json)** to keep a copy of your
   normal routine. If you use scenes, also choose **Export scenes**.
2. Keep the Arduino IDE recovery route handy ([setup guide](setup.md)) in case
   the ESP32 needs reinstalling.
3. On the Windows laptop, check that the **Skelly Live** shortcut opens its window
   ([Skelly Live guide](skelly-live-operator.md)). Close it again for now.

## Part A · Controller (ESP32 plugged in, Skelly in Bluetooth mode)

**A0 · Browser install (optional, about 10 minutes).** Only if you want to test
installing firmware from the browser. It replaces the ESP32's program and resets
its saved settings, so do it first. Follow the
[browser installation checklist](browser-installation.md#short-attended-hardware-checklist).
Pass: after reconnecting, Studio's Connect & save shows the installed firmware.

**A1 · A recognizable routine (5 minutes).**
In Studio: **Connect ESP32 → Read saved settings**. Choose **Subtle**, set the
head to every **40–60 seconds**, pick **one** eye you will recognize, and in
Lighting tick **Use selected lighting** with two obvious colors (for example a
green head and a red body).
Tick the replace box, choose **Save this routine**, and wait for
**read-back verified**.
Pass: the chosen eye and both colors appear, and the head turns within about
two minutes and then roughly every 40–60 seconds. No other motor moves.

**A2 · It stays saved after a restart (3 minutes).**
Open **Optional · check it stays saved after a restart** under Save and follow it:
unplug the ESP32 and switch Skelly off for 10 seconds, plug both back in,
**Connect ESP32**, **Read saved settings**.
Pass: the status says **matches verified settings**, and Skelly starts the same
routine without a burst of movement.

**A3 · Bluetooth reconnection (6 minutes).**
Leave the ESP32 powered. Switch Skelly off and on again, three times, waiting
for the routine to resume each time.
Pass: each time the routine comes back by itself, with no immediate burst of
movement. Note roughly how long each reconnection took.

**A4 · Scenes in order (5 minutes).**
In **Scenes**, make two scenes with clearly different eyes and colors, each set
to **1 min** with the mouth off, saving each with **Save as new**. Tick
**Automatically switch scenes** and choose **In order**. Then, in Connect & save,
tick the replace box, open **Optional · save a scene collection** and choose
**Save scene collection**.
Pass: the first scene starts, the second takes over after about a minute (it may
wait for a movement to finish), and then the first returns.

**A5 · Random scenes (optional, 5 minutes).**
Add a third scene, choose **Random · no immediate repeats**, and save the scene
collection again. Watch about five switches.
Pass: no scene plays twice in a row. A few switches don't prove fair odds.

**Finish Part A:** **Load settings** with the copy from before you went outside
and **Save this routine** again, so your normal routine is back on the ESP32.

## Part B · Skelly Live (ESP32 unplugged, about 10 minutes)

**B1 · Start.** Unplug the ESP32, including USB. Open the Skelly Live shortcut.
Pass: the page opens with **Family** selected and the microphone **off**.

**B2 · Sound and jaw.** Do step 1 (Skelly's speaker) only if Windows doesn't
already list the Live speaker. In step 2, choose your microphone and Skelly's
Live speaker, then **Test microphone** and **Play test through Skelly** at low
volume.
Pass: your test phrase comes from Skelly and the jaw moves with it.

**B3 · Each character.** For each of the four characters, choose it, tick the
"I'm with Skelly" box, and say one at a time: "Hello", "Who are you?",
"Are you scary?", "Tell me a joke", "Goodbye".
Pass: every reply suits that character, the words are clear, and the jaw follows.
Note any line that sounds wrong or that you want changed.

**B4 · Stop.** Start a turn and press **Stop** once while listening, once while
it's thinking and once while it's speaking.
Pass: nothing new plays after Stop (sound already queued over Bluetooth may finish).

**B5 · Recorded voice (optional).** Only if you have approved recordings: say a
line you recorded. Pass: **Advanced** shows "Reviewed recording" for the last
reply and you hear the recorded voice.

## Part C · Back to normal (5 minutes)

Choose **New visitor**, then **Stop and exit** in the launcher window.
Disconnect the Skelly Live speaker in Windows, switch Skelly off and on, then
plug the ESP32 back in.
Pass: your normal routine runs with no unexpected movement.

## Results

Copy this table into a note, fill it in, and share it. Physical observations
count; a log or a "saved" message alone doesn't prove what the prop did.

| Step | Pass / Fail / Skipped | What you saw (times, words, anything odd) |
| --- | --- | --- |
| A0 Browser install (optional) | | |
| A1 Recognizable routine | | |
| A2 Stays saved after restart | | |
| A3 Bluetooth reconnection ×3 | | |
| A4 Scenes in order | | |
| A5 Random scenes (optional) | | |
| B1 Live page starts safely | | |
| B2 Sound and jaw | | |
| B3 Characters (Friendly, Mischief, Guardian, Storyteller) | | |
| B4 Stop while listening / thinking / speaking | | |
| B5 Recorded voice (optional) | | |
| C Back to normal | | |

These results update the [hardware verification matrix](hardware-verification.md);
the longer per-feature sheets remain in the [next-release checklist](next-release-checklist.md)
and the [hardware verification center](hardware-checklist.md).

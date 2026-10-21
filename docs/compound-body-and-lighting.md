# Compound body movement and live RGB lighting

**October 20, 2026 — experimental automation with verified movement masks.** Ultra Skelly v2 physically moved on all tested combined `AACA` bitmasks: `0x03` (head+arm), `0x05` (head+torso), `0x06` (arm+torso), and `0x07` (all three). The new autonomous **random scheduler** for those masks is opt-in and has **not yet been run on the prop**.

## Combined body mode

In [Skelly Studio](../studio/), enable the individual motors you intend to use, then check **Random combined body movements**. Choose the allowed combinations and a randomized start interval (suggest **180–360 seconds** initially).

- The controller selects **ONE combined mask** for each event, sends one AACA BLE frame, and suppresses the old independently timed head/arm/torso commands while this mode is active.
- Each motor in the selected mask receives its usual cooldown (head **25+7 sec**, arm **22+10 sec**, torso **25+10 sec**); the shared body lock lasts as long as the **slowest selected motor plus buffer**.
- The next compound movement waits for its randomized interval, that lock, and any jaw MP3 that is due/playing. Leave **Protect head + arm + torso from jaw MP3** ON: MP3 playback appears to interfere with head motion.
- This mode **cannot be combined** with *Jaw first → body movement* in the generator. To preserve the existing 30-minute field-proven alternating jaw-first arm/torso mode, leave compound mode OFF.
- Presets and the checked-in sketch keep compound mode OFF by default. Running compound actions continuously for hours, or during frequent jaw clips, needs an attended test before unattended use.

## Torso and head/mouth lighting

The upstream [Skelly Ultra Web Controller](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/constants.js) exposes **Torso Light (channel 0)** and **Head Light (channel 1)**, with live setting tags:
- `AAF2`: effect mode; the generator selects **static mode 1**.
- `AAF3`: brightness `0–255`.
- `AAF4`: RGB color and color-cycle flag (cycle OFF). **This is a 13-byte packet**, unlike the 11-byte AACA motor packet.

Studio labels channel 1 **Head / mouth RGB** to reflect the user's target, but the community protocol calls it *Head Light*. We have **not confirmed which physical LEDs it changes on this specific device**. It may not control the mouth independently.

Live colors are **OFF by default**. When enabled, the controller applies torso and head channels after connecting, sends one BLE write at a time (at least **300 ms** between lighting writes), and offers three restore choices:

| Restore mode | Behavior | First-test recommendation |
| --- | --- | --- |
| At connection only (0) | Set custom lighting once | Test without jaw MP3 first |
| After estimated MP3 end (1) | Queue both channels 500 ms after the modeled 21-second clip ends, then wait 100 ms before the first write | **Recommended initial MP3 test** |
| During and after MP3 (2) | Reapply ~3 sec after AAC6 begins **and again** when audio ends | Experimental; could interfere with playback or movements |

**October 21 physical result:** the user observed green head and red body initially, purple on both during MP3 #13, and confirmed that **both return to red/green after playback in mode 1**. Body motors, eyes, compound mode and jaw-first follow-ups were OFF. The log contains four playback/restore cycles; each six-write sequence completed 23.499 s after the AAC6 request. These are logged write times, not measured physical LED transition times. Mode 1 intentionally permits saved MP3 colors during playback. Mode 2 and lighting integration with body motors remain unverified. Serial corruption persists and is investigated separately in the [experiment log](experiments.md).

The controller still estimates playback duration using `MOUTH_CLIP_MS`; it does not subscribe to a playback-ended notification. A new MP3 waits for final restoration and all six writes. Partial older work is canceled when a new clip begins in modes 1/2, and disconnect cancels pending work. Verbose diagnostics are OFF by default. Follow the [isolated lighting/serial test](testing.md) before adding motors or trying mode 2.

For isolation, first use **Head, arm, torso, jaw and eyes OFF**, enable **Live RGB lighting**, and observe which LEDs respond on channels 0 and 1. Next turn jaw #13 ON to observe whether playback changes the colors. Only after lighting and MP3 have been checked separately, enable the compound motor scheduler.

## Logs and safety

Expect `COMPOUND mask 0x07 SENT` and `LIGHTS: ch0 RGB sent` / `LIGHTS: ch1 RGB sent`. These messages confirm **BLE dispatch**, not the physical response. Confirm each movement and LED change visually.

Ensure Skelly is stable, joints have clearance, and USB/BLE stays connected. Stop the test if motors bind, audio changes unexpectedly, or light commands interrupt movement. [Earlier tests and observations](experiments.md) describe the known jaw-first head suppression and verified compound masks.

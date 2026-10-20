# Jaw personalities: long holds and surprise movement

The ESP32 uses Skelly's **stored audio files** to move the jaw with the prop's physical volume knob set to zero. There is no direct jaw-position command in our verified BLE implementation.

The original ~20-second irregular-twitch MP3 is preserved as a known-working starting point. These are **additional experimental waveforms**, not replacements.

## New MP3 test patterns

| File generated | Intended behavior | Sustained signal positions |
| --- | --- | --- |
| `Jaw_Long_Open_3s_Holds_20s.mp3` | Jaw opens for roughly **three seconds**, then closes; repeats | 2–5 s, 8–11 s, 14–17 s |
| `Jaw_Whisper_Then_Gasp_20s.mp3` | A few fast, quiet-looking jaw movements interrupted by two long, dramatic openings | 3.2–6.2 s and 14.2–17.2 s, plus short pulses |

**Note:** Skelly's jaw opening is controlled by its audio response, not commanded in degrees. A three-second strong audio signal *should* hold it open on the tested hardware, but a real 3-second physical hold and the closing delay **must be measured**. Recorded MP3 duration is ~20.16 seconds, 8 kHz, mono, 32 kbps. These waveform files contain synthesized test tones that would be audible at normal speaker volume.

## Generate or download the clips

- Run `python audio/generate_jaw_clips.py` from the project directory. It uses Python's standard library and an installed **ffmpeg** executable. New MP3s will appear under `audio/generated/`.
- Alternatively, open GitHub's **Actions → Build sample jaw MP3s** and use its **Run workflow** option. The workflow uploads the generated MP3s as a downloadable build artifact. GitHub build artifacts expire; the Python source is the permanent reference.
- The project maintainer also has the two ready-made MP3 test files for direct upload.

## Upload and verify on your Skelly

1. Disconnect the ESP32 before connecting with the [Skelly Ultra Web Controller](https://martinecker.github.io/SkellyUltraWebController/).
2. Upload one new MP3; record **that file's unique serial number**, which may be different on every Skelly (the original's #12 does **not** automatically apply).
3. **Crucial:** change that uploaded file's saved movement metadata so **head, arm and torso are all OFF**—movement flags `0x00`. Otherwise the MP3 may start body movements.
4. Turn the physical volume knob down to zero if you want silent movement and verify jaw-only animation using the web controller.
5. Enter the new serial as **MP3 file serial** in [Skelly Studio](../studio/). If you've uploaded multiple clips, enter others under **Additional jaw MP3 file serials** to get randomized mouth personalities.
6. Test mouth movement in good light, then at night to check how convincing the expression looks.

Some saved MP3s also restore their own eye design when played; use Studio's experimental **Keep my selected eye expression** option if desired.

## Other jaw patterns to explore

- **Double take:** two half-second motions, several seconds of silence, then a 3-second surprised opening.
- **Slow yawn:** a gentle ramp into a 3-second open mouth followed by silence (may require adjusting ramps after testing).
- **Secret whisper:** clusters of 0.2–0.4-second pulses and long silent pauses.
- **Sudden gasp:** mostly still for 10–15 seconds, then one 3-second opening.
- **Haunted mutter:** a randomized mix of short chatter and a dramatic hold, chosen from multiple uploaded audio files.

Each additional audio pattern needs its own uploaded Skelly file serial. The current scheduler assumes jaw MP3s last about **20–21 seconds**; keep all clips near that length unless you change the scheduling logic.


## Field-test result: 3-second holds confirmed

**October 20, 2026:** The original tester uploaded **Long Open as file #13** and **Whisper Then Gasp as file #14**. **Both successfully held the jaw open for approximately three seconds** before closing. That confirms a useful visual effect on one Ultra Skelly v2; waveform response and file numbers may differ on another unit.

The test also revealed a possible interaction: when a jaw MP3 begins, it appears to interrupt an already-running arm or torso command. Studio offers a new **Protect arm + torso from jaw MP3** option to defer the AAC6 play command until those actions finish. See [body-movement notes](../docs/body-movements.md).

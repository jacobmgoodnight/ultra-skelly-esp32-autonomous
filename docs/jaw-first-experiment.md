# Experiment: start the arm or torso AFTER jaw audio starts

**Status: experimental / physical outcome unknown.** During earlier testing, issuing an AAC6 jaw-MP3 play command while a head/arm/torso `AACA` animation was already running appeared to interrupt arm or torso movement. That suggests command order matters, but it does **not prove** that the MP3 movement metadata is the cause.

## Hypothesis

If the stored MP3 applies its saved body-movement flags (`0x00`) at the instant playback begins, sending a new `AA CA 02` (arm) or `AA CA 04` (torso) command **2 seconds later** might start that motor without interrupting continued jaw response. It is also possible that `AACA` interrupts jaw playback instead, or that Skelly supports only one animation owner at a time.

The controller now offers **Jaw first → arm or torso**, disabled by default:

- `JAW_FOLLOWUP_MOTOR = 0`: OFF (original behavior).
- `JAW_FOLLOWUP_MOTOR = 1`: send **arm** after the jaw MP3 starts.
- `JAW_FOLLOWUP_MOTOR = 2`: send **torso** after the jaw MP3 starts.
- `JAW_FOLLOWUP_DELAY_MS = 2000`: configurable between **1 and 10 seconds** in Studio.

The extra `AACA` packet is sent **only once successfully per BLE connection** during the first eligible MP3 playback, after the delay, if the selected body motor is enabled, out of its own cooldown, and not blocked by the global body-motor lock. A skipped attempt is **logged** and may be tried on the next MP3; a successful attempt sets a one-shot guard so the arm doesn't inadvertently move every 45–90 seconds with the jaw. Reconnect/reset allows a new experimental attempt. It does not bypass motor safety margins or start both arm and torso simultaneously.

The existing **Protect arm + torso from jaw MP3** mode remains ON by default: it avoids starting MP3 playback in the middle of an arm/torso animation. Jaw-first follow-up is a deliberate exception allowing one motor command *after* playback has already started.

## Suggested first test (arm, clear view)

1. In [Skelly Studio](../studio/), choose **Normal** and then set **Head OFF**, **Torso OFF**, **Arm ON**, **Jaw ON**; turn **Eyes OFF** and **Idle breaks OFF** to simplify observations.
2. Set jaw MP3 serial to **13** (confirmed Long Open 3-second-hold clip *on the original test prop*), with **Additional jaw MP3 file serials** blank. Enter your own file number on another device.
3. Keep **Protect arm + torso from jaw MP3 ON**. Set **Jaw first → Start arm after jaw MP3 begins** with a **2-second** delay.
4. Generate the Arduino sketch and flash the ESP32. Use the verified board setting and **Serial Monitor 115200**. Keep body movement area clear and stay close enough to stop the prop.
5. Watch for one `JAW command sent` and roughly two seconds later `JAW-FIRST: sending ARM after MP3 start (experimental).` The firmware is logging *transmitted commands*, not asserting they physically completed.
6. **Watch the jaw carefully:** does the planned 2–5 second sustained-open interval continue uninterrupted when the arm moves? Also confirm both arm motions finish over ~22 seconds.
7. If the arm action gets skipped because another motor is still cooling down, keep only the arm enabled and use a longer jaw interval so timing is easier to observe.

## Repeat with torso

With **Head OFF**, **Arm OFF**, **Torso ON**, choose **Jaw first → Start torso after jaw MP3 begins** with a 2-second delay. Confirm the torso actually completes its ~25-second animation **and** that the MP3 jaw continues moving.

## What the results mean

| Observation | Interpretation |
| --- | --- |
| Jaw and arm/torso both continue | Supports the idea that ordering the commands solves the interruption; still validate multiple cycles |
| Arm starts but jaw stops immediately | `AACA` may override ongoing AAC6 audio/jaw playback |
| Jaw continues but motor does not start | Motor command may be ignored while MP3 is active |
| Both stop or restart | Another device-specific animation priority interaction is possible |
| Follow-up skipped in serial log | Motor wasn't enabled, wasn't off cooldown, or was blocked by body lock; not a BLE protocol verdict |

**Do not mark concurrent jaw/body commands verified until physical observation confirms both motions keep going**. A complete `AAC6` or `AACA` BLE write is not proof of simultaneous animation. For unattended use, turn jaw-first OFF until reliable.

This experiment leaves the file's **saved head, arm and torso movement flags at 0x00**. Do not change the MP3 metadata merely to force simultaneous motor animations.

# Experiment: start the arm or torso AFTER jaw audio starts

**Status (October 20, 2026): Jaw-first overlap CONFIRMED on the original Ultra Skelly v2 for both arm and torso.** The user observed the sustained three-second jaw hold continue uninterrupted while the arm completed both movements (~22 seconds). The torso-and-jaw combination also worked. The reverse ordering (arm/torso first, then AAC6) appeared to interrupt body movement. This supports command-order sensitivity but doesn't prove how Skelly's internal MP3 movement flags are processed. Recurring synchronization is a separate new feature and needs an extended test.

## Working command-order explanation

The observed behavior is consistent with a stored MP3 applying its saved body-movement flags (`0x00`) when playback starts. Sending a new `AA CA 02` (arm) or `AA CA 04` (torso) **2 seconds later** let the mouth and selected motor move together. The exact device-firmware priority rules remain unknown.

The controller now offers **Jaw first → arm or torso**, disabled by default:

- `JAW_FOLLOWUP_MOTOR = 0`: OFF (original behavior).
- `JAW_FOLLOWUP_MOTOR = 1`: send **arm** after the jaw MP3 starts.
- `JAW_FOLLOWUP_MOTOR = 2`: send **torso** after the jaw MP3 starts.
- `JAW_FOLLOWUP_DELAY_MS = 2000`: configurable between **1 and 10 seconds** in Studio.

**Two scheduling modes are available:**

- **One-shot (default):** Send one successful follow-up per BLE connection; a skipped attempt can retry on a later MP3. Reconnect/reset allows another trial.
- **Recurring (opt-in, unverified over long runs):** The chosen arm/torso movement **waits for its normal randomized interval** instead of firing independently. When due, it attaches to the next MP3 and starts after the configured delay. It does *not* follow every jaw clip. After sending, the usual next arm/torso random interval is set.

Both modes check that the motor is enabled, the MP3 is still active, the per-motor cooldown has ended and the shared motor lock permits the action. A skipped attempt is logged; there is no forced retry during that MP3. Neither mode sends both arm and torso as one follow-up.

The existing **Protect arm + torso from jaw MP3** mode remains ON by default: it avoids starting MP3 playback in the middle of an arm/torso animation. Jaw-first follow-up is a deliberate exception allowing one motor command *after* playback has already started.

## Verified test result

The original tester used **jaw file #13** (Long Open). With **Head OFF**, **Arm ON**, **Torso OFF**, **Jaw ON**, and a 2-second jaw-first delay, the jaw held open during the planned 2–5 second interval, and the arm completed both movements (~22 seconds). A separate test with **Torso ON**, **Arm OFF** also confirmed jaw-plus-torso overlap. The serial logs show two follow-up events on successive MP3s, using the **older test build** with the message `JAW-FIRST: scheduled`; the newer one-shot build says `JAW-FIRST ONE-SHOT: scheduled`. Thus the repeated sends do not establish a one-shot regression.

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

**Concurrent jaw+arm and jaw+torso motion has now been physically verified on the original Skelly.** A complete `AAC6` or `AACA` BLE write alone would not have established that; the observation does. Longer unattended reliability, head-plus-body combinations, and recurring interval coordination still need testing.

This experiment leaves the file's **saved head, arm and torso movement flags at 0x00**. Do not change the MP3 metadata merely to force simultaneous motor animations.

## Additional repeat test and alternating option

A second controlled run confirmed **jaw file #12 with arm**, and **jaw file #13 with torso**, both using a 2-second jaw-first follow-up. Both combinations worked. The arm log says `JAW-FIRST ONE-SHOT`, followed by a second jaw clip with no arm follow-up—as intended. The torso run also had later standalone torso movements with `JAW deferred` messages, indicating jaw/body protection rather than recurring coordination.

**New opt-in selection: Alternate arm or torso when due** (`JAW_FOLLOWUP_MOTOR = 3`, `JAW_FOLLOWUP_RECURRING = true`). Turn ON both arm and torso. Each movement becomes eligible based on its own randomized target; the next MP3 triggers *one* eligible motor after the delay, favoring the opposite motor if both are due. If neither is due, there is no motor follow-up for that clip. Repeating this automatically over multiple cycles is **not yet verified**.

For an initial alternating test, turn Head OFF, Arm ON, Torso ON, Jaw ON (file #13), select Alternate, enable Recurring, and set each motor to **90–150 seconds** and Jaw to **45–60 seconds**. Keep **Protect arm + torso from jaw MP3 ON** and body overlap OFF. Observe at least four eligible jaw events: alternation is a preference when both motors are due, **not** a promise to strictly switch every time or to move on every jaw clip.


## Recurring alternating: first multi-cycle ESP32 log result

**Configuration tested:** Jaw file #13, head OFF, arm ON, torso ON, body motor overlap OFF, MP3 priority protection ON, jaw-first **ALTERNATING**, recurring enabled, and 2000 ms delay.

**Result from Serial Monitor:** after an initial jaw-only clip, six jaw-first motor sends occurred in the order **ARM → TORSO → ARM → TORSO → ARM → TORSO**. There were no logged disconnects, skipped follow-ups, or failures during those six sends. The arm and torso kept independent random target intervals, and they were triggered only on jaw clips when eligible.

This establishes that the **recurring selector and command dispatch** work on the real ESP32 over several cycles. The user previously confirmed that the jaw and each body motor physically overlap when jaw playback precedes `AACA`; the latest log has no new visual observations of each cycle. For the next test, watch whether **each 22-second arm and ~25-second torso movement actually finishes**, whether MP3 jaw action remains uninterrupted, and whether the system remains reliable over a longer unattended run. Head + jaw + arm/torso together also remains unverified.

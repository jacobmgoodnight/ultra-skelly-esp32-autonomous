# Jaw MP3 first, then HEAD: isolated hardware test

**Status:** Experimental. Jaw-first **arm** and **torso** movements have been verified, but jaw-first **head** has **not** yet been tested on the physical Ultra Skelly v2. The goal is to find out whether a head command sent after an MP3 starts lets the head complete its ~25-second action **without stopping the mouth movement**.

## Motivation

An AAC6 MP3 play command sent during an active head animation appeared to interrupt the head. Jaw-first arm/torso behaved differently: sending AACA 2 seconds *after* AAC6 let each motor work with jaw movement. This new test reverses the head/jaw command order in the same way.

## Isolated test configuration

Open [Skelly Studio](../studio/), then use these options:

| Setting | First test |
| --- | --- |
| Head | **ON**, 90–150 seconds (or leave default) |
| Arm | **OFF** |
| Torso | **OFF** |
| Jaw | **ON**, MP3 **#13** on the original prop (the 3-second Long Open clip) |
| Jaw frequency | 45–60 seconds |
| Jaw first → body movement | **Start HEAD after jaw MP3 begins (UNTESTED)** |
| Follow-up delay | **2 seconds** |
| Repeat when selected motor is due | **OFF** (one successful follow-up per BLE connection) |
| Protect head + arm + torso from MP3 | **ON** |
| Body motor overlap | **OFF** |
| Eyes | **OFF**, initially |

Use the known ESP32 Dev Module settings and Serial Monitor at **115200 baud**. Keep the prop secure and moving parts clear.

**Expected code behavior:** Head's standalone timer is paused until the one-shot experiment succeeds, so it cannot occupy the global body lock before the first jaw-first test. After AAC6 starts, the follow-up sends the same verified `AA CA 01` head-only command about 2 seconds later, provided the head is enabled and all cooldowns allow it. After a successful one-shot, normal independent head scheduling resumes. Subsequent jaw MP3s should still be protected from interrupting active head movements.

Watch for:

```text
Jaw-first follow-up: HEAD (EXPERIMENTAL) after 2000 ms (ONE-SHOT).
JAW-FIRST ONE-SHOT: scheduled HEAD 2000 ms after MP3 start.
JAW command sent (file #13)
JAW-FIRST: sending HEAD after MP3 start (UNTESTED).
HEAD command sent
```

These are *expected partial messages*, not a claim that the prop physically responded.

## Visual observations to record

1. Does the mouth stay open through the **2–5 second long hold** even though the head starts at approximately 2 seconds?
2. Does the head start moving and complete its usual **~25-second animation**? It will extend beyond the ~21-second MP3.
3. Does the MP3 stop unexpectedly when AACA head starts?
4. Does the animation restart, freeze or show any unexpected torso/arm movement?

If either animation is interrupted, keep MP3 body protection ON and disable jaw-first HEAD until we isolate the behavior.

## Can head, torso and arm all move together?

**Possibly, but not yet demonstrated.** Studio already has an advanced **Allow body motor overlap** switch that removes the *shared* body motor lock while preserving **per-part cooldowns** and at least **600 ms spacing between BLE writes**. With Head, Arm, and Torso ON, and **Jaw OFF**, independently due body commands could overlap physically; it is not guaranteed they will all start at once. We still do not know whether a new `AA CA` command interrupts an ongoing `AA CA` movement on this version of Skelly, or whether running several motors together strains its power/mechanics.

We should first test **head+arm**, then **head+torso**, then **arm+torso** under body overlap, and only then attempt all three, while attended. That is a *separate* test from the jaw-first HEAD test. MP3 body protection still prevents normal body starts during jaw audio, except the deliberate jaw-first motor follow-up.

## Why Bluetooth retried during the prior test

The last provided run logged two BLE connection failures and one scan miss before eventually establishing a valid connection. Commands ran after it connected. Those failures are a separate BLE acquisition issue, not evidence that the motor scheduler was wrong; continue monitoring the retry behavior if it becomes frequent.

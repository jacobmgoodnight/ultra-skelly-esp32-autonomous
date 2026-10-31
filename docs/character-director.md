# Character rehearsal (software-only)

Studio's **Rehearse a character** offers a text-only simulation. The separate
local Skelly Live experiment can also embed this preview when those experimental
files are installed. Choose a character and start the preview. It
illustrates greeting, listening, thinking, speaking, reacting and return cues;
the timings are examples, not measured device timing. The Studio editor remains
the place to choose and save actual autonomous eyes, lighting and movement.
The Live rehearsal is separate from the existing conversation personality.

`studio/character-director.js` is a finite-state rehearsal model. It rejects
invalid transitions and stale generation tokens. Stop clears queued events and
enters recovery without shortening the model's existing cooldown. Optional
in-memory events are limited to 16 fixed, name-free records and are retrieved
by an explicit `drainEvents()` call; there is no network client, listener,
callback, background service or show-control dependency. The preview creates no
event consumer and does not operate any audio, BLE, USB, eyes, lights or motors.
The events are simulation events, not evidence that a visitor was greeted or
that a prop moved. There is no surprise event or external integration yet.

This is a rehearsal foundation, **not the complete Character Director**. It is
not connected to real conversation turns, the approved reply catalog, Live voice
selection, Studio's saved scene data or the autonomous firmware scheduler. The
four profile descriptions do not change spoken words, voice, eyes or lighting.
Live's existing generated conversation mode is separate from the reviewed
catalog experiment and must not be described as approved family conversation.
Visitor context, explicit resets, allowlisted names, personality-based approved
reply selection and automatic return are not implemented by this model.

The existing ESP32 code and its cooldowns are unchanged. No coordinated
live-audio/motor operation is enabled. The existing Live instructions still require
the ESP32 disconnected and a manual power-cycle before reconnecting it. Closing
the Windows companion cannot make a disconnected ESP32 resume automatically.
Coexistence, physical timing, interruption, recovery and return to autonomy are
**Untested**. A successful BLE write is transport acceptance only.

Do not run concurrent audio and motors based on this preview. A future attended
coexistence test requires a separately reviewed, fail-closed implementation and
an explicit stop/recovery procedure first. For the currently supported isolated
audio path, follow the existing [live conversation procedure](local-halloween-conversation.md):
keep the ESP32 disconnected, verify actual sound and jaw behavior, stop on
unexpected movement, then disconnect Live audio and power-cycle before returning
to the autonomous controller. Record physical observations separately from logs.

Run `node --test studio/tests/character-director.test.cjs` for the transition,
generation, queue and recovery checks. These tests establish software behavior
only and do not establish physical motion, lighting or audio performance.

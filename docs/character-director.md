# Character Director and rehearsal

The experimental Skelly Live companion offers four characters. In **Family ·
reviewed replies only**, the selected character chooses variants from the
existing reviewed reply catalog. Greetings, goodbye, requests for another joke
and short follow-ups use bounded session context. Only a first name in the
existing explicit allowlist can be inserted into spoken text. The family path
uses local recognition and voice; it rejects cloud selections and checks the
exact catalog text and any name again immediately before synthesis. It never
speaks generated model text. The separately labeled **Open conversation** mode
is the existing generated conversation experiment, not the family catalog.
The selected reply mode is explicit and the previous open-mode default remains.
Open mode retains its earlier, less restrictive first-name handling; use Family
when spoken names must be limited to the reviewed allowlist.

Choose **New visitor** to cancel the turn and clear the session. Family mode
also recognizes a spoken “new visitor.” Its bounded memory retains intent
markers and catalog replies, including any allowlisted name in a reply, rather
than a visitor transcript; sessions expire after five idle minutes. Recognition, actual spoken words and name handling
still require an attended physical check. The character affects reviewed reply
selection; voice engine and tone remain separate explicit choices.

Studio's **Rehearse a character** shows a timed text-only illustration. The
separate **Apply character look to editor** action enables one eye and static
colors for that character in the current Studio editor. It preserves the other
movement, mouth, safety, and brightness settings. Customize and explicitly
update or save the scene to keep it. Neither selection nor the preview sends a
device command; Studio scenes are not automatically synchronized with Live.

The Live director follows the existing browser capture, thinking, playback,
reaction, cooldown, and recovery phases. It has no BLE, USB or motor interface;
its visual head, jaw, eyes, lighting and voice cues are illustrative. It does
not alter the existing playback cooldown or schedule physical motion. Stop,
disconnect, a hidden page and new visitor cancel pending work using the existing
browser safeguards and clear the director's pending events. A Windows companion
failure cannot send queued director motor commands because none exist.

## Optional local events

The **Share advisory character events** checkbox is off by default and is
cleared on Stop, New visitor, device loss or leaving the page. It opens a
same-origin browser `BroadcastChannel` named `skelly-character-events-v1`;
there is no external service, polling loop, network request, motor command or
automatic integration. A future adapter page on the same origin may listen to
the channel and forward events to a separately configured show service.

Messages carry only `version`, `type`, a character profile where applicable,
an ephemeral session identifier, increasing `sequence`, and `expiresAt` in
Unix milliseconds. Types are `visitor_greeted`, `speaking_started`,
`approved_surprise`, `conversation_finished`, and `session_ended`.
`visitor_greeted` represents a completed browser playback of a family greeting;
`speaking_started` means browser playback was requested. Neither confirms
physical sound, movement or lighting.
`approved_surprise` is an available software event, never automatically
triggered by this interface. The bounded director queue holds at most 16 events;
each broadcast batch also contains at most 16. Events contain no names,
transcript, audio or device addresses.

The channel is advisory, same-origin and unauthenticated, and other pages at
that origin can send messages. A consumer must explicitly opt in, validate the
schema and type, discard messages after `expiresAt`, reject duplicate or
out-of-order sequence numbers, and invalidate a session on `session_ended`.
Closing sends that event on a best-effort basis; a crash may prevent delivery,
so expiry remains necessary. Do not treat these events as physical completion
or use them to bypass motor safety protections.

## Safety and attended acceptance

**Software-only:** state transitions, selection guards, cancellation, simulated
cues and the local event interface. **Untested:** coordinated live audio with
ESP32 motion, physical timing, crash recovery and automatic return to autonomous
control. The canonical firmware and its independent scheduler and conservative
cooldowns are unchanged. A successful BLE write confirms transport acceptance,
not motion or lighting. Jaw-first HEAD failed at both tested delays; this work
does not enable it.

Until live-audio/BLE coexistence is physically verified, keep the ESP32
disconnected, including USB, during the Live test. Stay with the prop and start
at low volume:

1. Select the input and Live Stereo output, confirm attendance, choose Family
   and a character, then say hello. Check the actual sound, jaw and spoken
   words; the on-screen state and events alone are insufficient.
2. Ask for a joke, “another joke,” “tell me more,” and goodbye. Try a known
   allowlisted first name and a made-up unfamiliar name; only the allowlisted
   name may be spoken. Choose New visitor and confirm a fresh greeting.
3. Test Stop during listening, thinking and speaking. Confirm the microphone
   indicator goes off and note any sound already buffered after Stop. If sharing
   events, confirm it is off afterward; do not attach a physical show action.
4. Disconnect Windows from Live Stereo, power-cycle Skelly, then reconnect the
   known-good ESP32 and observe its autonomous routine. This is a manual return,
   not an automatic hardware handoff. Record visual and audible observations
   separately from software logs. Stop for unexpected motion, incorrect speech,
   feedback, failed cancellation or failure to recover.

Passing this isolated test does not establish simultaneous audio and motors,
automatic handoff, extended endurance, every reply, or all lighting behavior.
Follow [Skelly Live operator setup](skelly-live-operator.md) and the existing
[hardware verification matrix](hardware-verification.md) for current evidence.

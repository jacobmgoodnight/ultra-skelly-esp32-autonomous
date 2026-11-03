# Character rehearsal (software-only)

Studio's **Rehearse a character** provides an illustrative sequence for four
personalities. It sends no commands or sound. **Apply character look to editor**
is a separate explicit action that selects an eye and static colors, preserving
movement, mouth, safety timing and brightness. Update or save a scene to retain
the look; the action does not send settings to a controller.

The bounded finite-state model rejects invalid and stale transitions, preserves
its modeled cooldown during recovery and can expose a maximum of 16 advisory
events. The optional same-origin BroadcastChannel adapter sends fixed event
types with session, sequence and expiry, and no visitor text or names. Nothing
is shared unless another application explicitly enables the adapter. A future
consumer must validate and expire messages; events do not confirm physical
motion, lighting or sound.

This PR is a rehearsal foundation. It does not connect the model to Live
conversation, deliver approved family replies, or implement an automatic
hardware handoff. The ESP32 scheduler and its safety limits remain unchanged.
Audio/motor coexistence and physical return to autonomy remain Untested; do
not run concurrent motor commands and live audio based on this preview.

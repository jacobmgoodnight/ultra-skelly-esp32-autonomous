# Current development priorities

See [Current feature status](status.md) for what exists and what is confirmed.
[Historical roadmap](archive/roadmap-before-2026-10-24.md) preserves the earlier plan.

1. Record attended power-cycle retention, ordered/random physical scene transitions
   and browser installation/recovery. USB connection/read/save already passed.
2. Validate optional audio in isolation: complete own-device list, a new short
   upload, metadata read-back, playback without ordinary interference, restoration
   and regular-routine resumption. Test stored motors individually before combinations.
3. Collect repeated reconnect/endurance observations and original serial bytes if
   corruption recurs. Do not assign BLE/UART/power causes without evidence.
4. Investigate playback-end notifications separately. No early notification should
   shorten motor protection before framing, units and natural EOF are validated.
5. Evaluate smoother same-device scene changes only after transition evidence.
   The current reconnect/apply behavior remains unchanged.

Release 2026.10.24-preview.1 implements clearer installation/version feedback,
read-only modeled wait status, compact scene comparison, local experimental audio
preparation, friendly file labels and known numbering-change warnings. It ports
only the relevant USB diagnostics from PR #35. Its separate wireless experiment
remains in that draft; no extra BLE server or actuator control is added here.

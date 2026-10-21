# Ultra Skelly engineering instructions

This is an existing hardware-tested ESP32 BLE controller. Read the current source,
`docs/architecture.md`, `docs/hardware-verification.md`, and relevant experiment
notes before changing behavior. Historical experiment entries describe their
status at that time; the verification matrix records the latest reported status.

- Preserve standalone head/jaw, optional eyes, and protected alternating jaw-first
  arm/torso operation. Preserve conservative motor cooldowns and feature defaults.
- Compound commands activated every tested mask, but recurring compound scheduling
  is not field-verified. Keep compound and jaw-first modes separately selectable.
- Jaw-first HEAD failed at both 2 and 10 seconds. A successful BLE write confirms
  transport acceptance, never physical movement or lighting response.
- Discover by advertised name. Finish scanning before connecting. No hardcoded
  device MAC, Wi-Fi requirement, accounts, backend, or paid hosting.
- `firmware/SkellyAutonomous/SkellyAutonomous.ino` is canonical. After edits run
  `node scripts/sync-template.cjs`. Never hand-edit the embedded template.
- Keep browser-generated sketches self-contained and offline-capable. Generator
  substitutions fail closed; extend tests when anchors or configuration change.
- Follow `docs/testing.md`: baseline checks, meaningful C++ behavioral tests,
  generator tests, CRC checks, template check, and pinned Arduino-ESP32 **3.3.12**
  compilation of canonical, generated matrix, and compound diagnostic sketches.
- Distinguish Verified / Failed / Untested / Software-only evidence. Never invent
  a physical result or call MP3 color restoration fixed before visual confirmation.
- Use small `codex/` branches and focused reviewable PRs. Do not merge or deploy
  risky firmware changes without review. Provide an attended test and clear result
  criteria for any unverified hardware behavior.
- Significant events use bounded text logging; verbose diagnostics default OFF.
  Never write BLE binary buffers to Serial. Do not log personal device addresses.


# Changelog

## Scene look workspace · browser changes

Brings scene naming, saving, eye selection, lighting and a combined appearance
preview into one workspace. Adds descriptive eye names, per-model browser-only
favorites/nicknames, scoped quick looks and copying eyes/lights between scenes.
The saved-scene strip shows starting scene, holds and selection policy. Palette
edits use explicit Apply/Cancel and palette selection preserves rotation.

Pulsing/strobe samples animate only Look preview swatches using
channel brightness and an illustrative speed curve. Samples run by default, with
a subtle Pause/Resume control; native color pickers remain unobstructed. Browser
strobe is limited to two flashes per second. Pause, tab visibility
and reduced-motion preferences gate animation. These samples do not measure prop
timing. Firmware, USB/profile formats and motor protections are unchanged; no new
physical result is claimed.

## Browser setup refresh · firmware unchanged

Makes browser universal installation the recommended first-time path, with public
versioned, hash-checked model-specific packages and an explicit configuration
handoff. Clarifies Save this routine versus Save scene collection; Arduino moves
to an advanced fallback. Installation warns that full-image flashing resets ESP32
settings/scenes. USB schema, profiles and motor protections are unchanged.
Browser flashing/recovery remains physically Untested.

## 2026.10.24-preview.2

Firmware revision 5 · build 2026102402. Adds a collapsed, explicitly opt-in
2026 app-controlled 12-foot profile: **Experimental — Not Hardware Tested**.
Head, eyes 1–20 and chest lighting use upstream protocol mappings. Unsupported
body/audio controls are disabled, including the newer direct audio workflow.
Ultra defaults, audio features and stored settings remain compatible. Separate
experimental USB/NVS formats preserve rollback. See the
[protocol assessment and attended checklist](docs/experimental-12ft.md).

## 2026.10.24-preview.1

Firmware revision 5 · build 2026102401 · Arduino-ESP32 3.3.12.

- Clarifies first installation versus everyday USB saving; source downloads and
  installer packages identify their release, with existing timestamps/hashes.
- Ports PR #35's bounded, read-only USB firmware/build and modeled activity/wait
  diagnostics. Adds an explicit estimated audio protected-window reason.
- Adds compact saved-scene comparison without changing scene order or timing.
- Moves experimental optional audio inside Advanced; adds local audio decoding,
  trimming, waveform and MP3 preparation, computer preview and download.
- Keeps friendly audio names in optional browser metadata and warns/blocks known
  numbering mismatches after file-list refresh. No automatic remapping.
- Consolidates current feature/evidence status and the next attended checks.

Motor cooldowns, scheduler decisions, USB commands, NVS layout and scene/profile
versions are unchanged. Optional file labels are descriptive browser metadata;
older Studio can discard them without changing the configured file serial.
The separate wireless experiment from draft PR #35 is not included. New firmware
status is Software-only; audio upload/playback and installation remain physically
Untested. Read the [current evidence](docs/status.md) before relying on an extension.

## October 23, 2026 — optional audio preview (PR #38)

Purple animated left movement icons; opt-in exclusive audio-scene hold and
restoration; prepared MP3 transfer, stored clip settings and metadata read-back.
Ordinary presets keep mouth/audio OFF. Hardware validation remains separate.

Earlier changes and physical observations are preserved in
[the experiment log](docs/experiments.md) and merged GitHub pull requests.

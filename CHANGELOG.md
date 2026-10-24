# Changelog

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

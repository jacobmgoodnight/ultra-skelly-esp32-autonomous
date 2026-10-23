# Isolated read-only wireless status experiment

**Experimental / physically Untested. Disabled in every ordinary Studio download,
universal installer and checked-in canonical sketch.** No normal Studio switch,
wireless configuration, Wi-Fi, notification stream or actuator characteristic is added.

Generate deliberately with:

```sh
node scripts/prepare-owner-tools.cjs --wireless
```

Output: `.skelly-build/WirelessStatusExperiment/WirelessStatusExperiment.ino`.
Compile with original ESP32-WROOM / ESP32 Dev Module / core **3.3.12**.
The full compile-validation driver includes this experiment. Compilation and mocked
callbacks cannot establish RF reliability, phone compatibility or physical movement.

The sketch uses the existing universal engine with a Subtle seed. **Existing NVS
settings take priority over that seed.** Read/back up existing settings first, and
explicitly save Subtle with mouth/eyes/lights/arm/torso/clock/breaks OFF before the
first test, or use a spare board. Do not erase known-working settings casually.

## Interface

- Advertised name: `Skelly Status Experiment` (some scanners may shorten it).
- Service: `765a1000-c347-4e63-8b97-40d64ef88261`.
- Read-only characteristic: `765a1001-c347-4e63-8b97-40d64ef88261`.
- Public text snapshot, refreshed by the main loop about every five seconds.
  Blocking discovery can delay refresh; `uptime` is snapshot time, not read time.
- Fields: firmware/build, uptime, Skelly `connected`, scene index (zero based),
  saved sequence/CRC, pending flag, wait reason, heap/minHeap and write failures.
- Read the whole value using GATT long reads when needed. No large negotiated MTU
  is assumed. A phone link and Skelly's link are different states.

Wait codes: 0 intervals, 1 disconnected, 2 modeled playback, 3 queued correction or
restoration, 4 modeled cooldown, 5 idle break, 6 existing time/window gate,
7 jaw-first follow-up. These describe controller state, never physical completion.

Snapshots are bounded and copied under a short lock. Read callbacks do not inspect
live motion state, write settings, send prop commands or log. Disconnect callbacks
only flag advertising restart for the loop, including very short phone connections.
The existing Skelly name discovery and scan-before-connect remain unchanged.

This public experiment exposes no settings, custom device names or addresses.
Anyone nearby can read its model status and attempt a connection. Pairing,
authorization and resource-abuse resistance are **not** a production security design.
No wireless write capability may be introduced without separate security review.
Phone disconnect must not reset the BLE stack or disconnect Skelly.

## Attended gate

1. Save the working firmware/profile. Record a matched ordinary single-role
   head-only baseline, including visible full motions, failures and heap.
2. Upload the isolated experiment; use a GATT inspector to discover/read the
   characteristic. Verify write is unavailable. Read every five seconds.
3. Observe at least 30 minutes of complete head movements. Record resets,
   accepted/failed writes, reconnects and post-warmup heap trend.
4. Exercise 20 phone connect/disconnect cycles, including rapid disconnects;
   verify advertising returns and autonomous head operation continues.
5. While idle, exercise three prop power-off/recovery cycles with the phone
   connected. Name-based recovery must resume complete movement, without stale replay.
6. Repeat using Android and iPhone. Bluefy/Web Bluetooth compatibility remains
   Untested; Safari BLE is not promised. A native GATT inspector proves only that path.
7. Only after this passes, separately test a known jaw profile and lighting profile.

**Pass:** no new physical interruption or reset, phone loss leaves Skelly running,
all recovery cycles succeed, no progressive post-warmup memory decline, and reads
remain bounded. Any interrupted movement is a failure even if all BLE writes succeed.
A 30-minute pass is not endurance evidence. Record phone OS/app versions and actual
observations; do not label this production-ready from software tests.

Exit by uploading the ordinary universal firmware; saved settings formats are
unchanged. Authenticated configuration, scene selection and the Wi-Fi fallback
are deferred until this experiment supplies evidence and a separate review.

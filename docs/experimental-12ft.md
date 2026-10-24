# 2026 app-controlled 12-foot Skelly: experimental compatibility

**Experimental — Not Hardware Tested.** The 6.5-foot Ultra Skelly v2 remains
the default and primary supported model. No one has supplied a physical 12-foot
test of this project. Older 12-foot models without Bluetooth-controlled animation
hardware are excluded. This controller sends BLE commands; it never flashes or
changes firmware on the prop.

## Protocol assessment

Reviewed October 24, 2026 against Martin Ecker's valuable
[Skelly Ultra Web Controller reference](https://github.com/martinecker/SkellyUltraWebController/tree/871efa15ff0dda5e41325b19753dffba4a5c35ee).
The reviewed main revision is `871efa15ff0dda5e41325b19753dffba4a5c35ee`.
Its [device definitions](https://github.com/martinecker/SkellyUltraWebController/blob/871efa15ff0dda5e41325b19753dffba4a5c35ee/js/constants.js)
declare `12ft Skelly`, head bit `0x02`, 20 eyes, one light channel `00`, and
Static/Strobe/Pulsing. They list 12-foot firmware `v14`; this is upstream's
reference entry, not a firmware version tested with our ESP32 controller.

The shared [protocol builder](https://github.com/martinecker/SkellyUltraWebController/blob/871efa15ff0dda5e41325b19753dffba4a5c35ee/js/protocol.js)
uses an AA command prefix, zero padding and reflected CRC-8 polynomial `0x8c`,
initial value zero, covering every byte before the final checksum. Shared AE00,
AE01 and AE02 UUIDs alone would not establish command compatibility. Upstream's
[live handlers](https://github.com/martinecker/SkellyUltraWebController/blob/871efa15ff0dda5e41325b19753dffba4a5c35ee/app-modular.js)
and [settings builders](https://github.com/martinecker/SkellyUltraWebController/blob/871efa15ff0dda5e41325b19753dffba4a5c35ee/js/device-settings.js)
provide additional evidence for reusable AACA movement, AAF9 eyes, AAF2 mode,
AAF3 brightness, AAF4 RGB and AAF6 speed layouts. Existing variable packet
lengths are retained: channel-0 F2/F3/F6 use 11 bytes, F4 uses 13.
The derived 12-foot head request is `AA CA 02 00 00 00 00 00 00 00 94`.
Its bytes coincide with the Ultra arm command; interpretation depends on model.

Upstream's shared [stored-file player](https://github.com/martinecker/SkellyUltraWebController/blob/871efa15ff0dda5e41325b19753dffba4a5c35ee/js/file-manager.js)
uses AAC6, a big-endian file serial and play flag `01`. That suggests transport
reuse, but establishes neither jaw animation nor safe interaction with head,
eyes or lights. **Audio/jaw and passive playback observations remain disabled**
for the experimental profile. Do not transfer this owner's Ultra clip serials
or timing measurements to another prop. No file upload, deletion, renaming,
firmware update, raw command UI or prop storage editing is added.

## Feature and evidence matrix

| Feature | 6.5-foot Ultra Skelly v2 | 2026 app-controlled 12-foot |
| --- | --- | --- |
| Discovery | `Ultra Skelly v2`; Verified | `12ft Skelly`; Software-only |
| Service / write / notify | AE00 / AE01 / AE02 | Same upstream UUIDs; physical connection Untested |
| Head | `0x01`; Verified | `0x02`; experimental, physical movement Untested |
| Arm / torso | `0x02` / `0x04`; Verified | Disabled |
| Compound / jaw-first | Existing separate modes and defaults; see verification matrix | Disabled |
| Eyes | IDs 1–18; live changes Verified | IDs 1–20; experimental, physical response Untested |
| RGB | Channels 0 and 1; physical evidence scoped in matrix | Chest channel 0 only; experimental, Untested |
| Static / Strobe / Pulsing / palettes | Existing reported physical evidence | Upstream-defined; Software-only, physical response Untested |
| Stored audio / jaw | Optional; device-specific clips and modeled duration | Disabled; behavior and interference unknown |
| Personalities / scenes / USB settings | Existing defaults and formats preserved | Restricted to head, eyes, chest; Software-only |
| Scan / reconnect / cooldowns | Existing policy retained | Same lifecycle; Software-only, physical recovery Untested |

Eyes have different numbering between models. Studio maps the 18 available
bundled pictures to the correct 12-foot IDs. IDs 5 and 6 have no bundled artwork;
their numeric choices remain available with no invented preview. IDs 19 and 20
are also available. A preview is not evidence that the prop displays that image.

## Selection, firmware and persistence

Open **Advanced & testing → Experimental device compatibility**. Selecting the
12-foot model changes the advertised discovery name, clears unsupported features,
and starts with head only (eyes and lighting OFF). The visible warning remains
while this model is selected. All personality and scene starter buttons restrict
their settings to this model. Direct incompatible imports/generation fail with an
error; they are not silently converted. Export a scene library before switching
models: a single library/program must use one model and one BLE name.

Download the ordinary sketch for fixed settings, or use Scene builder's USB
sketch download for settings/scenes. First-time setup's universal source download
also follows the selected model and starts with a restricted Subtle seed.
Use First-time setup's browser installer for a model-specific universal package,
or the advanced source fallback with ESP32 Dev Module / Arduino-ESP32 **3.3.12**.
[Browser installation](browser-installation.md) is physically Untested and resets
all ESP32 settings/scenes; back up first. No prop firmware is written.
Wrong-model USB records are rejected by firmware before application or saving.

`DeviceProfile` centralizes firmware head mask, eye count, light channels,
body/audio capabilities, program format and storage namespace. Studio's small
profile map and `adaptDevice` handle selection/preset restrictions. The existing
scheduler, scan-before-connect, discovery refresh, retry policy and disconnect
cleanup are reused. Command entry points and the final BLE writer independently
reject unsupported 12-foot requests. Notifications are not enabled for this model;
unrecognized responses do not drive scheduling or shorten modeled protection.

The initial 12-foot head model is **60 seconds plus a 30-second buffer**,
with configurable Studio request intervals of **90–3600 seconds**. These values
are unmeasured conservative estimates, not a guarantee that an unknown animation
finishes in 90 seconds. `HEAD_ANIMATION_MS` and `HEAD_BUFFER_MS` have explicit
12-foot branches for a future reviewed timing adjustment. USB cannot reduce
these compile-time protections. Do not shorten them based on accepted writes.
Ultra's existing 25+7-second head model and all other motor cooldowns remain.

Old v1–v4 JSON profiles lacking `deviceId` still mean Ultra. Ultra exports and
portable preset files remain v4 and unchanged; experimental exports use v5 plus
`deviceId: "skelly12"`, so older Studio versions reject them. Imports and scene
replacement identify model changes. Mixed-model scenes reject atomically.

Ultra USB records retain version/format word **1**, identical field positions,
limits and record size, and the `skelly-config` NVS namespace. Experimental
records use format word **12**, the same layout, a profile-specific 20-bit eye
mask bound, and a separate `skelly-12ft` namespace. Each firmware accepts only
its own format and capabilities. There is **no migration of existing NVS**.
Source-upload rollback without full erase preserves the previous model's slots, sequence and CRC protections. Browser full-image installation erases both namespaces; restore exported settings afterward.
automatic scene changes still write no flash.

## Attended hardware checklist

Keep the prop's power switch accessible. Use a clear area, keep people away from
moving parts, and disconnect other BLE controllers. For the connect-only step,
choose head OFF, eyes OFF and lighting ON at brightness 0, then set
`LIGHTS_ENABLED = false` in the downloaded sketch before compiling. This provides
a diagnostic build with every actuator request disabled. Keep a known-working
ESP32 sketch and exported settings before any experiment.

1. Confirm the exact **2026 app-controlled 12-foot model**, product number and
   firmware version. Do not assume an older model is eligible.
2. Confirm its advertised name is **12ft Skelly** (or record an intentional rename).
3. Install the connect-only diagnostic on the ESP32. Connect without sending any
   movement/eye/light/audio request. Record discovery and reconnect logs.
4. Use a head-only sketch with a long request interval (for example 600 seconds).
   Observe one isolated request. Power off the ESP32 after that request to prevent
   another scheduled request; it cannot stop an animation already running on the prop.
5. Record actual visible start/end and animation duration. Pass requires visible
   head movement without unrelated motion, reset or interruption. An accepted
   write with no visible motion is a failed physical result, not a pass.
6. With head OFF, test one fixed LCD eye change. Record ID and visible result.
7. With motors/eyes OFF, test chest channel 0 Static, brightness and RGB. Only
   after that passes, test effects and palettes separately. Record visible results.
8. **Audio/jaw remains disabled in this release.** After the preceding checks pass,
   a separate reviewed isolated diagnostic is required before any stored playback
   test. Confirm serial, saved movement flags, actual clip duration and interference
   visually before enabling it in this project.
9. Observe repeated head requests and full cooldowns. Record duration and actual
   start-to-start spacing; increase protection and stop if an animation outlasts it.
10. Test disconnect/reconnect, then a longer attended autonomous run. Record each
    reconnect and visible response; compare heap/reset logs without logging addresses.

**Stop immediately** for unexpected movement, overlapping/interrupted animations,
resets, repeated connection failures or abnormal behavior. Switch off the ESP32
to stop new requests; if the prop continues unexpectedly, switch off prop power.
Do not repeatedly retry the failing command. Preserve logs, model/firmware,
configuration and visual observations separately. Logs, mocks, CRCs, compilation
and write acceptance cannot establish physical compatibility.

## Rollback and known limits

Disconnect the experimental prop. Select **6.5 ft Ultra Skelly v2**, load your
previous Ultra profile/library and install your saved known-working Ultra ESP32
sketch or reviewed Ultra universal package. Reconnect to the Ultra by its name.
Its original `skelly-config` slots are preserved; a firmware reinstall that keeps
NVS can resume them. Avoid an erase-all-flash operation if you want those settings.
An old Studio version must not be used to open experimental profiles/scenes.

Unknowns include actual movement duration, RF reliability, power behavior, exact
LED region/effect behavior, eye response, clip/jaw capability, playback overrides,
notification meaning, repeated reconnect recovery and unattended endurance.
Nothing in this document adds a physical 12-foot verification result.

# Experimental repeat-back lab

**October 26: the owner confirms manual repeat-back and one attended automatic
pilot through Skelly. Both automatic phrases repeated with jaw movement, then the
pilot stopped.** Windows 10 exposes Ultra Skelly v2(Live) Stereo; microphone
model and detailed timing were not supplied. Longer runs, physical Stop/hidden-page
checks, body-still criteria and return to autonomy remain **Untested**. This experiment
is for the 6.5-foot Ultra Skelly v2 only, not the experimental 12-foot model.

Open [Repeat-back lab](../studio/talkback.html) in desktop Chrome or Edge over
HTTPS or localhost. This is a separate static page with no link in the ordinary
Studio controls. It does not change or install ESP32 firmware. It requires a
computer/browser while in use; ordinary autonomous operation remains independent.

For a local checkout with Python installed, run
`python -m http.server 8765 --bind 127.0.0.1` from the repository root, then open
`http://127.0.0.1:8765/studio/talkback.html`. This local static file server works
without internet access. Stop it with Ctrl+C when finished. Direct `file://` pages
are not the supported microphone/Bluetooth test path.

## What the first version does

Choose **Record a phrase**, speak, then **Stop recording**. Recording also stops
at eight seconds. Choose **Repeat** to play the clip; playback is deliberately
explicit. **Stop & discard** clears it and releases microphone/audio resources.
Leaving or hiding the page cancels pending work and discards the recording.

Audio stays in tab memory; manual recorded data is bounded to 1 MiB. Automatic
capture has the separate sample/WAV bounds below. The page does not
store recordings, upload them to Skelly or send them to a server. There are no
accounts, API keys, paid services, network libraries or automatic connections.
Use computer sound settings to select the microphone and output. The optional
Choose speaker button uses the browser's picker where supported. Chrome/Edge can
instead list the audio outputs exposed by the browser. If only the default is
visible, record a phrase and allow microphone access, then choose speaker again;
microphone permission can reveal more output devices. You can also select the
output in Windows Sound settings. The button is disabled only when neither
selection path is supported. An unavailable selected output fails instead of silently switching sinks.
With system-default output, the OS may change the destination if a speaker drops;
verify the actual destination at low volume.

Voice effects and AI replies are not implemented. The optional automatic pilot
uses local sound-energy detection; it does not recognize words or distinguish
people from music, wind, pets or other noise.

## Automatic repeat-back pilot

Automatic mode defaults OFF. After a successful manual output/jaw test, expand
the pilot, confirm attendance/output/isolation, choose sensitivity and explicitly
press **Start automatic pilot**. Stay quiet for the first second while background
noise is measured, then speak a short phrase. About 0.8 seconds of quiet ends it;
capture is capped at eight seconds. A quarter-second pre-roll preserves onset.

The microphone stream and capture graph close before WAV playback. The mic stays
off during a **45-second pause after playback**, then the pilot listens for the
second phrase. This conservative first test stops after **two repeats or two
minutes**, whichever happens first. No complete phrase within 30 seconds stops
the pilot. Silence calibration that is too loud, audio processing overload,
permission/capture/output failures, a changed audio device, Stop, hiding the page
or leaving it all stop the pilot without automatic restart. There are no BLE
commands in automatic mode; it uses the already paired computer audio output.

Capture runs locally with an AudioWorklet at 16 kHz mono. Waiting retains only
the latest quarter second; a phrase holds at most 128,000 float samples, and its
WAV is at most 256,044 bytes. Audio stays in memory. No recordings or calibration
values are saved or uploaded. A browser lacking the required Web Audio support
can still use manual recording. Input audio is never monitored to the speakers.

For the first attended test, start with computer speakers at low volume. Check
that the first phrase repeats once, the microphone turns off during playback and
the 45-second pause, and the second phrase ends the pilot. Repeat with Skelly only
after selecting its paired Stereo output and unplugging the autonomous ESP32.
Observe sound, jaw, unexpected body movement and stop behavior. A false trigger,
clipped phrase or failure to stop is a failed pilot test. The owner confirms both
phrases repeated with jaw movement and the pilot stopped in one attended run.
This does not establish cooldown sufficiency for longer sessions.

## Hardware choices

For initial testing use a laptop's built-in microphone or a USB microphone, and
start with computer speakers. Then use Skelly's own Bluetooth **(Live)** speaker.
A separate external speaker does not establish jaw synchronization on Skelly.

A Bluetooth microphone/speaker combo may work as computer input/output if its
profiles and operating system support it. A2DP speaker playback alone does not
provide microphone input: hands-free microphone audio uses HFP roles and a
different audio path. Do not buy an unspecified Bluetooth combo assuming it will
be a drop-in ESP32 microphone. A wired I2S microphone is a simpler direction for
an eventual embedded prototype.

Original ESP32 supports both BLE and Classic Bluetooth/A2DP. BLE control plus one
A2DP speaker connection is a plausible design, not a demonstrated fit for this
controller. Adding a Bluetooth microphone adds HFP role/routing/coexistence work;
simultaneous A2DP output to Skelly and another speaker is outside this design.
ESP32-S3 supports BLE only, so it is not a direct replacement for a Classic-A2DP
design. A five-second 16 kHz, 16-bit mono raw recording consumes 160,000 bytes
before stack/codec buffers. Memory, flash fit, radio sharing, stream interruptions
and reconnect behavior require measurement on the exact board and pinned core.

A future dedicated audio companion can keep capture/streaming work separate, but
it must coordinate exclusive control with the autonomous scheduler before both
operate together. Do not run two independent BLE controllers against the prop.
Full English transcription and open-ended AI conversation belong on a separate
computer or optional service; simple recording/replay needs neither.

## Isolated prop setup and recovery

1. Preserve your working routine. Let current movement finish, unplug the
   autonomous ESP32 **including USB**, close other control apps/tabs and put Skelly in Bluetooth mode.
2. Expand the isolated live-audio section and confirm those conditions. Select
   your Ultra by its exact advertised name. No hardcoded device address is used.
3. The page connects after the device chooser, writes exactly one upstream-based
   `AAFD` request with payload `01` and CRC, then releases BLE. It sends no motor,
   eye, light, volume, file-transfer or settings commands. The completed write
   confirms transport only; it does not confirm live mode, sound or jaw response.
4. Pair the advertised `(Live)` speaker in computer Bluetooth settings and choose
   it as the computer output. On Windows 10, open **Settings → Devices →
   Bluetooth & other devices → Add Bluetooth or other device → Bluetooth**;
   the main settings list shows devices already added. If asked for a PIN, the
   [community integration documents `1234` as the default](https://github.com/martinecker/SkellyUltra#-live-mode-bluetooth-pairing).
   Use the configured PIN if changed. The [manufacturer says DecorPro’s Edit Name section shows the PIN](https://support.sviservice.com/hc/en-us/articles/37548063705239-DecorPro-SVI-App).
   Start with low volume and a short phrase. Observe
   both sound and motion. Do not use firmware's modeled MP3 completion as live
   stream telemetry.
5. Stop & discard, disconnect the computer from the live speaker, and power-cycle
   Skelly before turning the autonomous ESP32 back on. Closing the page cannot
   recall a BLE request already sent or disable prop live mode. An already queued
   Bluetooth audio buffer may finish after browser playback stops.

If any unexpected body movement, reset, feedback or repeated connection failure
occurs, stop playback and power off the prop. Keep the ESP32 off until the prop
has been returned to the known-working configuration. This page cannot observe
physical cooldowns or guarantee the motor has stopped.

### If Enable live audio fails

The browser chooser's **Pair** button selects a BLE control device. Pairing the
separate **(Live)** audio speaker in Windows happens after the enable request.
The page now identifies selection, BLE connection, service discovery and the
single write separately. A connection/discovery failure before that write means
**no live-enable request was sent**. A failure or cancellation after a write was
attempted leaves the prop's state uncertain; inspect it and power-cycle before
another setup attempt. There is no automatic retry.

For a connection-stage failure, keep the ESP32 unplugged and other apps closed,
let any movement finish, turn Skelly off for 10 seconds, then return it to
Bluetooth mode. Keep the computer close to the prop, hard-refresh the page and
make one manual attempt. Report the exact failed stage. If the BLE connection
still fails, investigate the computer/adapter/prop link before audio routing or
jaw synchronization. Do not change firmware or send motor commands to diagnose it.

## Attended result sheet

| Test | Pass criterion | Evidence |
| --- | --- | --- |
| Local microphone | Permission requested only on Record; phrase repeats clearly; mic indicator turns off before playback | Owner reports local repeat-back works; detailed permission/indicator check pending |
| Stop/leave | Recording and playback stop; recording cannot be replayed; hidden page never restarts listening | Software-only mocks; physical check pending |
| Live enable and pairing | Correct Ultra selected; live speaker becomes available and pairs; no unexpected motion | Owner reports completed write, Bluetooth chime, and successful Windows pairing with documented PIN 1234. Windows reports the Ultra Skelly v2(Live) Stereo audio endpoint OK. Sound/jaw confirmed below; unexpected-motion criterion not separately reported. |
| Output routing | Sound physically comes from the selected output, not unexpectedly from computer/external speakers | Verified (owner report): manual phrase came from Skelly |
| Jaw response | Jaw visibly follows short speech from the live speaker; body remains still | Owner confirms manual phrase jaw response and both automatic phrases with jaw movement in one pilot; body-still criterion not separately reported |
| Automatic pilot completion | Both phrases repeat through Skelly with jaw movement, then the pilot stops | Verified (owner report), October 26: both phrases repeated with jaw movement, then the pilot stopped; autonomous ESP32 unplugged |
| Automatic capture and cancellation | Bounded capture, mic off during playback/pause, no self-repeat, Stop/hidden page end it | Software-only coverage; these individual physical/indicator checks were not separately reported |
| Repetition | Three short manual phrases complete normally without feedback, resets or extra motion | Untested |
| Return to autonomy | After documented power-cycle sequence, the saved ordinary routine works as before | Untested |

Record browser/OS, microphone, output device, prop model, observed sound/jaw/body
behavior and stop/recovery results. Do not include personal Bluetooth addresses
or bystander audio in a public report. Browser `ended` and BLE write success are
software events, not physical observations.

Run `node --test studio/tests/talkback*.test.cjs` for recording lifecycle,
bounded memory/time, late permission/connect results, cancellation, output failures,
UI gating, speech segmentation/WAV bounds, worklet overload, automatic session
limits/cleanup and exact live-enable packet tests. Full baseline and pinned compilation
requirements remain in [testing](testing.md). Firmware and generation are unchanged.

## Primary research references

- [FrightMaps live speaker setup](https://frightmaps.com/blog/how-to-make-your-12-foot-skeleton-talk): separate control and speaker links; vendor claims are not our hardware verification.
- [Community live-enable handler](https://github.com/martinecker/SkellyUltraWebController/blob/main/app-modular.js) and [command definitions](https://github.com/martinecker/SkellyUltraWebController/blob/main/js/constants.js): `ENABLE_CLASSIC_BT` / `AAFD`, payload `01`. No upstream implementation is copied into this experiment.
- [ESP32 profiles and roles](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/classic-bt/profiles-protocols.html): A2DP and HFP have different roles.
- [ESP32 A2DP examples](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32/api-reference/bluetooth/esp_a2dp.html): source and coexistence examples; not validation of our GATT-client application.
- [ESP32-S3 Bluetooth limitations](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/ble/overview.html).
- [Browser output selection](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput): feature-detect; OS settings remain the fallback.

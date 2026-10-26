# Browser installation and first USB configuration

Use **Studio → Connect & save → First-time setup**. The recommended
path is **Connect ESP32 → Install Firmware → Configure Skelly**. No Arduino
software, manual Actions download, GitHub account, backend or paid hosting is
needed. An original ESP32-WROOM development board with 4 MB flash and a USB data
cable are required. Use a desktop browser with Web Serial (Chrome/Edge recommended)
over HTTPS or localhost. Browser flashing is **Software-only / physically Untested**.
The owner's successful USB read/save and preview reports do not establish flashing.

## Three steps

1. Plug the ESP32 into your computer. Close serial monitors, other USB tabs and
   direct audio connections. Keep Skelly powered off during installation.
2. Back up existing source/settings. In Studio, an existing universal controller
   can be connected, read and exported as scenes. On the setup page, confirm the
   board and overwrite notice, then Prepare universal firmware. Review the release,
   source commit, model and hash result. Choose Connect ESP32 & install firmware,
   select its USB-UART port and follow the ESP Web Tools dialog. Do not unplug
   during writing. **The full-image installation resets ESP32 settings/scenes and
   replaces its firmware, even when using a previously compatible NVS format.**
3. After the installer reports completion, close its dialog. Continue to USB
   configuration, Connect ESP32 again and wait for Ready (up to 45 seconds).
   Choose your settings, check the replacement confirmation and **Save this
   routine**. Wait for read-back verified, then disconnect USB. Turn Skelly on,
   disconnect other BLE controllers and visually check a simple attended routine.

You do **not** need a scene for a first routine. Save this routine sends the
current editor settings as one program. Save scene collection sends the saved
Scene builder library and its switching policy. Both replace the current ESP32
program; neither flashes firmware. Changes use the existing USB transaction,
CRC, idle-boundary protection and read-back. Firmware, USB field layout, motor
timing and existing profiles/scenes are unchanged by this installation UI.

Ultra remains the default. Deliberately selecting the experimental 2026 12-foot
profile in Advanced chooses a separate restricted universal package. Its return
link restores that model in the editor with the warning visible. Unknown or
mixed models reject before offering an installer. No older 12-foot models are
included, and no firmware is written to the prop.

## Package provenance and free hosting

`Build USB installer packages` compiles head-only Ultra plus universal Ultra and
experimental 12-foot ESP32 images with Arduino-ESP32 **3.3.12**, explicit DIO flash
mode and the original ESP32 target. Universal seeds are head-only, optional features
OFF: Ultra 60–120 s, experimental 90–120 s. Body protections are unchanged.

On a successful **main** smoke-test run, the packaging workflow checks out that
exact tested SHA. It validates both universal artifacts (model, source commit,
freshly regenerated source hash, binary hash, size, boot/app headers, safe seed,
release and manifest), builds the existing static site, and uploads one Pages
artifact. Deployment refuses a SHA that is no longer main. PRs and manual package
runs build artifacts but cannot deploy. Pages must use **GitHub Actions** as its
publishing source. The `github-pages` environment and Pages/OIDC permissions are
limited to the deploy job; the build job has read-only repository access.

`studio/firmware/catalog.json` selects packages beneath
`studio/firmware/<release>/<full-source-SHA>/<model>/`. The browser accepts only
these constructed same-origin paths, rejects redirects, bounds downloads and
checks SHA-256 plus chip/core/model/release/headers before offering USB access.
Only verified bytes become the installer's Blob image. Stale/mixed deployments
fail closed with reload/retry guidance. Hash consistency is not a publisher
signature: trust the reviewed repository and its HTTPS Pages origin. No private
token is shipped to the browser. Versioned paths identify this deployment's
packages; old paths are not promised permanent retention. CI artifacts retain
the reviewed packages for 90 days for maintainers.

The existing pinned **ESP Web Tools 10.2.1** loads from unpkg only on explicit
preparation. Internet is needed for first installation. Offline generation and
USB settings remain local; installed firmware runs without internet or a browser.
The manifest offers only ESP32, forces a fresh installation and disables the Wi-Fi
provisioning wait. ESP Web Tools rejects other chip families before erase/write.
It cannot prove the exact WROOM module, flash capacity, power quality or USB cable;
the board marking/specification check remains explicit.

The installer owns progress and completion reporting. Studio does not infer a
successful flash from opening/closing a dialog and never opens the configuration
port automatically. Close the installer and choose Connect ESP32 again. This
also avoids two readers contending for the same USB port.

## Recovery and advanced fallback

### Updating an existing controller

Ordinary routine changes need only **Save this routine** or **Save scene
collection**. For a firmware update, use the existing export/import workflow:

1. Export any browser scenes and current editor profile you want to keep **before
   reading the ESP32**. Browser scenes and controller settings may differ. A read
   offers to replace the browser library; accepting replaces it and loads the
   first controller scene. Declining keeps the browser library, so exporting it
   afterward would not back up the controller program.
2. Connect, choose **Read saved settings**, and accept the replacement preview
   after preserving your browser work. In Scene builder choose **Export scenes**.
   Keep this controller backup distinct from your browser backup. USB reads
   recover runtime settings, not browser-only labels or the actual audio files.
3. Disconnect USB, install the reviewed package, close the installer dialog, and
   reconnect. Compare both reported firmware revision and build with the package.
   An unknown version is not proof that an update is needed; a different/newer
   revision must not be labeled current solely because its build number matches.
4. Choose **Import scenes**, review the preview and accept it. Use **Save scene
   collection** to restore the complete exported program, including its switching
   policy. **Save this routine** would send only the editor's current scene.
   Require read-back verification, then restart and read again to check retention.
   Observe physical behavior separately, with Skelly attended.

Keep the known-working sketch/package with the exports for rollback. An older
firmware may reject newer capabilities; do not force incompatible settings or
assume full-image flashing preserves NVS. There is no automatic backup/restore.

No port: use a data cable, another USB socket and the board's CP2102/CH340 driver.
Port busy: close serial monitors/apps/tabs. Failed initialization: hold BOOT while
connecting and release after detection; retry with EN/Reset if needed. Wrong chip:
use original ESP32-WROOM, never force another family. A cancellation before writing
changes no firmware; interrupted writing requires a complete reinstall. After
completion, close the dialog, press EN/Reset if needed, reconnect in Studio and
Retry identification. Keep logs if Ready never appears.

Advanced Arduino fallback in Studio downloads model-specific universal source.
Use ESP32 Dev Module and core 3.3.12. A local reviewed `build.json` plus its matching
binary remains available under Advanced on the installer page. Legacy metadata
without a model means Ultra. The fixed head-only package cannot accept USB settings;
it is clearly identified and is not the beginner default.

Rollback: install your saved known-working ESP32 sketch or reviewed package, then
restore exported profiles/scenes over USB. **Do not rely on old NVS surviving a
browser full-image installation.** Switching models normally uses separate
namespaces/formats, but full erase clears both. Nothing changes the prop firmware.

## Short attended hardware checklist

Keep a known-working sketch, exported scenes and the prop power switch accessible.
Record board marking/flash size, USB adapter, browser/OS, package release/full SHA
and result separately from software logs.

1. With Skelly OFF, back up settings. Check unsupported browser guidance and that
   preparing a package opens no USB port. Cancel the chooser before writing and
   confirm there is no installation success claim.
2. On the correct original ESP32-WROOM/4 MB board, accept the explicit data-loss
   warning. Install the hash-checked universal package; record actual dialog
   progress/completion and any BOOT/EN intervention. Do not deliberately interrupt
   a working flash as a beginner test.
3. Close the installer. Follow Continue to USB configuration, connect again and
   confirm Ready and the expected firmware revision/build. Read the safe head-only
   seed; confirm optional features OFF and old ESP32 scenes reset as warned.
4. Save a simple routine without creating scenes; require matching read-back.
   Reconnect/power-cycle and read again. Then test a two-scene collection separately.
5. Power Skelly on and visually confirm the selected behavior, cooldowns and
   reconnect. Record physical results separately; USB readiness/read-back/accepted
   BLE writes do not prove movement. Use the separate 12-foot checklist for that model.
6. Exercise port-busy recovery and Arduino fallback on an attended spare board.
   If a spare unsupported chip is available, confirm rejection **before** erase or
   writing; otherwise leave this hardware check Untested.

**Stop:** unexpected movement, repeated resets, lost USB during writing or repeated
connection failures: turn off ESP32 and Skelly, retain logs, and recover the ESP32
with the known-working firmware before testing again. Pass requires an observed
complete flash, successful configuration/read-back, retention and separately
observed physical behavior. Until an owner supplies those results, browser
flashing/recovery stays **Untested** in the hardware matrix.

Primary references: [ESP Web Tools manifest/merged-image requirements](https://esphome.github.io/esp-web-tools/),
[pinned installer source](https://github.com/esphome/esp-web-tools/tree/10.2.1),
[GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

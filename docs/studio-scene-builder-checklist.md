# Scene builder and compact lighting refresh

## Eye and lighting editing with compact preview · October 25

This follow-up changes browser editing only. Existing firmware, offline sketches,
profile/USB formats and hardware evidence retain their scope. Browser samples
are illustrations; no measured prop speed or physical integration pass is added.

1. Confirm Eyes and Lighting follow Movement directly, without a separate scene
   look heading. Open Scene builder for its name/duration and Update/Save actions. Edit a saved
   scene and confirm its preview follows the draft while the sequence strip keeps
   the saved duration/colors until Update. Ordered mode totals holds plus action
   completion/reconnect time; random mode promises no exact loop duration.
2. Choose stored eyes, fixed or rotation. Select an entire thumbnail or enlarge
   its preview. Descriptive labels use exact model numbering, with no favorites
   or nickname fields. Switching models updates the labels and artwork; missing
   12-foot artwork stays unavailable. Older local eye nicknames are ignored.
3. Apply a quick look with Eyes and lights only. Preserve the scene name/hold,
   movement, mouth and protection settings. Complete routine starts a new scene
   and asks before discarding edits. Copy just lights or eyes from a saved scene;
   verify the other fields and original saved scene stay intact until Update.
4. Edit a palette. Typing changes only its draft sample. Cancel, close or Escape
   preserves the original colors/name and editor draft. Apply commits valid
   values. Loading different settings discards an open palette draft. In rotation
   mode, palette buttons toggle inclusion and retain at least two choices.
5. Select Pulsing or Strobe. The corresponding Torso/Head swatches animate by
   default under Lighting in Your Skelly; native color pickers stay clear and static.
   Brightness and speed affect each channel independently. The compact preview
   has a local Pause/Resume button and labels timing as illustrative. Preview never
   changes stored RGB; browser strobe is capped at two flashes/second.
   Reduced motion keeps samples still; hiding the tab pauses animation.
6. Test phone/keyboard flow and offline editing. Preview and palette drafts open
   no USB/Bluetooth port. Connect and explicitly save a
   routine/collection to update the ESP32. Read-back confirms configuration,
   while physical response still requires observation.

Exact effect-speed matching needs optional attended measurements: motors, eyes,
mouth, clock and idle breaks OFF; rotation OFF; one channel Pulsing and the other
Static. Compare slow and faster settings (for example 32 and 96) for 20 seconds
each, then swap channels. Record visible cycle counts and exact settings. Existing
effect reports do not establish a seconds-per-cycle curve. Strobe observations
remain optional and brief where flashing is suitable. No firmware change is
needed for these browser samples, and no physical calibration has been recorded.

October 23, 2026. Browser changes only: firmware, USB commands, version-4 profiles
and version-1 scene libraries remain compatible. No new firmware upload is needed.
Existing libraries remain under the same browser storage key. No hardware port is
opened automatically; every controller save still requires explicit consent and
matching read-back. Earlier physical passes remain recorded separately.

## Short browser checks

1. Open Scene builder. Save a new scene, edit its movement or colors, then choose
   **Update scene**. Confirm there is one updated card. **Save as new** requires a
   different name; it never silently replaces an existing scene.
2. Duplicate and rename a scene, reorder with the up/down buttons, then delete and
   Undo. The first card is the starting scene. Ordered rotation shows the total
   programmed holds; random rotation has no promised full-loop duration.
3. Edit a scene without updating it, then try editing another. **Keep editing**
   preserves the current draft. Revert restores its baseline. Drafts are saved
   locally when settings are valid; reload, use the recovery notice, and Restore.
   Invalid fields do not overwrite the previous valid draft. Storage failures say
   **session only**; export a copy before closing. Drafts are recovery copies, not
   scenes sent to a controller.
4. Import an exported library. Inspect its names/durations and replacement count;
   Cancel or Escape keeps the current library/editor. Confirming replacement loads
   the first imported scene. A USB read also asks before replacing existing work.
5. Open lighting adjustments. Head and Torso have color, brightness and effect
   controls. Static hides speed. Brightness shows percent while retaining the exact
   stored 0–255 value. Edit opens only one palette, with an optional color link.
   Rotation uses saved palette colors; effects and brightness apply to all palettes
   within that scene. Apply palette commits staged editor changes; Cancel/Escape
   discards them. Update/save the scene to keep applied changes in the library.
6. Choose Complete routine in the quick look scope, then Moonlit Watcher, Haunted Porch or Ember Glow. Check the
   movement/eye/light summary and customize before saving. These opt-in examples
   start at 10 minutes, brightness 255/speed 125, mouth and clock windows OFF. They
   are software-validated combinations, not new physical integration passes.
7. Choose 5 or 15 minutes for the editor timing illustration. In Scene builder,
   **Routine preview** shows each saved scene’s own hold and sample request tracks.
   Unsaved edits appear there only after Update scene. Switching off dims later
   scenes; random labels alternatives without promising an exact order or loop.
   Long intervals should appear in longer holds. Short-scene notes are advisory;
   the preview does not arbitrate actual motion, cooldowns, clock windows or BLE
   connection delays. It changes no routine settings or firmware timing.
8. Check phone layout, keyboard focus, dialog Escape/Cancel, and offline use from
   the complete Studio folder. No cloud connection is needed for scene editing.

## Optional USB spot check with the existing universal firmware

Connect/read once. The browser scene library, editor's unsaved changes and last
verified ESP32 program are separate. Edit a setting: it must not claim the change
is already on the ESP32. Save routine or update the scene and Save scenes, with
replacement consent. A save compares against its acknowledged snapshot even if
the editor changes during transfer. Sending saved scenes with unfinished editor
changes asks first; cancellation sends nothing. Disconnect clears comparison with
the current controller. Read-back is configuration evidence, not actuator feedback.

The owner has already confirmed USB read/save and observed changed behavior, plus
the previous USB workflow working well. No repeat of those observations is required
solely for this refresh. Power-cycle retention/recovery and ordered/random scene
transitions remain separate physical checks in [USB settings/scenes](usb-settings-scenes.md).

## Small follow-up checks

The owner reports that the focused checklist seemed to work. No per-item results
or physical transition/retention observations were supplied with that report.

- Collapse and reopen Start here with mouse and keyboard. Idle breaks is now inside
  Advanced; its saved setting and timing fields remain available there.
- Choose Normal: eye #1 is on and fixed. Choose Haunted: eyes 1–8 are selected,
  random every 150–300 seconds. The summary eye thumbnail is small; its rotation
  marker appears only for multiple enabled expressions and disappears when off.
- Load each complete look. Check its labeled motor intervals against Body movement,
  as well as eyes/lights. Moonlit turns the arm/torso off, Ember enables the arm,
  Haunted enables all three plus combined actions. Save as new to retain the look.
- Check Routine preview after Update, reorder, Delete/Undo and changing order mode.
  Each track uses that scene’s duration. Fixed eyes/colors apply at connection and
  have no recurring ticks. No-request samples are labeled. No port opens from previews.

No firmware reinstall is needed for these interface changes. Selecting the new
personality defaults changes only the editor until you explicitly save/upload.

## Compact scene library and decorative motion previews

- Saved cards keep Edit visible. More options reveals duplicate, rename, reorder,
  delete and timing notes. A timing-note hint remains visible when folded.
- Routine preview shows one saved scene at a time; use Preview scene to choose.
  Changing this dropdown never loads the editor, changes the saved order or sends
  settings. Rename/reorder preserves the chosen preview; deleting it chooses a
  remaining scene. New/updated scenes select their own preview.
- Purple body illustrations replace the static left icons and animate only when enabled,
  with still pauses between turns. Torso turns include a visible side-to-side lean.
  There is no animation checkbox or helper text. The system reduced-motion
  preference disables animation; hidden pages pause it.
  These are illustrations, not a Bluetooth/physical animation status indicator.
- Check the new controls at phone width and with a keyboard. Existing USB and
  physical checks do not need repeating just for this interface-only change.

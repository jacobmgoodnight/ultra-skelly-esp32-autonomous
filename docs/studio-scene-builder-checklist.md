# Scene builder and compact lighting refresh

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
   within that scene. A palette editor's Done retains current editor changes; save
   the scene to keep them in the library.
6. Select a complete look: Moonlit Watcher, Haunted Porch or Ember Glow. Check the
   movement/eye/light summary and customize before saving. These opt-in examples
   start at 10 minutes, brightness 255/speed 125, mouth and clock windows OFF. They
   are software-validated combinations, not new physical integration passes.
7. Choose 5 minutes, 15 minutes or Scene duration for the timing illustration.
   Long intervals should appear in longer windows. Short-scene notes are advisory;
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

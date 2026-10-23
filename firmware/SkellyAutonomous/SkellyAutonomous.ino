#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <BLEClient.h>
#include <esp_system.h>
#include <stdarg.h>
#include <string.h>
#include <stdlib.h>

// Isolated status experiment only. Normal/generated/universal builds stay OFF.
#ifndef SKELLY_WIRELESS_STATUS
#define SKELLY_WIRELESS_STATUS 0
#endif
#if SKELLY_WIRELESS_STATUS
#include <BLEServer.h>
#endif
const uint32_t FIRMWARE_REVISION = 4; // usb-scheduler-v4
const uint32_t FIRMWARE_BUILD = 2026102301UL;

// =============================================================
// ULTRA SKELLY V2: RANDOM HEAD + SILENT JAW + OPTIONAL EYES
// ESP32 Dev Module, Arduino-ESP32 3.3.12
// Optional torso and arm movements default OFF; both commands physically tested.
// Body motor commands are serialized (head/torso/arm), jaw audio may overlap.
// One-shot and randomized eye commands worked on real Skelly hardware.
// Eye/jaw synchronization below is a NEW option requiring field testing.
// =============================================================

#define SKELLY_NAME "Ultra Skelly v2"
#define SERVICE_UUID "0000ae00-0000-1000-8000-00805f9b34fb"
#define WRITE_UUID   "0000ae01-0000-1000-8000-00805f9b34fb"

// -------------------------------------------------------------
// UPDATE THIS AFTER UPLOADING THE REVISED JAW FILE IF ITS SERIAL CHANGES.
// In Skelly Web Controller > Files on Device, find the new file's
// serial number. Set to that exact number (NOT a guessed number).
// Confirmed original jaw clip is file #12. If v2 uploads as a NEW file,
// update this to its NEW serial number. 0 disables mouth playback.
// -------------------------------------------------------------
const uint16_t MOUTH_FILE_SERIAL = 12;
const bool MOUTH_ENABLED = true;
const bool HEAD_ENABLED = true;

// Existing verified head behavior (start-to-start)
const uint32_t HEAD_ANIMATION_MS = 25000;
const uint32_t HEAD_BUFFER_MS = 7000;
const uint32_t HEAD_MIN_INTERVAL_MS = 32000;
const uint32_t HEAD_MAX_INTERVAL_MS = 60000;

// Advanced body movements. Torso AACA 0x04 worked (~25 sec) on original Skelly.
// Arm AACA 0x02 physically tested: two arm motions in 22 seconds.
// OFF by default in the checked-in firmware. Haunted preset opts into both.
const bool TORSO_ENABLED = false;
const bool ARM_ENABLED = false;
// Advanced opt-in only. When true, body motors may run at the same time.
// FAILED physically: a later separate command interrupts the previous action.
// Retained only for old diagnostic sketches; Studio always emits false.
const bool ALLOW_BODY_MOTOR_OVERLAP = false;
// Opt-in coordinated body motions: send ONE tested AACA mask, not several
// competing AACA packets. This mode replaces standalone body scheduling.
// Each mask must contain only motors switched ON below.
const bool COMPOUND_BODY_ENABLED = false;
// Keep legacy combined-only sketches compatible; Studio can interleave safely.
const bool COMPOUND_ALONGSIDE = false;
const uint8_t COMPOUND_BODY_MASKS[] = {0x03, 0x05, 0x06, 0x07};
const uint32_t COMPOUND_BODY_MIN_INTERVAL_MS = 180000;
const uint32_t COMPOUND_BODY_MAX_INTERVAL_MS = 360000;
// AAC6 playback appears to reapply the MP3's saved movement flags (0x00)
// and can interrupt head, torso or arm motion. With protection ON, finish
// any current body animation (including head) before starting the MP3, and
// defer new standalone body moves while AAC6 is due or playing. Verified
// jaw-first ARM/TORSO follow-ups are allowed as deliberate exceptions.
// Name retained for compatibility with existing Studio sketches.
const bool JAW_PROTECTS_ARM_TORSO = true;
// EXPERIMENTAL: deliberately send AACA AFTER AAC6 playback begins.
// 0 = disabled (default); 1 = arm; 2 = torso; 3 = alternate arm/torso;
// 4 = HEAD after jaw (FAILED at 2s and 10s). Only ONE motor follows each MP3.
// Mode 3 requires recurrence in Studio. All modes are OFF by default.
// If AAC6 applies 0x00 movement flags only once at playback start, this may
// allow jaw + motor together. The reverse (AACA stops jaw) is also possible.
const uint8_t JAW_FOLLOWUP_MOTOR = 0;
const uint32_t JAW_FOLLOWUP_DELAY_MS = 2000;
// false = one successful diagnostic test per BLE connection.
// true = trigger the selected motor only when its own configured random
// frequency is due; wait for the next jaw clip, not every clip. This
// alternating arm/torso dispatch ran ~30 minutes; wider integration needs testing.
const bool JAW_FOLLOWUP_RECURRING = false;
const uint32_t BODY_WRITE_SPACING_MS = 600;

// Live lighting from the community controller: 0 = TORSO, 1 = HEAD LIGHT.
// Channel 1 is NOT independently verified as the mouth LEDs.
// Use F2 static mode, F3 brightness and F4 RGB (13-byte write).
// Off by default; MP3s may restore their SAVED per-file lighting.
const bool LIGHTS_ENABLED = false;
const uint8_t TORSO_LIGHT_R = 255, TORSO_LIGHT_G = 0, TORSO_LIGHT_B = 0;
const uint8_t HEAD_LIGHT_R = 255, HEAD_LIGHT_G = 96, HEAD_LIGHT_B = 0;
const uint8_t TORSO_LIGHT_BRIGHTNESS = 180;
const uint8_t HEAD_LIGHT_BRIGHTNESS = 180;
// Experimental effects: 1 static, 2 strobe, 3 pulsing. Static preserves six writes.
const uint8_t TORSO_LIGHT_MODE = 1;
const uint8_t HEAD_LIGHT_MODE = 1;
// Device scale: 0 fast .. 254 slow (inverse of the upstream UI slider).
const uint8_t TORSO_LIGHT_SPEED = 190;
const uint8_t HEAD_LIGHT_SPEED = 190;
const bool LIGHT_ROTATION_ENABLED = false;
const uint32_t LIGHT_ROTATION_INTERVAL_MS = 90000;
const uint8_t LIGHT_PALETTE_MASK = 15; // Halloween, Haunted, Moonlight, Ember.
const uint8_t LIGHT_PALETTES[4][6] = {
  {255,96,0,0,255,0}, {128,0,255,0,230,204},
  {23,107,255,200,232,255}, {255,24,0,255,176,0}
};
static_assert(TORSO_LIGHT_MODE >= 1 && TORSO_LIGHT_MODE <= 3 &&
              HEAD_LIGHT_MODE >= 1 && HEAD_LIGHT_MODE <= 3 &&
              TORSO_LIGHT_SPEED <= 254 && HEAD_LIGHT_SPEED <= 254,
              "Invalid light effect or speed.");
static_assert(LIGHT_ROTATION_INTERVAL_MS >= 15000 && LIGHT_ROTATION_INTERVAL_MS <= 3600000 &&
              LIGHT_PALETTE_MASK > 0 && LIGHT_PALETTE_MASK < 16 &&
              (!LIGHT_ROTATION_ENABLED || (LIGHT_PALETTE_MASK & (LIGHT_PALETTE_MASK - 1)) != 0),
              "Rotation needs two palettes and a 15-3600 second interval.");
// 0: apply once after connection; 1: also restore AFTER an MP3 (conservative);
// 2: restore 3s into MP3 and again after MP3 (experimental).
const uint8_t LIGHT_RESTORE_MODE = 1;
const uint32_t LIGHT_WRITE_SPACING_MS = 300;
const uint32_t LIGHT_RESTORE_GRACE_MS = 500;
// OFF normally. Enable for an attended lighting/MP3 diagnostic run.
const bool DIAGNOSTICS_ENABLED = false;
const uint32_t TORSO_ANIMATION_MS = 25000;
const uint32_t TORSO_BUFFER_MS = 10000;
const uint32_t TORSO_MIN_INTERVAL_MS = 240000;
const uint32_t TORSO_MAX_INTERVAL_MS = 420000;
const uint32_t ARM_ANIMATION_MS = 22000; // measured: two back-to-back arm movements
const uint32_t ARM_BUFFER_MS = 10000; // conservative added cooldown (32 s total)
const uint32_t ARM_MIN_INTERVAL_MS = 360000;
const uint32_t ARM_MAX_INTERVAL_MS = 720000;

// New jaw clip: 20.16 s including MP3 encoding padding
const uint32_t MOUTH_CLIP_MS = 21000;
const uint32_t MOUTH_BUFFER_MS = 1000;
const uint32_t MOUTH_MIN_INTERVAL_MS = 45000; // minimum 45 sec between starts
const uint32_t MOUTH_MAX_INTERVAL_MS = 90000; // maximum 90 sec between starts

// Experimental live eye expressions (1..18 from upstream web controller).
// First run experiments/EyeSingleTest before changing this to true.
// One-shot and randomized eye changes were physically verified on the test prop.
const bool EYES_ENABLED = false;
const bool EYE_ROTATION_ENABLED = true;
const uint32_t EYE_MIN_INTERVAL_MS = 120000; // 2 minutes
const uint32_t EYE_MAX_INTERVAL_MS = 300000; // 5 minutes

// MP3 playback can overwrite a previously selected live eye icon.
// 0 = leave MP3's eye setting alone
// 1 = restore the chosen eye shortly after jaw starts and when it ends (default)
// 2 = choose a new random eye when jaw starts, then keep it after playback
// Eye/jaw coordination is a NEW feature. Eyes stay OFF until enabled above.
const uint8_t EYE_JAW_MODE = 1;
const uint32_t EYE_JAW_START_DELAY_MS = 1200;
const uint32_t EYE_JAW_END_GRACE_MS = 500;

// Scan up to five seconds. Startup retry interval includes time spent scanning;
// normal retry waits thirty seconds after misses/failures.
const uint32_t SCAN_SECONDS = 5;
const uint32_t SCAN_RETRY_MS = 30000;
const uint32_t STARTUP_SCAN_RETRY_MS = 5000;
const uint32_t STARTUP_SCAN_WINDOW_MS = 60000;
static_assert(SCAN_RETRY_MS >= 5000 && SCAN_RETRY_MS <= 300000 &&
              STARTUP_SCAN_RETRY_MS >= 5000 && STARTUP_SCAN_RETRY_MS <= 300000 &&
              STARTUP_SCAN_WINDOW_MS <= 300000, "Invalid scan retry timing.");

// Optional experiments. Preserve the existing scheduling policy by default.
const bool FAIR_BODY_TURNS = false;
const bool PLAYBACK_DIAGNOSTICS = false; // Observe AE02; never shorten protection.
const bool CLOCK_WINDOW_ENABLED = false;
const uint16_t CLOCK_START_MINUTE = 1080; // 18:00 local civil time, inclusive.
const uint16_t CLOCK_END_MINUTE = 1380; // 23:00, exclusive; may cross midnight.
const uint8_t CLOCK_DAYS = 127; // Sunday bit 0 ... Saturday bit 6; window-start day.
static_assert(CLOCK_START_MINUTE < 1440 && CLOCK_END_MINUTE < 1440 &&
              CLOCK_START_MINUTE != CLOCK_END_MINUTE && CLOCK_DAYS > 0 && CLOCK_DAYS < 128,
              "Invalid clock window.");

static_assert(!COMPOUND_BODY_ENABLED || JAW_FOLLOWUP_MOTOR == 0,
              "Compound and jaw-first modes must be selected separately.");
static_assert(!COMPOUND_BODY_ENABLED || !MOUTH_ENABLED || MOUTH_FILE_SERIAL == 0 ||
              JAW_PROTECTS_ARM_TORSO,
              "Compound mode with jaw playback requires MP3 body protection.");

#ifndef SKELLY_RUNTIME
#define SKELLY_RUNTIME 0
#endif
#if SKELLY_RUNTIME
#include <Preferences.h>
// BEGIN GENERATED RUNTIME SCHEMA
enum RuntimeField {
  RF_headEnabled,
  RF_armEnabled,
  RF_torsoEnabled,
  RF_jawEnabled,
  RF_eyesEnabled,
  RF_lightsEnabled,
  RF_compoundEnabled,
  RF_compoundAlongside,
  RF_jawProtectBody,
  RF_jawFollowupRecurring,
  RF_overlap,
  RF_restEnabled,
  RF_lightRotation,
  RF_diagnosticsEnabled,
  RF_fairBodyTurns,
  RF_playbackDiagnostics,
  RF_clockEnabled,
  RF_headMin,
  RF_headMax,
  RF_armMin,
  RF_armMax,
  RF_torsoMin,
  RF_torsoMax,
  RF_jawMin,
  RF_jawMax,
  RF_eyesMin,
  RF_eyesMax,
  RF_compoundMin,
  RF_compoundMax,
  RF_restMin,
  RF_restMax,
  RF_restDurationMin,
  RF_restDurationMax,
  RF_jawFile,
  RF_jawClipSec,
  RF_jawFollowupMotor,
  RF_jawFollowupDelaySec,
  RF_eyeJawMode,
  RF_lightInterval,
  RF_torsoBrightness,
  RF_headBrightness,
  RF_torsoEffect,
  RF_headEffect,
  RF_torsoSpeed,
  RF_headSpeed,
  RF_lightRestoreMode,
  RF_scanRetrySec,
  RF_startupRetrySec,
  RF_startupWindowSec,
  RF_clockStart,
  RF_clockEnd,
  RF_clockDays,
  RF_eyeMask,
  RF_comboMask,
  RF_lightMask,
  RF_fileCount,
  RF_holdSec,
  RF_torsoColor,
  RF_headColor,
  RF_palette0Torso,
  RF_palette0Head,
  RF_palette1Torso,
  RF_palette1Head,
  RF_palette2Torso,
  RF_palette2Head,
  RF_palette3Torso,
  RF_palette3Head,
  RF_file0,
  RF_duration0,
  RF_file1,
  RF_duration1,
  RF_file2,
  RF_duration2,
  RF_file3,
  RF_duration3,
  RF_file4,
  RF_duration4,
  RF_file5,
  RF_duration5,
  RF_file6,
  RF_duration6,
  RF_file7,
  RF_duration7,
  RF_sceneLabel0,
  RF_sceneLabel1,
  RF_sceneLabel2,
  RF_sceneLabel3,
  RF_sceneLabel4,
  RF_sceneLabel5,
  RF_sceneLabel6,
  RF_sceneLabel7,
  RF_sceneLabel8,
  RF_sceneLabel9,
  RF_sceneLabel10,
  RF_sceneLabel11,
  RF_sceneLabel12,
  RF_sceneLabel13,
  RF_sceneLabel14,
  RF_sceneLabel15,
  RF_sceneLabel16,
  RF_sceneLabel17,
  RF_sceneLabel18,
  RF_sceneLabel19,
  RF_sceneLabel20,
  RF_sceneLabel21,
  RF_sceneLabel22,
  RF_sceneLabel23,
  RF_sceneLabel24,
  RF_sceneLabel25,
  RF_sceneLabel26,
  RF_sceneLabel27,
  RF_sceneLabel28,
  RF_sceneLabel29,
  RF_sceneLabel30,
  RF_sceneLabel31,
  RF_paletteLabel0_0,
  RF_paletteLabel0_1,
  RF_paletteLabel0_2,
  RF_paletteLabel0_3,
  RF_paletteLabel0_4,
  RF_paletteLabel0_5,
  RF_paletteLabel0_6,
  RF_paletteLabel0_7,
  RF_paletteLabel0_8,
  RF_paletteLabel0_9,
  RF_paletteLabel0_10,
  RF_paletteLabel0_11,
  RF_paletteLabel0_12,
  RF_paletteLabel0_13,
  RF_paletteLabel0_14,
  RF_paletteLabel0_15,
  RF_paletteLabel0_16,
  RF_paletteLabel0_17,
  RF_paletteLabel0_18,
  RF_paletteLabel0_19,
  RF_paletteLabel0_20,
  RF_paletteLabel0_21,
  RF_paletteLabel0_22,
  RF_paletteLabel0_23,
  RF_paletteLabel1_0,
  RF_paletteLabel1_1,
  RF_paletteLabel1_2,
  RF_paletteLabel1_3,
  RF_paletteLabel1_4,
  RF_paletteLabel1_5,
  RF_paletteLabel1_6,
  RF_paletteLabel1_7,
  RF_paletteLabel1_8,
  RF_paletteLabel1_9,
  RF_paletteLabel1_10,
  RF_paletteLabel1_11,
  RF_paletteLabel1_12,
  RF_paletteLabel1_13,
  RF_paletteLabel1_14,
  RF_paletteLabel1_15,
  RF_paletteLabel1_16,
  RF_paletteLabel1_17,
  RF_paletteLabel1_18,
  RF_paletteLabel1_19,
  RF_paletteLabel1_20,
  RF_paletteLabel1_21,
  RF_paletteLabel1_22,
  RF_paletteLabel1_23,
  RF_paletteLabel2_0,
  RF_paletteLabel2_1,
  RF_paletteLabel2_2,
  RF_paletteLabel2_3,
  RF_paletteLabel2_4,
  RF_paletteLabel2_5,
  RF_paletteLabel2_6,
  RF_paletteLabel2_7,
  RF_paletteLabel2_8,
  RF_paletteLabel2_9,
  RF_paletteLabel2_10,
  RF_paletteLabel2_11,
  RF_paletteLabel2_12,
  RF_paletteLabel2_13,
  RF_paletteLabel2_14,
  RF_paletteLabel2_15,
  RF_paletteLabel2_16,
  RF_paletteLabel2_17,
  RF_paletteLabel2_18,
  RF_paletteLabel2_19,
  RF_paletteLabel2_20,
  RF_paletteLabel2_21,
  RF_paletteLabel2_22,
  RF_paletteLabel2_23,
  RF_paletteLabel3_0,
  RF_paletteLabel3_1,
  RF_paletteLabel3_2,
  RF_paletteLabel3_3,
  RF_paletteLabel3_4,
  RF_paletteLabel3_5,
  RF_paletteLabel3_6,
  RF_paletteLabel3_7,
  RF_paletteLabel3_8,
  RF_paletteLabel3_9,
  RF_paletteLabel3_10,
  RF_paletteLabel3_11,
  RF_paletteLabel3_12,
  RF_paletteLabel3_13,
  RF_paletteLabel3_14,
  RF_paletteLabel3_15,
  RF_paletteLabel3_16,
  RF_paletteLabel3_17,
  RF_paletteLabel3_18,
  RF_paletteLabel3_19,
  RF_paletteLabel3_20,
  RF_paletteLabel3_21,
  RF_paletteLabel3_22,
  RF_paletteLabel3_23,
  RF_name0,
  RF_name1,
  RF_name2,
  RF_name3,
  RF_name4,
  RF_name5,
  RF_name6,
  RF_name7,
  RF_name8,
  RF_name9,
  RF_name10,
  RF_name11,
  RF_COUNT
};
const uint32_t RUNTIME_LIMITS[RF_COUNT][2] = {
  {0UL,1UL}, // headEnabled
  {0UL,1UL}, // armEnabled
  {0UL,1UL}, // torsoEnabled
  {0UL,1UL}, // jawEnabled
  {0UL,1UL}, // eyesEnabled
  {0UL,1UL}, // lightsEnabled
  {0UL,1UL}, // compoundEnabled
  {0UL,1UL}, // compoundAlongside
  {0UL,1UL}, // jawProtectBody
  {0UL,1UL}, // jawFollowupRecurring
  {0UL,1UL}, // overlap
  {0UL,1UL}, // restEnabled
  {0UL,1UL}, // lightRotation
  {0UL,1UL}, // diagnosticsEnabled
  {0UL,1UL}, // fairBodyTurns
  {0UL,1UL}, // playbackDiagnostics
  {0UL,1UL}, // clockEnabled
  {32UL,3600UL}, // headMin
  {32UL,3600UL}, // headMax
  {45UL,3600UL}, // armMin
  {45UL,3600UL}, // armMax
  {45UL,3600UL}, // torsoMin
  {45UL,3600UL}, // torsoMax
  {22UL,3600UL}, // jawMin
  {22UL,3600UL}, // jawMax
  {15UL,3600UL}, // eyesMin
  {15UL,3600UL}, // eyesMax
  {45UL,3600UL}, // compoundMin
  {45UL,3600UL}, // compoundMax
  {120UL,3600UL}, // restMin
  {120UL,3600UL}, // restMax
  {15UL,300UL}, // restDurationMin
  {15UL,300UL}, // restDurationMax
  {1UL,65535UL}, // jawFile
  {21UL,120UL}, // jawClipSec
  {0UL,3UL}, // jawFollowupMotor
  {2UL,10UL}, // jawFollowupDelaySec
  {0UL,2UL}, // eyeJawMode
  {15UL,3600UL}, // lightInterval
  {0UL,255UL}, // torsoBrightness
  {0UL,255UL}, // headBrightness
  {1UL,3UL}, // torsoEffect
  {1UL,3UL}, // headEffect
  {0UL,254UL}, // torsoSpeed
  {0UL,254UL}, // headSpeed
  {0UL,2UL}, // lightRestoreMode
  {5UL,300UL}, // scanRetrySec
  {5UL,300UL}, // startupRetrySec
  {0UL,300UL}, // startupWindowSec
  {0UL,1439UL}, // clockStart
  {0UL,1439UL}, // clockEnd
  {1UL,127UL}, // clockDays
  {1UL,262143UL}, // eyeMask
  {0UL,15UL}, // comboMask
  {1UL,15UL}, // lightMask
  {1UL,8UL}, // fileCount
  {60UL,3600UL}, // holdSec
  {0UL,16777215UL}, // torsoColor
  {0UL,16777215UL}, // headColor
  {0UL,16777215UL}, // palette0Torso
  {0UL,16777215UL}, // palette0Head
  {0UL,16777215UL}, // palette1Torso
  {0UL,16777215UL}, // palette1Head
  {0UL,16777215UL}, // palette2Torso
  {0UL,16777215UL}, // palette2Head
  {0UL,16777215UL}, // palette3Torso
  {0UL,16777215UL}, // palette3Head
  {0UL,65535UL}, // file0
  {0UL,120UL}, // duration0
  {0UL,65535UL}, // file1
  {0UL,120UL}, // duration1
  {0UL,65535UL}, // file2
  {0UL,120UL}, // duration2
  {0UL,65535UL}, // file3
  {0UL,120UL}, // duration3
  {0UL,65535UL}, // file4
  {0UL,120UL}, // duration4
  {0UL,65535UL}, // file5
  {0UL,120UL}, // duration5
  {0UL,65535UL}, // file6
  {0UL,120UL}, // duration6
  {0UL,65535UL}, // file7
  {0UL,120UL}, // duration7
  {0UL,4294967295UL}, // sceneLabel0
  {0UL,4294967295UL}, // sceneLabel1
  {0UL,4294967295UL}, // sceneLabel2
  {0UL,4294967295UL}, // sceneLabel3
  {0UL,4294967295UL}, // sceneLabel4
  {0UL,4294967295UL}, // sceneLabel5
  {0UL,4294967295UL}, // sceneLabel6
  {0UL,4294967295UL}, // sceneLabel7
  {0UL,4294967295UL}, // sceneLabel8
  {0UL,4294967295UL}, // sceneLabel9
  {0UL,4294967295UL}, // sceneLabel10
  {0UL,4294967295UL}, // sceneLabel11
  {0UL,4294967295UL}, // sceneLabel12
  {0UL,4294967295UL}, // sceneLabel13
  {0UL,4294967295UL}, // sceneLabel14
  {0UL,4294967295UL}, // sceneLabel15
  {0UL,4294967295UL}, // sceneLabel16
  {0UL,4294967295UL}, // sceneLabel17
  {0UL,4294967295UL}, // sceneLabel18
  {0UL,4294967295UL}, // sceneLabel19
  {0UL,4294967295UL}, // sceneLabel20
  {0UL,4294967295UL}, // sceneLabel21
  {0UL,4294967295UL}, // sceneLabel22
  {0UL,4294967295UL}, // sceneLabel23
  {0UL,4294967295UL}, // sceneLabel24
  {0UL,4294967295UL}, // sceneLabel25
  {0UL,4294967295UL}, // sceneLabel26
  {0UL,4294967295UL}, // sceneLabel27
  {0UL,4294967295UL}, // sceneLabel28
  {0UL,4294967295UL}, // sceneLabel29
  {0UL,4294967295UL}, // sceneLabel30
  {0UL,4294967295UL}, // sceneLabel31
  {0UL,4294967295UL}, // paletteLabel0_0
  {0UL,4294967295UL}, // paletteLabel0_1
  {0UL,4294967295UL}, // paletteLabel0_2
  {0UL,4294967295UL}, // paletteLabel0_3
  {0UL,4294967295UL}, // paletteLabel0_4
  {0UL,4294967295UL}, // paletteLabel0_5
  {0UL,4294967295UL}, // paletteLabel0_6
  {0UL,4294967295UL}, // paletteLabel0_7
  {0UL,4294967295UL}, // paletteLabel0_8
  {0UL,4294967295UL}, // paletteLabel0_9
  {0UL,4294967295UL}, // paletteLabel0_10
  {0UL,4294967295UL}, // paletteLabel0_11
  {0UL,4294967295UL}, // paletteLabel0_12
  {0UL,4294967295UL}, // paletteLabel0_13
  {0UL,4294967295UL}, // paletteLabel0_14
  {0UL,4294967295UL}, // paletteLabel0_15
  {0UL,4294967295UL}, // paletteLabel0_16
  {0UL,4294967295UL}, // paletteLabel0_17
  {0UL,4294967295UL}, // paletteLabel0_18
  {0UL,4294967295UL}, // paletteLabel0_19
  {0UL,4294967295UL}, // paletteLabel0_20
  {0UL,4294967295UL}, // paletteLabel0_21
  {0UL,4294967295UL}, // paletteLabel0_22
  {0UL,4294967295UL}, // paletteLabel0_23
  {0UL,4294967295UL}, // paletteLabel1_0
  {0UL,4294967295UL}, // paletteLabel1_1
  {0UL,4294967295UL}, // paletteLabel1_2
  {0UL,4294967295UL}, // paletteLabel1_3
  {0UL,4294967295UL}, // paletteLabel1_4
  {0UL,4294967295UL}, // paletteLabel1_5
  {0UL,4294967295UL}, // paletteLabel1_6
  {0UL,4294967295UL}, // paletteLabel1_7
  {0UL,4294967295UL}, // paletteLabel1_8
  {0UL,4294967295UL}, // paletteLabel1_9
  {0UL,4294967295UL}, // paletteLabel1_10
  {0UL,4294967295UL}, // paletteLabel1_11
  {0UL,4294967295UL}, // paletteLabel1_12
  {0UL,4294967295UL}, // paletteLabel1_13
  {0UL,4294967295UL}, // paletteLabel1_14
  {0UL,4294967295UL}, // paletteLabel1_15
  {0UL,4294967295UL}, // paletteLabel1_16
  {0UL,4294967295UL}, // paletteLabel1_17
  {0UL,4294967295UL}, // paletteLabel1_18
  {0UL,4294967295UL}, // paletteLabel1_19
  {0UL,4294967295UL}, // paletteLabel1_20
  {0UL,4294967295UL}, // paletteLabel1_21
  {0UL,4294967295UL}, // paletteLabel1_22
  {0UL,4294967295UL}, // paletteLabel1_23
  {0UL,4294967295UL}, // paletteLabel2_0
  {0UL,4294967295UL}, // paletteLabel2_1
  {0UL,4294967295UL}, // paletteLabel2_2
  {0UL,4294967295UL}, // paletteLabel2_3
  {0UL,4294967295UL}, // paletteLabel2_4
  {0UL,4294967295UL}, // paletteLabel2_5
  {0UL,4294967295UL}, // paletteLabel2_6
  {0UL,4294967295UL}, // paletteLabel2_7
  {0UL,4294967295UL}, // paletteLabel2_8
  {0UL,4294967295UL}, // paletteLabel2_9
  {0UL,4294967295UL}, // paletteLabel2_10
  {0UL,4294967295UL}, // paletteLabel2_11
  {0UL,4294967295UL}, // paletteLabel2_12
  {0UL,4294967295UL}, // paletteLabel2_13
  {0UL,4294967295UL}, // paletteLabel2_14
  {0UL,4294967295UL}, // paletteLabel2_15
  {0UL,4294967295UL}, // paletteLabel2_16
  {0UL,4294967295UL}, // paletteLabel2_17
  {0UL,4294967295UL}, // paletteLabel2_18
  {0UL,4294967295UL}, // paletteLabel2_19
  {0UL,4294967295UL}, // paletteLabel2_20
  {0UL,4294967295UL}, // paletteLabel2_21
  {0UL,4294967295UL}, // paletteLabel2_22
  {0UL,4294967295UL}, // paletteLabel2_23
  {0UL,4294967295UL}, // paletteLabel3_0
  {0UL,4294967295UL}, // paletteLabel3_1
  {0UL,4294967295UL}, // paletteLabel3_2
  {0UL,4294967295UL}, // paletteLabel3_3
  {0UL,4294967295UL}, // paletteLabel3_4
  {0UL,4294967295UL}, // paletteLabel3_5
  {0UL,4294967295UL}, // paletteLabel3_6
  {0UL,4294967295UL}, // paletteLabel3_7
  {0UL,4294967295UL}, // paletteLabel3_8
  {0UL,4294967295UL}, // paletteLabel3_9
  {0UL,4294967295UL}, // paletteLabel3_10
  {0UL,4294967295UL}, // paletteLabel3_11
  {0UL,4294967295UL}, // paletteLabel3_12
  {0UL,4294967295UL}, // paletteLabel3_13
  {0UL,4294967295UL}, // paletteLabel3_14
  {0UL,4294967295UL}, // paletteLabel3_15
  {0UL,4294967295UL}, // paletteLabel3_16
  {0UL,4294967295UL}, // paletteLabel3_17
  {0UL,4294967295UL}, // paletteLabel3_18
  {0UL,4294967295UL}, // paletteLabel3_19
  {0UL,4294967295UL}, // paletteLabel3_20
  {0UL,4294967295UL}, // paletteLabel3_21
  {0UL,4294967295UL}, // paletteLabel3_22
  {0UL,4294967295UL}, // paletteLabel3_23
  {0UL,4294967295UL}, // name0
  {0UL,4294967295UL}, // name1
  {0UL,4294967295UL}, // name2
  {0UL,4294967295UL}, // name3
  {0UL,4294967295UL}, // name4
  {0UL,4294967295UL}, // name5
  {0UL,4294967295UL}, // name6
  {0UL,4294967295UL}, // name7
  {0UL,4294967295UL}, // name8
  {0UL,4294967295UL}, // name9
  {0UL,4294967295UL}, // name10
  {0UL,4294967295UL}, // name11
};
const uint32_t RUNTIME_SEED[] = {1UL,1UL,0UL,1UL,0UL,0UL,0UL,0UL,0UL,0UL,1UL,1UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,60UL,120UL,150UL,240UL,240UL,420UL,100UL,180UL,120UL,300UL,240UL,600UL,180UL,420UL,25UL,60UL,12UL,21UL,0UL,2UL,1UL,90UL,255UL,255UL,1UL,1UL,125UL,125UL,1UL,30UL,5UL,60UL,1080UL,1380UL,127UL,1UL,15UL,15UL,1UL,600UL,16711680UL,16736256UL,16736256UL,65280UL,8388863UL,59084UL,1534975UL,13166847UL,16717824UL,16756736UL,12UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,1852138323UL,3219557UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,1819042120UL,1701148527UL,110UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,1853186376UL,6579572UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,1852796749UL,1751607660UL,116UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,1700949317UL,114UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,1920232533UL,1800609889UL,2037148773UL,3307040UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL,0UL};
uint32_t runtimeValues[RF_COUNT] = {};
uint8_t runtimeEyes[18], runtimeEyeCount=0, runtimeMasks[4], runtimeMaskCount=0;
uint16_t runtimeFiles[8];
uint8_t runtimeFileCount=0;
uint8_t runtimePalettes[4][6];
char runtimeName[49];
#undef HEAD_ENABLED
#define HEAD_ENABLED (runtimeValues[RF_headEnabled])
#undef ARM_ENABLED
#define ARM_ENABLED (runtimeValues[RF_armEnabled])
#undef TORSO_ENABLED
#define TORSO_ENABLED (runtimeValues[RF_torsoEnabled])
#undef MOUTH_ENABLED
#define MOUTH_ENABLED (runtimeValues[RF_jawEnabled])
#undef EYES_ENABLED
#define EYES_ENABLED (runtimeValues[RF_eyesEnabled])
#undef LIGHTS_ENABLED
#define LIGHTS_ENABLED (runtimeValues[RF_lightsEnabled])
#undef COMPOUND_BODY_ENABLED
#define COMPOUND_BODY_ENABLED (runtimeValues[RF_compoundEnabled])
#undef COMPOUND_ALONGSIDE
#define COMPOUND_ALONGSIDE (runtimeValues[RF_compoundAlongside])
#undef JAW_PROTECTS_ARM_TORSO
#define JAW_PROTECTS_ARM_TORSO (runtimeValues[RF_jawProtectBody])
#undef JAW_FOLLOWUP_RECURRING
#define JAW_FOLLOWUP_RECURRING (runtimeValues[RF_jawFollowupRecurring])
#undef ALLOW_HEAD_JAW_OVERLAP
#define ALLOW_HEAD_JAW_OVERLAP (runtimeValues[RF_overlap])
#undef REST_ENABLED
#define REST_ENABLED (runtimeValues[RF_restEnabled])
#undef LIGHT_ROTATION_ENABLED
#define LIGHT_ROTATION_ENABLED (runtimeValues[RF_lightRotation])
#undef DIAGNOSTICS_ENABLED
#define DIAGNOSTICS_ENABLED (runtimeValues[RF_diagnosticsEnabled])
#undef FAIR_BODY_TURNS
#define FAIR_BODY_TURNS (runtimeValues[RF_fairBodyTurns])
#undef PLAYBACK_DIAGNOSTICS
#define PLAYBACK_DIAGNOSTICS (runtimeValues[RF_playbackDiagnostics])
#undef CLOCK_WINDOW_ENABLED
#define CLOCK_WINDOW_ENABLED (runtimeValues[RF_clockEnabled])
#undef HEAD_MIN_INTERVAL_MS
#define HEAD_MIN_INTERVAL_MS (runtimeValues[RF_headMin] * 1000UL)
#undef HEAD_MAX_INTERVAL_MS
#define HEAD_MAX_INTERVAL_MS (runtimeValues[RF_headMax] * 1000UL)
#undef ARM_MIN_INTERVAL_MS
#define ARM_MIN_INTERVAL_MS (runtimeValues[RF_armMin] * 1000UL)
#undef ARM_MAX_INTERVAL_MS
#define ARM_MAX_INTERVAL_MS (runtimeValues[RF_armMax] * 1000UL)
#undef TORSO_MIN_INTERVAL_MS
#define TORSO_MIN_INTERVAL_MS (runtimeValues[RF_torsoMin] * 1000UL)
#undef TORSO_MAX_INTERVAL_MS
#define TORSO_MAX_INTERVAL_MS (runtimeValues[RF_torsoMax] * 1000UL)
#undef MOUTH_MIN_INTERVAL_MS
#define MOUTH_MIN_INTERVAL_MS (runtimeValues[RF_jawMin] * 1000UL)
#undef MOUTH_MAX_INTERVAL_MS
#define MOUTH_MAX_INTERVAL_MS (runtimeValues[RF_jawMax] * 1000UL)
#undef EYE_MIN_INTERVAL_MS
#define EYE_MIN_INTERVAL_MS (runtimeValues[RF_eyesMin] * 1000UL)
#undef EYE_MAX_INTERVAL_MS
#define EYE_MAX_INTERVAL_MS (runtimeValues[RF_eyesMax] * 1000UL)
#undef COMPOUND_BODY_MIN_INTERVAL_MS
#define COMPOUND_BODY_MIN_INTERVAL_MS (runtimeValues[RF_compoundMin] * 1000UL)
#undef COMPOUND_BODY_MAX_INTERVAL_MS
#define COMPOUND_BODY_MAX_INTERVAL_MS (runtimeValues[RF_compoundMax] * 1000UL)
#undef REST_MIN_INTERVAL_MS
#define REST_MIN_INTERVAL_MS (runtimeValues[RF_restMin] * 1000UL)
#undef REST_MAX_INTERVAL_MS
#define REST_MAX_INTERVAL_MS (runtimeValues[RF_restMax] * 1000UL)
#undef REST_MIN_DURATION_MS
#define REST_MIN_DURATION_MS (runtimeValues[RF_restDurationMin] * 1000UL)
#undef REST_MAX_DURATION_MS
#define REST_MAX_DURATION_MS (runtimeValues[RF_restDurationMax] * 1000UL)
#undef MOUTH_FILE_SERIAL
#define MOUTH_FILE_SERIAL (runtimeValues[RF_jawFile])
#undef MOUTH_CLIP_MS
#define MOUTH_CLIP_MS (runtimeValues[RF_jawClipSec] * 1000UL)
#undef JAW_FOLLOWUP_MOTOR
#define JAW_FOLLOWUP_MOTOR (runtimeValues[RF_jawFollowupMotor])
#undef JAW_FOLLOWUP_DELAY_MS
#define JAW_FOLLOWUP_DELAY_MS (runtimeValues[RF_jawFollowupDelaySec] * 1000UL)
#undef EYE_JAW_MODE
#define EYE_JAW_MODE (runtimeValues[RF_eyeJawMode])
#undef LIGHT_ROTATION_INTERVAL_MS
#define LIGHT_ROTATION_INTERVAL_MS (runtimeValues[RF_lightInterval] * 1000UL)
#undef TORSO_LIGHT_BRIGHTNESS
#define TORSO_LIGHT_BRIGHTNESS (runtimeValues[RF_torsoBrightness])
#undef HEAD_LIGHT_BRIGHTNESS
#define HEAD_LIGHT_BRIGHTNESS (runtimeValues[RF_headBrightness])
#undef TORSO_LIGHT_MODE
#define TORSO_LIGHT_MODE (runtimeValues[RF_torsoEffect])
#undef HEAD_LIGHT_MODE
#define HEAD_LIGHT_MODE (runtimeValues[RF_headEffect])
#undef TORSO_LIGHT_SPEED
#define TORSO_LIGHT_SPEED (254UL-runtimeValues[RF_torsoSpeed])
#undef HEAD_LIGHT_SPEED
#define HEAD_LIGHT_SPEED (254UL-runtimeValues[RF_headSpeed])
#undef LIGHT_RESTORE_MODE
#define LIGHT_RESTORE_MODE (runtimeValues[RF_lightRestoreMode])
#undef SCAN_RETRY_MS
#define SCAN_RETRY_MS (runtimeValues[RF_scanRetrySec] * 1000UL)
#undef STARTUP_SCAN_RETRY_MS
#define STARTUP_SCAN_RETRY_MS (runtimeValues[RF_startupRetrySec] * 1000UL)
#undef STARTUP_SCAN_WINDOW_MS
#define STARTUP_SCAN_WINDOW_MS (runtimeValues[RF_startupWindowSec] * 1000UL)
#undef CLOCK_START_MINUTE
#define CLOCK_START_MINUTE (runtimeValues[RF_clockStart])
#undef CLOCK_END_MINUTE
#define CLOCK_END_MINUTE (runtimeValues[RF_clockEnd])
#undef CLOCK_DAYS
#define CLOCK_DAYS (runtimeValues[RF_clockDays])
#undef LIGHT_PALETTE_MASK
#define LIGHT_PALETTE_MASK (runtimeValues[RF_lightMask])
#define TORSO_LIGHT_R ((runtimeValues[RF_torsoColor] >> 16) & 255UL)
#define TORSO_LIGHT_G ((runtimeValues[RF_torsoColor] >> 8) & 255UL)
#define TORSO_LIGHT_B ((runtimeValues[RF_torsoColor] >> 0) & 255UL)
#define HEAD_LIGHT_R ((runtimeValues[RF_headColor] >> 16) & 255UL)
#define HEAD_LIGHT_G ((runtimeValues[RF_headColor] >> 8) & 255UL)
#define HEAD_LIGHT_B ((runtimeValues[RF_headColor] >> 0) & 255UL)
#undef SKELLY_NAME
#define SKELLY_NAME runtimeName
#undef COMPOUND_BODY_MASKS
#define COMPOUND_BODY_MASKS runtimeMasks
#undef LIGHT_PALETTES
#define LIGHT_PALETTES runtimePalettes
#undef EYE_OPTIONS
#define EYE_OPTIONS runtimeEyes
#undef EYE_OPTIONS_COUNT
#define EYE_OPTIONS_COUNT runtimeEyeCount
#undef EYE_ROTATION_ENABLED
#define EYE_ROTATION_ENABLED (runtimeEyeCount > 1)
#undef JAW_FILE_POOL
#define JAW_FILE_POOL runtimeFiles
#undef JAW_POOL_COUNT
#define JAW_POOL_COUNT runtimeFileCount
// END GENERATED RUNTIME SCHEMA
void runtimeBoot();
bool runtimeCommand(const char *line);
void serviceRuntime();
void runtimeSceneConnected();
bool runtimePending();
bool runtimeBusy();
uint32_t runtimeSceneIndex();
uint32_t runtimeSequence();
uint32_t runtimeProgramCRC();
uint32_t runtimeJawDuration(uint16_t file);
#else
void runtimeBoot() {}
bool runtimeCommand(const char *) { return false; }
void serviceRuntime() {}
void runtimeSceneConnected() {}
bool runtimePending() { return false; }
bool runtimeBusy() { return false; }
uint32_t runtimeSceneIndex() { return 0; }
uint32_t runtimeSequence() { return 0; }
uint32_t runtimeProgramCRC() { return 0; }
#endif
bool routineWindowOpen();

BLEScan *scanner = nullptr;
BLEClient *client = nullptr;
BLERemoteCharacteristic *writeChar = nullptr;
BLEAdvertisedDevice *skellyDevice = nullptr;

bool found = false;
bool connected = false;
uint32_t nextScanAt = 0;
uint32_t startupScanStartedAt = 0;
bool startupScanActive = true;
uint32_t nextHeadAt = 0;
uint32_t headSafeAfter = 0;
uint32_t headMovingUntil = 0;
uint32_t bodySafeAfter = 0; // Global lock used when overlap is disabled.
uint32_t nextBodyWriteAt = 0; // Spacing between motor BLE writes, even with overlap.
uint32_t nextCompoundAt = 0;
uint32_t compoundSafeAfter = 0;
uint32_t nextLightWriteAt = 0;
uint32_t lightRestoreAt = 0;
bool lightRestorePending = false;
bool lightApplyPending = false;
uint8_t lightApplyStep = 0;
int8_t activeLightPalette = -1;
uint32_t nextLightRotationAt = 0;
uint32_t torsoSafeAfter = 0;
uint32_t armSafeAfter = 0;
uint32_t nextTorsoAt = 0;
uint32_t nextArmAt = 0;
uint32_t nextMouthAt = 0;
uint32_t mouthSafeAfter = 0;
uint32_t mouthPlayingUntil = 0;
uint32_t nextEyeAt = 0;
uint8_t lastEye = 0; // Last successfully requested eye icon.
bool jawDelayNotified = false;
bool jawFollowupPending = false;
bool jawFollowupTestDone = false; // One successful test per BLE connection.
uint8_t jawFollowupChosenMotor = 0; // Choice for this MP3: 0/off, 1/arm, 2/torso, 4/head.
uint8_t lastJawFollowupMotor = 0; // Last successfully sent follow-up motor.
uint32_t jawFollowupAt = 0;
bool jawEyeStartPending = false;
bool jawEyeEndPending = false;
uint32_t jawEyeStartAt = 0;
uint32_t jawEyeEndAt = 0;
bool mouthEndPending = false; // Modeled duration only, NOT a playback notification.
bool haveBleWrite = false;
bool lastTurnWasJaw = false;
bool clockValid = false;
uint64_t clockCivilMillis = 0;
uint32_t clockLastTick = 0;
bool clockWindowWasOpen = false;
char usbLine[SKELLY_RUNTIME ? 192 : 64];
uint8_t usbUsed = 0;
bool usbOverflow = false;
uint32_t lastBleWriteAt = 0;
uint32_t scanAttempts = 0;
uint32_t connectionAttempts = 0;
uint32_t writeAttempts = 0;
uint32_t writeFailures = 0;
uint8_t lastAttemptTag = 0;
uint8_t lastAcceptedTag = 0;
uint32_t lastAcceptedAt = 0;
// NOINIT preserves diagnostics across software resets. Validate retained words;
// power loss, EN reset or brownout can still discard RTC memory.
RTC_NOINIT_ATTR uint32_t bootCount;
RTC_NOINIT_ATTR uint32_t bootCountGuard;

void recordBoot(esp_reset_reason_t reason) {
  const uint32_t magic = 0x534B454C;
  if (reason == ESP_RST_POWERON || (bootCount ^ bootCountGuard) != magic) bootCount = 0;
  ++bootCount;
  bootCountGuard = bootCount ^ magic;
}

// Format into a bounded buffer and write text once per event. No BLE payload is
// ever sent to UART. millis() is uptime and wraps after about 49.7 days.
void logEvent(const char *format, ...) {
  char line[640];
  const int prefix = snprintf(line, sizeof(line), "[%10lu ms] ", (unsigned long)millis());
  if (prefix < 0 || (size_t)prefix >= sizeof(line)) return;
  va_list args;
  va_start(args, format);
  vsnprintf(line + prefix, sizeof(line) - prefix, format, args);
  va_end(args);
  Serial.print(line);
}
void logLine(const char *message) { logEvent("%s\n", message); }

bool reached(uint32_t now, uint32_t when);
// Generator supplies the existing idle-break state; never changes scheduling.
bool diagnosticResting(uint32_t now) { (void)now; return false; }
// Numeric additions keep older Studio status parsers compatible.
// 0 intervals, 1 disconnected, 2 playback estimate, 3 restoration/correction,
// 4 motor cooldown, 5 idle break, 6 existing window, 7 jaw follow-up.
uint8_t diagnosticWait(uint32_t now) {
  if (!connected) return 1;
  if (!reached(now, mouthPlayingUntil)) return 2;
  if (lightApplyPending || lightRestorePending || mouthEndPending || jawEyeStartPending || jawEyeEndPending) return 3;
  if (jawFollowupPending) return 7;
  if (!reached(now, bodySafeAfter) || !reached(now, headSafeAfter) ||
      !reached(now, armSafeAfter) || !reached(now, torsoSafeAfter)) return 4;
  if (!routineWindowOpen()) return 6;
  if (diagnosticResting(now)) return 5;
  return 0;
}

void emitUsbStatus() {
  const uint32_t now = millis();
  logEvent("USB STATUS v2 runtime=%u connected=%u scene=%lu sequence=%lu crc=%lu pending=%u scans=%lu connects=%lu writes=%lu failures=%lu heap=%lu minHeap=%lu clock=%u window=%u firmware=%lu build=%lu wait=%u jawMs=%lu accepted=%u acceptedAge=%lu\n",
    unsigned(SKELLY_RUNTIME),unsigned(connected),(unsigned long)runtimeSceneIndex(),(unsigned long)runtimeSequence(),(unsigned long)runtimeProgramCRC(),unsigned(runtimePending()),
    (unsigned long)scanAttempts,(unsigned long)connectionAttempts,(unsigned long)writeAttempts,(unsigned long)writeFailures,
    (unsigned long)ESP.getFreeHeap(),(unsigned long)ESP.getMinFreeHeap(),unsigned(clockValid),unsigned(routineWindowOpen()),
    (unsigned long)FIRMWARE_REVISION,(unsigned long)FIRMWARE_BUILD,unsigned(diagnosticWait(now)),
    (unsigned long)(reached(now,mouthPlayingUntil)?0:uint32_t(mouthPlayingUntil-now)),
    unsigned(lastAcceptedTag!=0),(unsigned long)(lastAcceptedTag?uint32_t(now-lastAcceptedAt):0));
}

#if SKELLY_WIRELESS_STATUS
// Read-only, public model status. No configuration, actuator writes or notifications.
// Snapshot is copied under a lock; BLE callbacks never inspect live scheduler state.
portMUX_TYPE wirelessStatusMux = portMUX_INITIALIZER_UNLOCKED;
char wirelessStatusSnapshot[320] = "Experimental status starting";
BLEServer *wirelessStatusServer = nullptr;
uint32_t wirelessStatusAt = 0;
bool wirelessAdvertisingPending = false;
class WirelessStatusConnections : public BLEServerCallbacks {
  void onDisconnect(BLEServer *) override {
    portENTER_CRITICAL(&wirelessStatusMux);
    wirelessAdvertisingPending=true;
    portEXIT_CRITICAL(&wirelessStatusMux);
  }
};
class WirelessStatusRead : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic *characteristic) override {
    char snapshot[sizeof(wirelessStatusSnapshot)];
    portENTER_CRITICAL(&wirelessStatusMux);
    memcpy(snapshot,wirelessStatusSnapshot,sizeof(snapshot));
    portEXIT_CRITICAL(&wirelessStatusMux);
    characteristic->setValue(snapshot);
  }
};
void serviceWirelessStatus() {
  const uint32_t now=millis();
  bool restart=false;
  portENTER_CRITICAL(&wirelessStatusMux);
  restart=wirelessAdvertisingPending;
  wirelessAdvertisingPending=false;
  portEXIT_CRITICAL(&wirelessStatusMux);
  if (restart && wirelessStatusServer && wirelessStatusServer->getConnectedCount()==0) {
    BLEDevice::startAdvertising();
  }
  if (!reached(now,wirelessStatusAt)) return;
  char snapshot[sizeof(wirelessStatusSnapshot)];
  snprintf(snapshot,sizeof(snapshot),"Experimental status v1 firmware=%lu build=%lu uptime=%lu connected=%u scene=%lu sequence=%lu crc=%lu pending=%u wait=%u heap=%lu minHeap=%lu failures=%lu",
    (unsigned long)FIRMWARE_REVISION,(unsigned long)FIRMWARE_BUILD,(unsigned long)now,unsigned(connected),
    (unsigned long)runtimeSceneIndex(),(unsigned long)runtimeSequence(),(unsigned long)runtimeProgramCRC(),
    unsigned(runtimePending()),unsigned(diagnosticWait(now)),(unsigned long)ESP.getFreeHeap(),
    (unsigned long)ESP.getMinFreeHeap(),(unsigned long)writeFailures);
  portENTER_CRITICAL(&wirelessStatusMux);
  memcpy(wirelessStatusSnapshot,snapshot,sizeof(snapshot));
  portEXIT_CRITICAL(&wirelessStatusMux);
  wirelessStatusAt=now+5000;
}
void setupWirelessStatus() {
  wirelessStatusServer=BLEDevice::createServer();
  wirelessStatusServer->setCallbacks(new WirelessStatusConnections());
  BLEService *service=wirelessStatusServer->createService("765a1000-c347-4e63-8b97-40d64ef88261");
  BLECharacteristic *status=service->createCharacteristic("765a1001-c347-4e63-8b97-40d64ef88261",BLECharacteristic::PROPERTY_READ);
  status->setAccessPermissions(ESP_GATT_PERM_READ); // Bluedroid otherwise defaults to read/write permissions.
  status->setCallbacks(new WirelessStatusRead());
  service->start();
  BLEDevice::getAdvertising()->addServiceUUID(service->getUUID());
  BLEDevice::getAdvertising()->setScanResponse(true);
  wirelessStatusAt=millis(); // First snapshot also works near millis wrap.
  serviceWirelessStatus();
  BLEDevice::startAdvertising();
  logLine("EXPERIMENT: public read-only phone status enabled; physical reliability UNTESTED.");
}
#else
void serviceWirelessStatus() {}
#endif

void acceptUsbCommand(const char *line) {
  if (runtimeCommand(line)) return;
  if (strcmp(line,"SKELLY STATUS")==0) { emitUsbStatus(); return; }
  if (strcmp(line, "SKELLY HELLO") == 0) {
    logLine("USB READY v1 CLOCK");
    logEvent("USB CAPS v2 settings=%u scenes=%u randomScenes=%u\n",unsigned(SKELLY_RUNTIME),SKELLY_RUNTIME?4u:0u,unsigned(SKELLY_RUNTIME));
    return;
  }
  const char *prefix = "SKELLY TIME ";
  if (strncmp(line, prefix, strlen(prefix)) != 0) return;
  const char *value = line + strlen(prefix);
  if (strlen(value) != 10) { logLine("USB TIME rejected"); return; }
  for (const char *p = value; *p; ++p) if (*p < '0' || *p > '9') {
    logLine("USB TIME rejected"); return;
  }
  const uint64_t seconds = strtoull(value, nullptr, 10);
  if (seconds < 1704067200ULL || seconds >= 4102444800ULL) {
    logLine("USB TIME rejected"); return;
  }
  clockCivilMillis = seconds * 1000ULL;
  clockLastTick = millis();
  clockValid = true;
  logLine("USB TIME accepted; local civil time, no automatic DST adjustment");
}

void serviceUsbClock() {
  const uint32_t tick = millis();
  if (clockValid) clockCivilMillis += uint32_t(tick - clockLastTick);
  clockLastTick = tick;
  // Bound per-loop work even for a flooding or malformed serial sender.
  for (uint16_t count = 0; count < (SKELLY_RUNTIME ? 192 : 64) && Serial.available(); ++count) {
    const int c = Serial.read();
    if (c == '\n') {
      if (!usbOverflow) { usbLine[usbUsed] = 0; acceptUsbCommand(usbLine); }
      usbUsed = 0; usbOverflow = false;
    } else if (c != '\r') {
      if (c < 32 || c > 126 || usbUsed >= sizeof(usbLine)-1) usbOverflow = true;
      else if (!usbOverflow) usbLine[usbUsed++] = char(c);
    }
  }
}

bool routineWindowOpen() {
  if (!CLOCK_WINDOW_ENABLED) return true;
  const uint32_t tick = millis();
  if (clockValid) clockCivilMillis += uint32_t(tick - clockLastTick);
  clockLastTick = tick;
  if (!clockValid) return false;
  const uint64_t seconds = clockCivilMillis / 1000ULL;
  const uint16_t minute = (seconds / 60ULL) % 1440;
  uint8_t day = (seconds / 86400ULL + 4) % 7;
  if (CLOCK_START_MINUTE < CLOCK_END_MINUTE)
    return minute >= CLOCK_START_MINUTE && minute < CLOCK_END_MINUTE && (CLOCK_DAYS & (1 << day));
  if (minute < CLOCK_END_MINUTE) day = (day + 6) % 7;
  return (minute >= CLOCK_START_MINUTE || minute < CLOCK_END_MINUTE) && (CLOCK_DAYS & (1 << day));
}

#if SKELLY_RUNTIME
uint32_t jawDurationMs(uint16_t file) { return runtimeJawDuration(file); }
#else
uint32_t jawDurationMs(uint16_t file) { (void)file; return MOUTH_CLIP_MS; }
#endif

struct PlaybackObservation { uint16_t file; uint16_t duration; uint8_t playing; uint8_t length; };
PlaybackObservation playbackQueue[8];
uint8_t playbackRead = 0, playbackWrite = 0;
uint32_t playbackDropped = 0;
portMUX_TYPE playbackMux = portMUX_INITIALIZER_UNLOCKED;
BLERemoteCharacteristic *notifySource = nullptr;

// Observe bounded metadata only. Frame length/CRC/duration units and natural-EOF
// behavior are unverified; no observation changes any safety or playback timer.
void playbackNotification(BLERemoteCharacteristic *source, uint8_t *data, size_t length, bool) {
  if (!PLAYBACK_DIAGNOSTICS || length < 7 || length > 32 || data == nullptr ||
      data[0] != 0xBB || data[1] != 0xC6 || data[4] > 1) return;
  portENTER_CRITICAL(&playbackMux);
  if (source == notifySource && source != nullptr) {
    const uint8_t next = (playbackWrite + 1) % 8;
    if (next == playbackRead) ++playbackDropped;
    else {
      playbackQueue[playbackWrite] = {uint16_t((data[2] << 8) | data[3]),
        uint16_t((data[5] << 8) | data[6]), data[4], uint8_t(length)};
      playbackWrite = next;
    }
  }
  portEXIT_CRITICAL(&playbackMux);
}

void drainPlaybackObservation() {
  PlaybackObservation observation{};
  bool have = false;
  portENTER_CRITICAL(&playbackMux);
  if (playbackRead != playbackWrite) {
    observation = playbackQueue[playbackRead]; playbackRead = (playbackRead + 1) % 8; have = true;
  }
  portEXIT_CRITICAL(&playbackMux);
  if (have) logEvent("AE02 unvalidated BBC6: file=%u playing=%u durationRaw=%u length=%u; timers unchanged\n",
    unsigned(observation.file), unsigned(observation.playing), unsigned(observation.duration), unsigned(observation.length));
}

void postponeRoutineTargets(uint32_t at) {
  nextLightRotationAt = at + LIGHT_ROTATION_INTERVAL_MS;
  nextHeadAt = at + random(HEAD_MIN_INTERVAL_MS, HEAD_MAX_INTERVAL_MS + 1);
  nextArmAt = at + random(ARM_MIN_INTERVAL_MS, ARM_MAX_INTERVAL_MS + 1);
  nextTorsoAt = at + random(TORSO_MIN_INTERVAL_MS, TORSO_MAX_INTERVAL_MS + 1);
  nextMouthAt = at + random(MOUTH_MIN_INTERVAL_MS, MOUTH_MAX_INTERVAL_MS + 1);
  nextCompoundAt = at + random(COMPOUND_BODY_MIN_INTERVAL_MS, COMPOUND_BODY_MAX_INTERVAL_MS + 1);
  nextEyeAt = at + random(EYE_MIN_INTERVAL_MS, EYE_MAX_INTERVAL_MS + 1);
}

void logDiagnostics(const char *event) {
  if (!DIAGNOSTICS_ENABLED) return;
  logEvent("DIAG %s: connected=%u scans=%lu connects=%lu heap=%lu minHeap=%lu "
           "writes=%lu failures=%lu lastTry=AA%02X lastAccepted=AA%02X@%lu "
           "lights=%u step=%u restore=%u\n",
           event, (unsigned)connected, (unsigned long)scanAttempts,
           (unsigned long)connectionAttempts, (unsigned long)ESP.getFreeHeap(),
           (unsigned long)ESP.getMinFreeHeap(), (unsigned long)writeAttempts,
           (unsigned long)writeFailures, (unsigned)lastAttemptTag,
           (unsigned)lastAcceptedTag, (unsigned long)lastAcceptedAt,
           (unsigned)lightApplyPending, (unsigned)lightApplyStep,
           (unsigned)lightRestorePending);
}

bool reached(uint32_t now, uint32_t when) {
  return (int32_t)(now - when) >= 0;
}

bool giveWaitingBodyTurn(uint32_t now) {
  if (!FAIR_BODY_TURNS || !JAW_PROTECTS_ARM_TORSO || !lastTurnWasJaw ||
      !reached(now, mouthPlayingUntil) || !reached(now, nextBodyWriteAt) ||
      (!ALLOW_BODY_MOTOR_OVERLAP && !reached(now, bodySafeAfter))) return false;
  if (COMPOUND_BODY_ENABLED && reached(now, nextCompoundAt) && reached(now, compoundSafeAfter) &&
      reached(now, headSafeAfter) && reached(now, armSafeAfter) && reached(now, torsoSafeAfter)) return true;
  if (COMPOUND_BODY_ENABLED && !COMPOUND_ALONGSIDE) return false;
  return (HEAD_ENABLED && JAW_FOLLOWUP_MOTOR != 4 && reached(now, nextHeadAt) && reached(now, headSafeAfter)) ||
    (ARM_ENABLED && !(JAW_FOLLOWUP_RECURRING && (JAW_FOLLOWUP_MOTOR == 1 || JAW_FOLLOWUP_MOTOR == 3)) && reached(now, nextArmAt) && reached(now, armSafeAfter)) ||
    (TORSO_ENABLED && !(JAW_FOLLOWUP_RECURRING && (JAW_FOLLOWUP_MOTOR == 2 || JAW_FOLLOWUP_MOTOR == 3)) && reached(now, nextTorsoAt) && reached(now, torsoSafeAfter));
}

// Retire elapsed cooldowns while the cooperative loop is running. Otherwise an
// inactive motor's old deadline can look like a future one after ~24.9 days.
// Do not refresh movement targets: their overdue age decides scheduling priority.
// Future deadlines (including ones across millis wrap) are left untouched.
void retireElapsedCooldowns(uint32_t now) {
  uint32_t *deadlines[] = {&headSafeAfter, &headMovingUntil, &bodySafeAfter,
    &nextBodyWriteAt, &compoundSafeAfter, &torsoSafeAfter, &armSafeAfter,
    &mouthSafeAfter, &mouthPlayingUntil};
  for (uint32_t *deadline : deadlines) {
    if (reached(now, *deadline)) *deadline = now;
  }
}

uint32_t millisecondsUntil(uint32_t now, uint32_t when) {
  return reached(now, when) ? 0 : (when - now);
}

bool mouthConfigured() {
  return MOUTH_ENABLED && MOUTH_FILE_SERIAL != 0;
}

// Same CRC-8 algorithm used by Skelly Ultra Web Controller.
uint8_t skellyCRC(const uint8_t *data, size_t length) {
  uint8_t crc = 0;
  for (size_t i = 0; i < length; ++i) {
    uint8_t x = crc ^ data[i];
    for (int bit = 0; bit < 8; ++bit) {
      x = (x & 1) ? ((x >> 1) ^ 0x8C) : (x >> 1);
    }
    crc = x;
  }
  return crc;
}

bool sendVariableFrame(uint8_t *packet, size_t length) {
  if (!connected || client == nullptr || !client->isConnected() ||
      writeChar == nullptr || packet == nullptr || length < 4 || length > 13) {
    logLine("TX rejected: disconnected, missing writer, or invalid frame.");
    return false;
  }
  packet[length - 1] = skellyCRC(packet, length - 1);
  ++writeAttempts;
  lastAttemptTag = packet[1];
  const bool accepted = writeChar->writeValue(packet, length, false); // WRITE_NR
  const bool ok = accepted && client->isConnected();
  haveBleWrite = true;
  lastBleWriteAt = millis();
  if (ok) {
    lastAcceptedTag = packet[1];
    lastAcceptedAt = lastBleWriteAt;
  } else {
    ++writeFailures;
  }
  if (DIAGNOSTICS_ENABLED || !ok) {
    logEvent("TX AA%02X len=%u BLE=%s (device effect not confirmed).\n",
             (unsigned)packet[1], (unsigned)length, ok ? "accepted" : "failed");
  }
  return ok;
}
bool sendFrame(uint8_t packet[11]) {
  return sendVariableFrame(packet, 11);
}
void resetConnection(); // Arduino prototype: light/body writes may trigger reconnect.
void queueLightSequence(uint32_t now, uint32_t delayMs, const char *reason) {
  if (!LIGHTS_ENABLED) return;
  lightApplyStep = 0;
  lightApplyPending = true;
  nextLightWriteAt = now + delayMs;
  logEvent("LIGHTS: queued full sequence (%s), delay %lu ms.\n",
           reason, (unsigned long)delayMs);
  logDiagnostics("lights queued");
}
// Upstream live F2/F3/F4 layout (zero cluster, empty filename).
// We send 6 writes in order: torso F2/F3/F4, then head F2/F3/F4.
// Each write is spaced; don't assume a successful BLE write verifies LEDs.
bool progressLights(uint32_t now) {
  if (!LIGHTS_ENABLED || !lightApplyPending ||
      !reached(now, nextLightWriteAt) || !reached(now, nextBodyWriteAt) ||
      (haveBleWrite && !reached(now, lastBleWriteAt + 250)) ||
      jawFollowupPending) return false;
  const uint8_t torsoSteps = TORSO_LIGHT_MODE == 1 ? 3 : 4;
  const uint8_t totalSteps = torsoSteps + (HEAD_LIGHT_MODE == 1 ? 3 : 4);
  const uint8_t channel = lightApplyStep >= torsoSteps ? 1 : 0;
  const uint8_t mode = channel ? HEAD_LIGHT_MODE : TORSO_LIGHT_MODE;
  const uint8_t localStep = channel ? lightApplyStep - torsoSteps : lightApplyStep;
  // Dynamic modes insert F6 after F2; static channels keep the original bytes/order.
  const uint8_t stage = mode == 1 ? localStep : localStep == 1 ? 3 : localStep > 1 ? localStep - 1 : 0;
  const uint8_t brightness = channel ? HEAD_LIGHT_BRIGHTNESS : TORSO_LIGHT_BRIGHTNESS;
  const uint8_t offset = channel ? 3 : 0;
  const uint8_t r = activeLightPalette >= 0 ? LIGHT_PALETTES[activeLightPalette][offset] : channel ? HEAD_LIGHT_R : TORSO_LIGHT_R;
  const uint8_t g = activeLightPalette >= 0 ? LIGHT_PALETTES[activeLightPalette][offset+1] : channel ? HEAD_LIGHT_G : TORSO_LIGHT_G;
  const uint8_t b = activeLightPalette >= 0 ? LIGHT_PALETTES[activeLightPalette][offset+2] : channel ? HEAD_LIGHT_B : TORSO_LIGHT_B;
  bool ok = false;
  if (stage == 0) {
    // F2 static mode: community live-mode implementation uses 8 payload
    // bytes for torso ch0, 9 for head ch1.
    uint8_t frame[12] = {0xAA, 0xF2, channel, mode, 0, 0, 0, 0, 0, 0, 0, 0};
    ok = sendVariableFrame(frame, channel ? 12 : 11);
  } else if (stage == 1) {
    uint8_t frame[11] = {0xAA, 0xF3, channel, brightness, 0, 0, 0, 0, 0, 0, 0};
    ok = sendFrame(frame);
  } else if (stage == 3) {
    const uint8_t speed = channel ? HEAD_LIGHT_SPEED : TORSO_LIGHT_SPEED;
    uint8_t frame[11] = {0xAA, 0xF6, channel, speed, 0, 0, 0, 0, 0, 0, 0};
    ok = sendFrame(frame);
  } else {
    // F4: channel + RGB + cycle=0 + cluster=00000000 + empty filename=00
    uint8_t frame[13] = {0xAA, 0xF4, channel, r, g, b, 0, 0, 0, 0, 0, 0, 0};
    ok = sendVariableFrame(frame, 13);
  }
  if (!ok) {
    logLine("LIGHTS: BLE write failed; reconnecting.");
    resetConnection();
    return false;
  }
  logEvent("LIGHTS: ch%u %s sent (visual effect unverified).\n",
                channel, stage == 0 ? "mode" : stage == 1 ? "brightness" : stage == 3 ? "effect speed" : "RGB");
  ++lightApplyStep;
  nextLightWriteAt = millis() + LIGHT_WRITE_SPACING_MS;
  if (lightApplyStep >= totalSteps) {
    lightApplyPending = false;
    nextLightRotationAt = millis() + LIGHT_ROTATION_INTERVAL_MS;
    logEvent("LIGHTS: %u BLE writes complete; confirm colors/effects visually.\n", unsigned(totalSteps));
    logDiagnostics("lights complete");
  }
  return true;
}
void serviceLightRotation(uint32_t now) {
  if (!LIGHTS_ENABLED || !LIGHT_ROTATION_ENABLED || !connected || !routineWindowOpen() ||
      !reached(now, nextLightRotationAt) || lightApplyPending || lightRestorePending ||
      jawFollowupPending || mouthEndPending ||
      (mouthConfigured() && reached(now, nextMouthAt))) return;
  uint8_t choices[4], count = 0;
  for (uint8_t i = 0; i < 4; ++i)
    if ((LIGHT_PALETTE_MASK & (1 << i)) && i != activeLightPalette) choices[count++] = i;
  if (count < 1) return;
  activeLightPalette = choices[random(count)];
  nextLightRotationAt = now + LIGHT_ROTATION_INTERVAL_MS;
  queueLightSequence(now, 100, "palette rotation");
}
void startCompoundBody(uint32_t now) {
  if (!routineWindowOpen()) return;
#if SKELLY_RUNTIME
  const size_t maskCount = runtimeMaskCount;
#else
  const size_t maskCount = sizeof(COMPOUND_BODY_MASKS) / sizeof(COMPOUND_BODY_MASKS[0]);
#endif
  if (!maskCount) return;
  const uint8_t mask = COMPOUND_BODY_MASKS[random(maskCount)];
  const uint8_t enabled = (HEAD_ENABLED ? 1 : 0) | (ARM_ENABLED ? 2 : 0) |
                          (TORSO_ENABLED ? 4 : 0);
  if (mask < 3 || mask > 7 || (mask & ~enabled) != 0 ||
      ((mask & (mask - 1)) == 0)) {
    logLine("COMPOUND: invalid mask or motor disabled; skipping.");
    nextCompoundAt = now + COMPOUND_BODY_MAX_INTERVAL_MS;
    return;
  }
  uint8_t frame[11] = {0xAA, 0xCA, mask, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    logLine("COMPOUND: send failed.");
    resetConnection();
    return;
  }
  now = millis(); // Preserve the full cooldown after a blocking BLE write.
  lastTurnWasJaw = false;
  // All selected motors start TOGETHER in one BLE request. Lock conservatively
  // until the slowest one finishes AND its safety buffer expires.
  uint32_t duration = 0;
  if (mask & 1) {
    headMovingUntil = now + HEAD_ANIMATION_MS;
    headSafeAfter = now + HEAD_ANIMATION_MS + HEAD_BUFFER_MS;
    duration = max(duration, HEAD_ANIMATION_MS + HEAD_BUFFER_MS);
    nextHeadAt = now + random(HEAD_MIN_INTERVAL_MS, HEAD_MAX_INTERVAL_MS + 1);
  }
  if (mask & 2) {
    armSafeAfter = now + ARM_ANIMATION_MS + ARM_BUFFER_MS;
    duration = max(duration, ARM_ANIMATION_MS + ARM_BUFFER_MS);
    nextArmAt = now + random(ARM_MIN_INTERVAL_MS, ARM_MAX_INTERVAL_MS + 1);
  }
  if (mask & 4) {
    torsoSafeAfter = now + TORSO_ANIMATION_MS + TORSO_BUFFER_MS;
    duration = max(duration, TORSO_ANIMATION_MS + TORSO_BUFFER_MS);
    nextTorsoAt = now + random(TORSO_MIN_INTERVAL_MS, TORSO_MAX_INTERVAL_MS + 1);
  }
  bodySafeAfter = now + duration;
  compoundSafeAfter = bodySafeAfter;
  nextBodyWriteAt = now + BODY_WRITE_SPACING_MS;
  nextCompoundAt = now + random(COMPOUND_BODY_MIN_INTERVAL_MS,
                                COMPOUND_BODY_MAX_INTERVAL_MS + 1);
  logEvent("COMPOUND mask 0x%02X SENT; locked %lu sec; next target %lu sec.\n",
                mask, (unsigned long)(duration / 1000),
                (unsigned long)((nextCompoundAt - now) / 1000));
}

class SkellyScanCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    if (!advertisedDevice.haveName() || found) return;
    String name = advertisedDevice.getName().c_str();
    if (name != SKELLY_NAME) return;

    found = true;
    skellyDevice = new BLEAdvertisedDevice(advertisedDevice);
    logLine("Found Skelly by advertised name.");
    scanner->stop(); // The connection will happen AFTER scanning returns.
  }
};

void resetConnection() {
  logDiagnostics("connection reset");
  connected = false;
  activeLightPalette = -1;
  nextLightRotationAt = 0;
  portENTER_CRITICAL(&playbackMux);
  notifySource = nullptr; playbackRead = playbackWrite = 0; playbackDropped = 0;
  portEXIT_CRITICAL(&playbackMux);
  lastTurnWasJaw = false;
  clockWindowWasOpen = false;
  writeChar = nullptr;
  if (client != nullptr && client->isConnected()) client->disconnect();
  nextScanAt = millis(); // Re-scan immediately after power-off.
  jawDelayNotified = false;
  jawFollowupPending = false;
  jawFollowupTestDone = false;
  jawFollowupChosenMotor = 0;
  lastJawFollowupMotor = 0;
  jawEyeStartPending = false;
  jawEyeEndPending = false;
  lightApplyPending = false;
  lightRestorePending = false;
  lightApplyStep = 0;
  mouthEndPending = false;
  haveBleWrite = false;
}

bool connectToSkelly() {
  if (!found || skellyDevice == nullptr) return false;
  if (client == nullptr) client = BLEDevice::createClient();
  ++connectionAttempts;
  logDiagnostics("connecting");
  if (client == nullptr) {
    logLine("BLE client allocation failed.");
    return false;
  }

  logLine("Connecting to Skelly (scan is finished)...");
  if (!client->connect(skellyDevice)) {
    logLine("Connection failed.");
    resetConnection();
    return false;
  }

  // The pinned Bluedroid client retains service objects across disconnects.
  // Invalidate our writer before getServices deletes/rebuilds that cache.
  writeChar = nullptr;
  auto *services = client->getServices();
  if (services == nullptr || services->empty() || !client->isConnected()) {
    logLine("BLE service discovery failed or disconnected.");
    resetConnection();
    return false;
  }
  BLERemoteService *service = client->getService(SERVICE_UUID);
  if (service == nullptr) {
    logLine("AE00 service missing.");
    resetConnection();
    return false;
  }
  writeChar = service->getCharacteristic(WRITE_UUID);
  if (writeChar == nullptr || !client->isConnected()) {
    logLine("AE01 characteristic missing.");
    resetConnection();
    return false;
  }

  connected = true;
  const uint32_t now = millis();
  activeLightPalette = -1;
  if (LIGHT_ROTATION_ENABLED) {
    for (uint8_t i = 0; i < 4; ++i) if (LIGHT_PALETTE_MASK & (1 << i)) { activeLightPalette = i; break; }
  }
  nextLightRotationAt = now + LIGHT_ROTATION_INTERVAL_MS;
  nextHeadAt = now + random(HEAD_MIN_INTERVAL_MS, HEAD_MAX_INTERVAL_MS + 1);
  headSafeAfter = now;
  headMovingUntil = now;
  bodySafeAfter = now;
  nextBodyWriteAt = now;
  compoundSafeAfter = now;
  nextCompoundAt = now + random(COMPOUND_BODY_MIN_INTERVAL_MS,
                                COMPOUND_BODY_MAX_INTERVAL_MS + 1);
  lightRestorePending = false;
  lightApplyPending = false;
  lightApplyStep = 0;
  mouthEndPending = false;
  haveBleWrite = false;
  if (!CLOCK_WINDOW_ENABLED) queueLightSequence(now, 1500, "connection");
  torsoSafeAfter = now;
  armSafeAfter = now;
  nextTorsoAt = now + random(TORSO_MIN_INTERVAL_MS, TORSO_MAX_INTERVAL_MS + 1);
  nextArmAt = now + random(ARM_MIN_INTERVAL_MS, ARM_MAX_INTERVAL_MS + 1);
  mouthSafeAfter = now;
  mouthPlayingUntil = now;
  nextMouthAt = now + random(MOUTH_MIN_INTERVAL_MS, MOUTH_MAX_INTERVAL_MS + 1);
  nextEyeAt = now + random(EYE_MIN_INTERVAL_MS, EYE_MAX_INTERVAL_MS + 1);
  // Establish an eye icon promptly after connection so jaw playback can restore it.
  if (EYES_ENABLED) nextEyeAt = now + 2000;
  lastEye = 0;
  jawDelayNotified = false;
  jawFollowupPending = false;
  jawFollowupTestDone = false;
  jawFollowupChosenMotor = 0;
  lastJawFollowupMotor = 0;
  jawEyeStartPending = false;
  jawEyeEndPending = false;

  if (PLAYBACK_DIAGNOSTICS) {
    auto *notify = service->getCharacteristic("0000ae02-0000-1000-8000-00805f9b34fb");
    if (notify != nullptr && notify->canNotify()) {
      portENTER_CRITICAL(&playbackMux); notifySource = notify; portEXIT_CRITICAL(&playbackMux);
      notify->registerForNotify(playbackNotification);
      logLine("AE02 passive observations enabled; no playback-end control.");
    } else logLine("AE02 notifications unavailable; conservative model retained.");
    if (!client->isConnected()) { resetConnection(); return false; }
  }

  logEvent("CONNECTED. Head %s, jaw %s, torso %s, arm %s.\n",
    HEAD_ENABLED ? "ON" : "OFF", MOUTH_ENABLED ? "ON" : "OFF",
    TORSO_ENABLED ? "ON" : "OFF", ARM_ENABLED ? "ON" : "OFF");
  logEvent("Compound body mode %s; live RGB lights %s (restore mode %u).\n",
                COMPOUND_BODY_ENABLED ? "ON" : "OFF",
                LIGHTS_ENABLED ? "ON" : "OFF", (unsigned)LIGHT_RESTORE_MODE);
  logEvent("Body motor overlap %s. Jaw protection (head/arm/torso) %s.\n",
                ALLOW_BODY_MOTOR_OVERLAP ? "ON" : "OFF",
                JAW_PROTECTS_ARM_TORSO ? "ON" : "OFF");
  logEvent("Jaw-first follow-up: %s after %lu ms (%s).\n",
                JAW_FOLLOWUP_MOTOR == 1 ? "ARM" :
                JAW_FOLLOWUP_MOTOR == 2 ? "TORSO" :
                JAW_FOLLOWUP_MOTOR == 3 ? "ALTERNATING" :
                JAW_FOLLOWUP_MOTOR == 4 ? "HEAD (EXPERIMENTAL)" : "OFF",
                (unsigned long)JAW_FOLLOWUP_DELAY_MS,
                JAW_FOLLOWUP_RECURRING ? "RECURRING frequency-gated" : "ONE-SHOT");
  if (HEAD_ENABLED) {
    logEvent("First head in %lu seconds.\n",
                  (unsigned long)((nextHeadAt - now) / 1000));
  } else {
    logLine("Head motion disabled.");
  }
  if (mouthConfigured()) {
    logEvent("Jaw file serial %u; first attempt in ~%lu seconds.\n",
                  (unsigned)MOUTH_FILE_SERIAL,
                  (unsigned long)((nextMouthAt - now) / 1000));
  } else {
    logLine("Jaw OFF: set MOUTH_FILE_SERIAL after uploading the jaw MP3.");
  }
  if (EYES_ENABLED) {
    logEvent("First eye selection in ~%lu seconds.\n",
                  (unsigned long)((nextEyeAt - now) / 1000));
  } else {
    logLine("Random eyes OFF (enable after confirming eye commands).");
  }
  runtimeSceneConnected();
  logDiagnostics("connected");
  return true;
}

uint32_t scanRetryDelay(uint32_t now) {
  if (startupScanActive && (uint32_t)(now - startupScanStartedAt) >= STARTUP_SCAN_WINDOW_MS)
    startupScanActive = false;
  return startupScanActive ? STARTUP_SCAN_RETRY_MS : SCAN_RETRY_MS;
}

uint32_t scanRetryPause(uint32_t startedAt, uint32_t now) {
  const uint32_t interval = scanRetryDelay(now);
  if (!startupScanActive) return interval;
  const uint32_t elapsed = now - startedAt;
  return elapsed >= interval ? 0 : interval - elapsed;
}

void scanAndConnect() {
  const uint32_t scanStartedAt = millis();
  ++scanAttempts;
  logDiagnostics("scan");
  logLine("Scanning for Ultra Skelly v2...");
  found = false;
  if (skellyDevice != nullptr) {
    delete skellyDevice;
    skellyDevice = nullptr;
  }
  scanner->clearResults();
  scanner->start(SCAN_SECONDS, false);

  if (!found) {
    const uint32_t retry = scanRetryPause(scanStartedAt, millis());
    logEvent("Not found. Retrying after %lu seconds.\n", (unsigned long)(retry / 1000));
    nextScanAt = millis() + retry;
    return;
  }

  delay(500);
  if (connectToSkelly()) {
    startupScanActive = false;
  } else {
    const uint32_t retry = scanRetryPause(scanStartedAt, millis());
    nextScanAt = millis() + retry;
    logEvent("Retrying BLE connection after %lu seconds.\n", (unsigned long)(retry / 1000));
  }
}

void startHead(uint32_t now) {
  if (!routineWindowOpen()) return;
  // Verified head-only frame. No arm or torso movement bits.
  uint8_t frame[11] = {0xAA, 0xCA, 0x01, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    logLine("Head send failed / disconnected.");
    resetConnection();
    return;
  }

  now = millis(); // Start modeled motion/cooldown after transport returns.
  lastTurnWasJaw = false;
  headMovingUntil = now + HEAD_ANIMATION_MS;
  headSafeAfter = now + HEAD_ANIMATION_MS + HEAD_BUFFER_MS;
  bodySafeAfter = headSafeAfter;
  nextBodyWriteAt = now + BODY_WRITE_SPACING_MS;
  // Keep original start-to-start timing regardless of jaw playback.
  const uint32_t headInterval = random(HEAD_MIN_INTERVAL_MS,
                                       HEAD_MAX_INTERVAL_MS + 1);
  nextHeadAt = now + headInterval;

  const bool jawAlreadyPlaying = !reached(now, mouthPlayingUntil);
  logEvent("HEAD command sent; next head in %lu sec%s.\n",
                (unsigned long)(headInterval / 1000),
                jawAlreadyPlaying ? " (jaw audio may be playing too)" : "");
}

// Only called by the shared body-motor scheduler after cooldown.
void startTorso(uint32_t now) {
  if (!routineWindowOpen()) return;
  uint8_t frame[11] = {0xAA, 0xCA, 0x04, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    logLine("Torso send failed / disconnected.");
    resetConnection();
    return;
  }
  now = millis();
  bodySafeAfter = now + TORSO_ANIMATION_MS + TORSO_BUFFER_MS;
  lastTurnWasJaw = false;
  torsoSafeAfter = bodySafeAfter;
  nextBodyWriteAt = now + BODY_WRITE_SPACING_MS;
  const uint32_t interval = random(TORSO_MIN_INTERVAL_MS, TORSO_MAX_INTERVAL_MS + 1);
  nextTorsoAt = now + interval;
  logEvent("TORSO command sent; next torso target in %lu sec.\n",
                (unsigned long)(interval / 1000));
}

void startArm(uint32_t now) {
  if (!routineWindowOpen()) return;
  // Physically verified arm-only action: two back-to-back moves ~22s.
  uint8_t frame[11] = {0xAA, 0xCA, 0x02, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    logLine("Arm send failed / disconnected.");
    resetConnection();
    return;
  }
  now = millis();
  bodySafeAfter = now + ARM_ANIMATION_MS + ARM_BUFFER_MS;
  lastTurnWasJaw = false;
  armSafeAfter = bodySafeAfter;
  nextBodyWriteAt = now + BODY_WRITE_SPACING_MS;
  const uint32_t interval = random(ARM_MIN_INTERVAL_MS, ARM_MAX_INTERVAL_MS + 1);
  nextArmAt = now + interval;
  logEvent("ARM command sent; next arm target in %lu sec.\n",
                (unsigned long)(interval / 1000));
}

// Select at most one motor after a jaw MP3. In recurring mode each motor
// must be due by its own randomized start-to-start interval. When both
// motors are due, prefer the one not selected on the preceding successful
// jaw-first event. Actual cooldown / body-lock checks happen before sending.
uint8_t chooseJawFollowupMotor(uint32_t now) {
  if (JAW_FOLLOWUP_MOTOR == 0) return 0;
  const bool headDue = HEAD_ENABLED &&
      (!JAW_FOLLOWUP_RECURRING || reached(now, nextHeadAt));
  const bool armDue = ARM_ENABLED &&
      (!JAW_FOLLOWUP_RECURRING || reached(now, nextArmAt));
  const bool torsoDue = TORSO_ENABLED &&
      (!JAW_FOLLOWUP_RECURRING || reached(now, nextTorsoAt));
  if (JAW_FOLLOWUP_MOTOR == 4) return headDue ? 4 : 0;
  if (JAW_FOLLOWUP_MOTOR == 1) return armDue ? 1 : 0;
  if (JAW_FOLLOWUP_MOTOR == 2) return torsoDue ? 2 : 0;
  if (JAW_FOLLOWUP_MOTOR == 3) {
    if (armDue && torsoDue) return lastJawFollowupMotor == 1 ? 2 : 1;
    if (armDue) return 1;
    if (torsoDue) return 2;
  }
  return 0;
}

void startMouth(uint32_t now) {
  if (!routineWindowOpen()) return;
  // AAC6 payload: 2-byte big-endian file serial, 01 = play,
  // remaining 5 bytes zero, CRC8 calculated automatically.
  uint8_t frame[11] = {
    0xAA, 0xC6,
    (uint8_t)(MOUTH_FILE_SERIAL >> 8),
    (uint8_t)(MOUTH_FILE_SERIAL & 0xFF),
    0x01, 0, 0, 0, 0, 0, 0
  };
  if (!sendFrame(frame)) {
    logLine("Jaw playback send failed / disconnected.");
    resetConnection();
    return;
  }
  jawDelayNotified = false;
  // Base the estimate on completion of the BLE call, which may block.
  now = millis();
  const uint32_t clipDuration = jawDurationMs(MOUTH_FILE_SERIAL);
  mouthPlayingUntil = now + clipDuration;
  lastTurnWasJaw = true;
  mouthEndPending = true;
  logEvent("MP3: modeled duration %lu ms; playback end unconfirmed.\n",
           (unsigned long)clipDuration);
  if (LIGHTS_ENABLED && LIGHT_RESTORE_MODE != 0) {
    // A partial earlier sequence cannot restore a coherent pair of channels
    // after AAC6 has reapplied saved settings. Restart a full sequence later.
    lightApplyPending = false;
    lightApplyStep = 0;
    lightRestoreAt = mouthPlayingUntil + LIGHT_RESTORE_GRACE_MS;
    lightRestorePending = true;
    logEvent("LIGHTS: final restore due at uptime %lu ms (modeled end + grace).\n",
             (unsigned long)lightRestoreAt);
    if (LIGHT_RESTORE_MODE == 2) queueLightSequence(now, 3000, "during MP3 (experimental)");
  }
  // Choose one motor for this MP3, if one-shot or random-frequency-gated
  // coordination is due. New playback replaces an unserved pending event.
  jawFollowupChosenMotor = chooseJawFollowupMotor(now);
  jawFollowupPending = jawFollowupChosenMotor != 0 &&
                       (JAW_FOLLOWUP_RECURRING || !jawFollowupTestDone);
  jawFollowupAt = now + JAW_FOLLOWUP_DELAY_MS;
  if (jawFollowupPending) {
    logEvent("JAW-FIRST %s: scheduled %s %lu ms after MP3 start.\n",
                  JAW_FOLLOWUP_RECURRING ? "RECURRING" : "ONE-SHOT",
                  jawFollowupChosenMotor == 1 ? "ARM" :
                  jawFollowupChosenMotor == 2 ? "TORSO" : "HEAD",
                  (unsigned long)JAW_FOLLOWUP_DELAY_MS);
  }
  mouthSafeAfter = mouthPlayingUntil + MOUTH_BUFFER_MS;
  // Stored MP3 metadata may change the eyes. Schedule an AAF9 correction,
  // without interrupting AAC6 audio or issuing any new motor commands.
  if (EYES_ENABLED && EYE_JAW_MODE != 0) {
    jawEyeStartAt = now + EYE_JAW_START_DELAY_MS;
    jawEyeEndAt = mouthPlayingUntil + EYE_JAW_END_GRACE_MS;
    jawEyeStartPending = true;
    jawEyeEndPending = true;
  }
  const uint32_t jawInterval = random(MOUTH_MIN_INTERVAL_MS,
                                      MOUTH_MAX_INTERVAL_MS + 1);
  nextMouthAt = now + jawInterval; // Start-to-start, not after the clip.
  const bool headIsMoving = !reached(now, headMovingUntil);
  logEvent("JAW command sent (file #%u); next jaw in %lu sec%s.\n",
                (unsigned)MOUTH_FILE_SERIAL,
                (unsigned long)(jawInterval / 1000),
                headIsMoving ? " (OVERLAPPING head motion)" : "");
  logDiagnostics("MP3 start");
}

bool sendEyeIcon(uint8_t icon, const char *reason) {
  // Verified LIVE-eye AAF9 frame. No motor movement is commanded.
  uint8_t frame[11] = {0xAA, 0xF9, icon, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    logLine("Eye request failed / disconnected.");
    resetConnection();
    return false;
  }
  lastEye = icon;
  logEvent("EYES: icon %u (%s).\n", (unsigned)icon, reason);
  return true;
}

void changeEyes(uint32_t now) {
  uint8_t eye = (uint8_t)random(1, 19); // inclusive 1-18
  if (eye == lastEye) eye = (uint8_t)((eye % 18) + 1);
  if (!sendEyeIcon(eye, "random selection")) return;
  const uint32_t interval = random(EYE_MIN_INTERVAL_MS,
                                    EYE_MAX_INTERVAL_MS + 1);
  nextEyeAt = now + interval;
  logEvent("EYES: requested icon %u; next in %lu sec.\n",
                (unsigned)eye, (unsigned long)(interval / 1000));
}

#if SKELLY_RUNTIME
// Fixed-size, versioned records; two NVS slots preserve the last valid program.
const size_t RUNTIME_WORDS = 3 + 4 * RF_COUNT;
struct RuntimeRecord { uint32_t magic, sequence, count, crc, guard; uint32_t words[RUNTIME_WORDS]; };
static_assert(sizeof(RuntimeRecord)==(RUNTIME_WORDS+5)*4,"Unexpected runtime record padding");
class RuntimeEngine {
 public:
  RuntimeRecord active{}, staging{}, dump{};
  Preferences prefs;
  bool storage=false, transfer=false, pending=false, savePending=false, dumping=false;
  uint8_t slot=0, scene=0;
  uint32_t request=0, received=0, touched=0, sceneAt=0, dumpRequest=0, dumpOffset=0;
  static uint32_t checksum(const RuntimeRecord &r) {
    uint32_t c=0xffffffff;
    for(size_t i=0;i<r.count;++i)for(uint8_t b=0;b<4;++b){c^=(r.words[i]>>(8*b))&255;for(uint8_t k=0;k<8;++k)c=(c>>1)^((c&1)?0xedb88320UL:0);}
    return c^0xffffffff;
  }
  static uint32_t headerGuard(const RuntimeRecord &r) {
    uint32_t c=0xffffffff;const uint32_t words[]={r.magic,r.sequence,r.count,r.crc};
    for(uint32_t word:words)for(uint8_t b=0;b<4;++b){c^=(word>>(8*b))&255;for(uint8_t k=0;k<8;++k)c=(c>>1)^((c&1)?0xedb88320UL:0);}
    return c^0xffffffff;
  }
  static bool storedValid(const RuntimeRecord &r){return valid(r)&&r.guard==headerGuard(r);}
  static bool validText(const uint32_t *v,size_t words,uint16_t maxUnits) {
    uint16_t units=0;bool ended=false,visible=false;uint8_t remaining=0,low=128,high=191;
    for(size_t i=0;i<words*4;++i){const uint8_t b=(v[i/4]>>(8*(i%4)))&255;
      if(!b){if(remaining)return false;ended=true;continue;}if(ended)return false;
      if(remaining){if(b<low||b>high)return false;low=128;high=191;--remaining;continue;}
      if(b<32||b==127)return false;
      if(b<128){++units;if(b!=' ')visible=true;}
      else if(b>=194&&b<=223){remaining=1;++units;visible=true;}
      else if(b>=224&&b<=239){remaining=2;++units;low=b==224?160:128;high=b==237?159:191;visible=true;}
      else if(b>=240&&b<=244){remaining=3;units+=2;low=b==240?144:128;high=b==244?143:191;visible=true;}
      else return false;
      if(units>maxUnits)return false;
    }
    return !remaining&&visible;
  }
  static bool valid(const RuntimeRecord &r) {
    if(r.magic!=0x534b5231 || r.count<3 || r.count>RUNTIME_WORDS || r.words[0]!=1 ||
       r.words[1]<1 || r.words[1]>4 || r.words[2]>2 || r.count!=3+r.words[1]*RF_COUNT || checksum(r)!=r.crc)return false;
    for(uint32_t n=0;n<r.words[1];++n){
      const uint32_t *v=r.words+3+n*RF_COUNT;
      for(size_t i=0;i<RF_COUNT;++i)if(v[i]<RUNTIME_LIMITS[i][0]||v[i]>RUNTIME_LIMITS[i][1])return false;
      if(!validText(v+RF_sceneLabel0,32,32)||!validText(v+RF_name0,12,48))return false;
      for(uint8_t p=0;p<4;++p)if(!validText(v+RF_paletteLabel0_0+p*24,24,24))return false;
      for(uint32_t prior=0;prior<n;++prior)if(memcmp(v+RF_sceneLabel0,r.words+3+prior*RF_COUNT+RF_sceneLabel0,32*4)==0)return false;
      const size_t mins[]={RF_headMin,RF_armMin,RF_torsoMin,RF_jawMin,RF_eyesMin,RF_compoundMin,RF_restMin,RF_restDurationMin};
      for(size_t i:mins)if(v[i]>v[i+1])return false;
      if(v[RF_clockStart]==v[RF_clockEnd] || (!v[RF_headEnabled]&&!v[RF_armEnabled]&&!v[RF_torsoEnabled]&&!v[RF_jawEnabled]&&!v[RF_eyesEnabled]&&!v[RF_lightsEnabled]))return false;
      if(v[RF_lightRotation] && !(v[RF_lightMask]&(v[RF_lightMask]-1)))return false;
      const uint8_t enabled=(v[RF_headEnabled]?1:0)|(v[RF_armEnabled]?2:0)|(v[RF_torsoEnabled]?4:0);
      if(v[RF_compoundEnabled]){
        if(!v[RF_comboMask]||v[RF_jawFollowupMotor]||(v[RF_jawEnabled]&&!v[RF_jawProtectBody]))return false;
        const uint8_t masks[]={3,5,6,7};for(uint8_t i=0;i<4;++i)if((v[RF_comboMask]&(1<<i))&&(masks[i]&~enabled))return false;
      }
      const uint32_t follow=v[RF_jawFollowupMotor];
      if((follow&&!v[RF_jawEnabled]) || (follow==1&&!v[RF_armEnabled]) || (follow==2&&!v[RF_torsoEnabled]) ||
         (follow==3&&(!v[RF_armEnabled]||!v[RF_torsoEnabled]||!v[RF_jawFollowupRecurring])))return false;
      if(v[RF_file0]!=v[RF_jawFile])return false;
      for(uint32_t i=0;i<8;++i){
        const uint32_t f=v[RF_file0+i*2],d=v[RF_duration0+i*2];
        if(i<v[RF_fileCount]){if(!f||(d&&d<21))return false;for(uint32_t j=0;j<i;++j)if(v[RF_file0+j*2]==f)return false;}
        else if(f||d)return false;
      }
      bool ended=false,have=false;
      for(uint8_t i=0;i<48;++i){const uint8_t b=(v[RF_name0+i/4]>>(8*(i%4)))&255;
        if(!b)ended=true;else{if(ended||b<32||b==127)return false;have=true;}}
      if(!have)return false;
      if(n && memcmp(v+RF_name0,r.words+3+RF_name0,12*4)!=0)return false;
    }
    return true;
  }
  void error(uint32_t id,const char *reason){logEvent("USB CFG ERROR %lu %s\n",(unsigned long)id,reason);}
  void select(uint8_t next) {
    scene=next;
    memcpy(runtimeValues,active.words+3+scene*RF_COUNT,sizeof(runtimeValues));
    runtimeEyeCount=runtimeMaskCount=0;
    for(uint8_t i=0;i<18;++i)if(runtimeValues[RF_eyeMask]&(1UL<<i))runtimeEyes[runtimeEyeCount++]=i+1;
    const uint8_t masks[]={3,5,6,7};for(uint8_t i=0;i<4;++i)if(runtimeValues[RF_comboMask]&(1<<i))runtimeMasks[runtimeMaskCount++]=masks[i];
    runtimeFileCount=runtimeValues[RF_fileCount];for(uint8_t i=0;i<8;++i)runtimeFiles[i]=runtimeValues[RF_file0+i*2];
    for(uint8_t i=0;i<4;++i)for(uint8_t p=0;p<2;++p)for(uint8_t ch=0;ch<3;++ch)runtimePalettes[i][p*3+ch]=(runtimeValues[RF_palette0Torso+i*2+p]>>(16-8*ch))&255;
    for(uint8_t i=0;i<48;++i)runtimeName[i]=(runtimeValues[RF_name0+i/4]>>(8*(i%4)))&255;runtimeName[48]=0;
    sceneAt=millis()+runtimeValues[RF_holdSec]*1000UL;
  }
  void boot() {
    clockValid=false;clockCivilMillis=0;clockLastTick=millis();
    active={};active.magic=0x534b5231;active.count=sizeof(RUNTIME_SEED)/4;memcpy(active.words,RUNTIME_SEED,sizeof(RUNTIME_SEED));active.crc=checksum(active);
    storage=prefs.begin("skelly-config",false);
    RuntimeRecord candidate{};bool haveStored=false;
    if(storage)for(uint8_t i=0;i<2;++i){const char *key=i?"slot1":"slot0";
      if(prefs.getBytesLength(key)==sizeof(candidate)&&prefs.getBytes(key,&candidate,sizeof(candidate))==sizeof(candidate)&&storedValid(candidate)&&
         (!haveStored||(int32_t)(candidate.sequence-active.sequence)>0)){active=candidate;slot=i;haveStored=true;}}
    if(!valid(active)){logLine("USB CFG invalid seed; no routines enabled");memset(runtimeValues,0,sizeof(runtimeValues));return;}
    select(0);logEvent("USB CFG boot sequence=%lu crc=%lu storage=%u\n",(unsigned long)active.sequence,(unsigned long)active.crc,unsigned(storage));
  }
  bool idle(uint32_t now) {
    return reached(now,bodySafeAfter)&&reached(now,headSafeAfter)&&reached(now,armSafeAfter)&&reached(now,torsoSafeAfter)&&
      reached(now,mouthPlayingUntil)&&reached(now,mouthSafeAfter)&&!jawFollowupPending&&!mouthEndPending&&!jawEyeStartPending&&!jawEyeEndPending&&!lightApplyPending&&!lightRestorePending;
  }
  bool persist() {
    if(!storage)return false;
    staging.sequence=active.sequence+1;
    staging.guard=headerGuard(staging);
    const char *key=slot?"slot0":"slot1";
    if(prefs.putBytes(key,&staging,sizeof(staging))!=sizeof(staging))return false;
    RuntimeRecord check{};
    return prefs.getBytes(key,&check,sizeof(check))==sizeof(check)&&storedValid(check)&&memcmp(&check,&staging,sizeof(check))==0;
  }
  void service() {
    const uint32_t now=millis();
    // Keep elapsed locks fresh even while disconnected or awaiting USB apply.
    // Future motion/playback deadlines retain their complete cooldowns.
    retireElapsedCooldowns(now);
    if(transfer && uint32_t(now-touched)>30000){transfer=false;error(request,"TIMEOUT");}
    if(dumping){
      if(dumpOffset<dump.count){char data[80];size_t used=0;const uint32_t end=stdMin(dumpOffset+8,dump.count);
        for(uint32_t i=dumpOffset;i<end;++i)used+=snprintf(data+used,sizeof(data)-used,"%s%08lX",i==dumpOffset?"":" ",(unsigned long)dump.words[i]);
        logEvent("USB CFG DATA %lu %lu %s\n",(unsigned long)dumpRequest,(unsigned long)dumpOffset,data);dumpOffset=end;
      }else{logEvent("USB CFG END %lu\n",(unsigned long)dumpRequest);dumping=false;}
    }
    if(!pending && !transfer && !dumping && connected && active.words[2] && active.words[1]>1 && reached(now,sceneAt)){pending=true;savePending=false;}
    if(!pending||!idle(now))return;
    if(savePending){
      if(!persist()){error(request,"STORAGE");pending=savePending=false;return;}
      active=staging;slot=1-slot;select(0);
      logEvent("USB CFG APPLIED %lu %lu %lu\n",(unsigned long)request,(unsigned long)active.sequence,(unsigned long)active.crc);
    }else {
      uint8_t next=(scene+1)%active.words[1];
      if(active.words[2]==2){next=uint8_t(random(0,long(active.words[1]-1)));if(next>=scene)++next;}
      select(next);
    }
    pending=savePending=false;
    // Reconnect after the complete old routine has drained. No actuator command here.
    resetConnection();nextRestAt=restUntil=now;
    logEvent("USB SCENE active=%u sequence=%lu\n",unsigned(scene),(unsigned long)active.sequence);
  }
  static uint32_t stdMin(uint32_t a,uint32_t b){return a<b?a:b;}
  static bool number(const char *&p,uint32_t &value,uint8_t base=10){
    if(!*p)return false;uint64_t n=0;uint8_t digits=0;
    while(*p&&*p!=' '){uint8_t d=255;if(*p>='0'&&*p<='9')d=*p-'0';else if(base==16&&*p>='a'&&*p<='f')d=*p-'a'+10;else if(base==16&&*p>='A'&&*p<='F')d=*p-'A'+10;
      if(d>=base||++digits>10)return false;n=n*base+d;if(n>0xffffffffULL)return false;++p;}
    value=uint32_t(n);if(*p==' ')++p;return true;
  }
  bool command(const char *line) {
    const char *prefix="SKELLY CFG ";if(strncmp(line,prefix,strlen(prefix)))return false;
    const char *p=line+strlen(prefix);uint32_t id=0,n=0;
    if(strncmp(p,"GET ",4)==0){p+=4;if(!number(p,id)||*p){error(id,"FORMAT");return true;}if(dumping){error(id,"BUSY");return true;}
      dump=active;dumpRequest=id;dumpOffset=0;dumping=true;
      logEvent("USB CFG DUMP %lu %lu %lu %lu\n",(unsigned long)id,(unsigned long)active.count,(unsigned long)active.sequence,(unsigned long)active.crc);return true;}
    if(strncmp(p,"ABORT ",6)==0){p+=6;if(number(p,id)&&!*p&&id==request){transfer=pending=savePending=false;logEvent("USB CFG ABORTED %lu\n",(unsigned long)id);}return true;}
    if(strncmp(p,"RESET ",6)==0){p+=6;if(!number(p,id)||*p){error(id,"FORMAT");return true;}if(transfer||pending){error(id,"BUSY");return true;}
      staging={};staging.magic=0x534b5231;staging.count=sizeof(RUNTIME_SEED)/4;memcpy(staging.words,RUNTIME_SEED,sizeof(RUNTIME_SEED));staging.crc=checksum(staging);request=id;pending=savePending=true;
      logEvent("USB CFG QUEUED %lu\n",(unsigned long)id);return true;}
    if(strncmp(p,"BEGIN ",6)==0){p+=6;if(!number(p,id)||!number(p,n)||*p||n<3||n>RUNTIME_WORDS){error(id,"FORMAT");return true;}if(transfer||pending){error(id,"BUSY");return true;}
      staging={};staging.magic=0x534b5231;staging.count=n;request=id;received=0;touched=millis();transfer=true;logEvent("USB CFG ACK %lu 0\n",(unsigned long)id);return true;}
    if(strncmp(p,"DATA ",5)==0){p+=5;if(!number(p,id)||!number(p,n)||!transfer||id!=request||n!=received){error(id,"ORDER");return true;}
      uint32_t values[8],count=0;while(*p&&count<8)if(!number(p,values[count++],16)){error(id,"FORMAT");return true;}
      if(*p||!count||received+count>staging.count){error(id,"SIZE");return true;}
      memcpy(staging.words+received,values,count*4);received+=count;touched=millis();logEvent("USB CFG ACK %lu %lu\n",(unsigned long)id,(unsigned long)received);return true;}
    if(strncmp(p,"COMMIT ",7)==0){p+=7;if(!number(p,id)||!number(p,n)||*p||!transfer||id!=request||received!=staging.count){error(id,"INCOMPLETE");return true;}
      staging.crc=n;if(!valid(staging)){transfer=false;error(id,"INVALID");return true;}transfer=false;pending=savePending=true;logEvent("USB CFG QUEUED %lu\n",(unsigned long)id);return true;}
    error(id,"UNKNOWN");return true;
  }
};
RuntimeEngine runtimeEngine;
void runtimeBoot(){runtimeEngine.boot();}
bool runtimeCommand(const char *line){return runtimeEngine.command(line);}
void serviceRuntime(){runtimeEngine.service();}
void runtimeSceneConnected(){runtimeEngine.sceneAt=millis()+runtimeValues[RF_holdSec]*1000UL;}
bool runtimePending(){return runtimeEngine.pending;}
bool runtimeBusy(){return runtimeEngine.transfer||runtimeEngine.dumping;}
uint32_t runtimeSceneIndex(){return runtimeEngine.scene;}
uint32_t runtimeSequence(){return runtimeEngine.active.sequence;}
uint32_t runtimeProgramCRC(){return runtimeEngine.active.crc;}
uint32_t runtimeJawDuration(uint16_t file){for(uint8_t i=0;i<runtimeFileCount;++i)if(runtimeFiles[i]==file&&runtimeValues[RF_duration0+i*2])return runtimeValues[RF_duration0+i*2]*1000UL;return MOUTH_CLIP_MS;}
#endif


void setup() {
  Serial.begin(115200);
  delay(1000);
  runtimeBoot();
  recordBoot(esp_reset_reason());
  logEvent("BOOT usb-scheduler-v4: count=%lu resetReason=%u heap=%lu minHeap=%lu diagnostics=%s\n",
           (unsigned long)bootCount, (unsigned)esp_reset_reason(),
           (unsigned long)ESP.getFreeHeap(), (unsigned long)ESP.getMinFreeHeap(),
           DIAGNOSTICS_ENABLED ? "ON" : "OFF");
  logLine("\n=== ULTRA SKELLY: AUTONOMOUS HEAD/JAW/EYES + OPTIONAL TORSO/ARM ===");
  randomSeed(micros());
#if SKELLY_WIRELESS_STATUS
  BLEDevice::init("Skelly Status Experiment");
  setupWirelessStatus();
#else
  BLEDevice::init("");
#endif
  scanner = BLEDevice::getScan();
  scanner->setAdvertisedDeviceCallbacks(new SkellyScanCallbacks());
  scanner->setActiveScan(true);
  nextScanAt = millis();
  startupScanStartedAt = millis();
  startupScanActive = true;
  logLine("USB READY v1 CLOCK");
  if (CLOCK_WINDOW_ENABLED) logLine("CLOCK: new routines paused until USB time is set and the window opens.");
}

void loop() {
  serviceUsbClock();
  serviceRuntime();
  serviceWirelessStatus();
  if (PLAYBACK_DIAGNOSTICS) drainPlaybackObservation();
  uint32_t now = millis();
  if (connected && (client == nullptr || !client->isConnected())) {
    logLine("Disconnected; scanning again.");
    resetConnection();
  }

  if (!connected) {
    if (runtimeBusy() || runtimePending()) { delay(10); return; }
    if (reached(now, nextScanAt)) scanAndConnect();
    delay(100);
    return;
  }

  retireElapsedCooldowns(now);
  const bool windowOpen = routineWindowOpen();
  if (CLOCK_WINDOW_ENABLED && windowOpen != clockWindowWasOpen) {
    clockWindowWasOpen = windowOpen;
    if (windowOpen) {
      postponeRoutineTargets(now);
      queueLightSequence(now, 1500, "clock window opened");
      logLine("CLOCK: window open; fresh intervals scheduled.");
    } else {
      jawFollowupPending = false;
      logLine("CLOCK: window closed; existing motion and restoration may finish.");
    }
  }

  if (mouthEndPending && reached(now, mouthPlayingUntil)) {
    mouthEndPending = false;
    logLine("MP3: modeled clip end reached; actual playback end unconfirmed.");
    logDiagnostics("modeled MP3 end");
  }

  // First correct any eye icon that the MP3's saved settings changed.
  // Use a delayed BLE write so playback has time to apply its metadata.
  if (connected && EYES_ENABLED && EYE_JAW_MODE != 0) {
    if (jawEyeStartPending && reached(millis(), jawEyeStartAt)) {
      jawEyeStartPending = false;
      if (EYE_JAW_MODE == 2 || lastEye == 0) {
        changeEyes(millis()); // Coordinated new expression when jaw starts.
      } else {
        sendEyeIcon(lastEye, "restored after jaw starts");
      }
      delay(250); // Space subsequent WRITE_NR commands.
    } else if (jawEyeEndPending && reached(millis(), jawEyeEndAt)) {
      jawEyeEndPending = false;
      if (lastEye != 0) sendEyeIcon(lastEye, "restored after jaw ends");
      delay(250);
    }
  }
  if (!connected) { delay(100); return; }
  if (LIGHTS_ENABLED) {
    if (lightRestorePending && reached(millis(), lightRestoreAt)) {
      lightRestorePending = false;
      queueLightSequence(millis(), 100, "after modeled MP3 end");
    }
    // Lighting is low priority. Give the next eye/body/jaw write the same
    // 250 ms separation already used for adjacent eye/motor requests.
    if (progressLights(millis())) { delay(250); return; }
  }
  if (!connected) { delay(100); return; }

  now = millis(); // Eye writes and BLE calls above may have advanced time.

  if (!routineWindowOpen()) { jawFollowupPending = false; delay(100); return; }

  // Jaw-first motor command: AAC6 plays before one selected AACA frame.
  // This is intentionally permitted through JAW_PROTECTS_ARM_TORSO for one
  // selected motor only; all ordinary scheduled arm/torso commands stay blocked
  // while the MP3 is active. One-shot mode allows one successful test
  // per BLE connection. In recurring mode, only when its random interval
  // is due; a skipped attempt can retry on the next jaw MP3.
  if (connected && jawFollowupPending && reached(millis(), jawFollowupAt)) {
    const uint32_t writesBefore = writeAttempts;
    jawFollowupPending = false;
    const uint32_t t = millis();
    const bool clipActive = !reached(t, mouthPlayingUntil);
    const bool armSelected = (jawFollowupChosenMotor == 1);
    const bool torsoSelected = (jawFollowupChosenMotor == 2);
    const bool headSelected = (jawFollowupChosenMotor == 4);
    const bool selectedEnabled = (armSelected && ARM_ENABLED) ||
                                 (torsoSelected && TORSO_ENABLED) ||
                                 (headSelected && HEAD_ENABLED);
    const bool motorReady = (armSelected && reached(t, armSafeAfter)) ||
                            (torsoSelected && reached(t, torsoSafeAfter)) ||
                            (headSelected && reached(t, headSafeAfter));
    const bool lockReady = ALLOW_BODY_MOTOR_OVERLAP ||
                           reached(t, bodySafeAfter);
    if (!clipActive) {
      logLine("JAW-FIRST: skipped; MP3 is no longer active.");
    } else if (!selectedEnabled) {
      logLine("JAW-FIRST: skipped; selected motor is OFF.");
    } else if (!motorReady || !lockReady || !reached(t, nextBodyWriteAt)) {
      logLine("JAW-FIRST: skipped; motor cooldown or body lock active.");
    } else if (headSelected) {
      // AACA head-only after AAC6, exactly like the verified jaw-first arm
      // and torso order. No independent head request is allowed to preempt
      // the one-shot trial. Physical head response FAILED at 2s and 10s.
      logLine("JAW-FIRST: sending HEAD after MP3 start (FAILED at 2s and 10s).");
      startHead(t);
      if (connected && writeAttempts != writesBefore && !JAW_FOLLOWUP_RECURRING) jawFollowupTestDone = true;
    } else if (armSelected) {
      logLine("JAW-FIRST: sending ARM after MP3 start (experimental).");
      startArm(t);
      if (connected && writeAttempts != writesBefore) {
        lastJawFollowupMotor = 1;
        if (!JAW_FOLLOWUP_RECURRING) jawFollowupTestDone = true;
      }
    } else if (torsoSelected) {
      logLine("JAW-FIRST: sending TORSO after MP3 start (experimental).");
      startTorso(t);
      if (connected && writeAttempts != writesBefore) {
        lastJawFollowupMotor = 2;
        if (!JAW_FOLLOWUP_RECURRING) jawFollowupTestDone = true;
      }
    }
  }
  if (!connected) { delay(100); return; }

  if (runtimePending()) { delay(10); return; }

  // Head and jaw may overlap only with MP3 body protection explicitly OFF.
  // With protection ON, AAC6 must not interrupt an active head/arm/torso
  // animation. Jaw-first arm/torso follow-ups remain the tested exception.
  // Physical body motors share one lock by default; independent cooldowns
  // always apply. Jaw timing targets may be delayed to preserve motor motion.
  bool sentHeadThisLoop = false;
  bool sentBodyThisLoop = false;
  bool sentMouthThisLoop = false;
  // AAC6 playback can interrupt any existing AACA body animation.
  // If a jaw clip is due or still playing, do not START standalone body
  // movement. When a head command is already running, defer AAC6 instead.
  // This prevents the old two-second follow-up from being rejected due to
  // the head's shared cooldown lock.
  const bool jawReady = mouthConfigured() &&
                        reached(now, nextMouthAt) &&
                        reached(now, mouthSafeAfter);
  const bool blockBodyForJaw =
      JAW_PROTECTS_ARM_TORSO &&
      (!reached(now, mouthPlayingUntil) || (jawReady && !giveWaitingBodyTurn(now)));
  // Select the most overdue eligible body command; independent when allowed.
  if (reached(now, nextBodyWriteAt) &&
      (ALLOW_BODY_MOTOR_OVERLAP || reached(now, bodySafeAfter))) {
    if (COMPOUND_BODY_ENABLED && reached(now, nextCompoundAt) &&
        reached(now, compoundSafeAfter) && !blockBodyForJaw &&
        reached(now, headSafeAfter) && reached(now, armSafeAfter) &&
        reached(now, torsoSafeAfter)) {
      startCompoundBody(now);
      sentBodyThisLoop = true;
    }
    uint8_t choice = 0;
    uint32_t overdue = 0;
    if (!sentBodyThisLoop && (!COMPOUND_BODY_ENABLED || COMPOUND_ALONGSIDE) && HEAD_ENABLED && reached(now, nextHeadAt) &&
        // In head-first diagnostic mode, don't let a standalone HEAD
        // preempt the one-shot trial; recurring mode always coordinates it.
        !(JAW_FOLLOWUP_MOTOR == 4 &&
          (JAW_FOLLOWUP_RECURRING || !jawFollowupTestDone)) &&
        reached(now, headSafeAfter) && !blockBodyForJaw) {
      choice = 1;
      overdue = now - nextHeadAt;
    }
    if (!sentBodyThisLoop && (!COMPOUND_BODY_ENABLED || COMPOUND_ALONGSIDE) && TORSO_ENABLED && reached(now, nextTorsoAt) &&
        !(JAW_FOLLOWUP_RECURRING && (JAW_FOLLOWUP_MOTOR == 2 ||
                                    JAW_FOLLOWUP_MOTOR == 3)) &&
        reached(now, torsoSafeAfter) && !blockBodyForJaw &&
        (choice == 0 || (uint32_t)(now - nextTorsoAt) > overdue)) {
      choice = 4;
      overdue = now - nextTorsoAt;
    }
    if (!sentBodyThisLoop && (!COMPOUND_BODY_ENABLED || COMPOUND_ALONGSIDE) && ARM_ENABLED && reached(now, nextArmAt) &&
        !(JAW_FOLLOWUP_RECURRING && (JAW_FOLLOWUP_MOTOR == 1 ||
                                    JAW_FOLLOWUP_MOTOR == 3)) &&
        reached(now, armSafeAfter) && !blockBodyForJaw &&
        (choice == 0 || (uint32_t)(now - nextArmAt) > overdue)) {
      choice = 2;
    }
    if (choice == 1) {
      startHead(now);
      sentHeadThisLoop = true;
      sentBodyThisLoop = true;
    } else if (choice == 4) {
      startTorso(now);
      sentBodyThisLoop = true;
    } else if (choice == 2) {
      startArm(now);
      sentBodyThisLoop = true;
    }
  }

  // If BLE disconnected during a write, let the next loop reconnect.
  if (!connected) {
    delay(100);
    return;
  }

  if (mouthConfigured() && reached(millis(), nextMouthAt) &&
      reached(millis(), mouthSafeAfter) &&
      !(LIGHTS_ENABLED && (lightApplyPending || lightRestorePending))) {
    // Avoid playing an MP3 while any head/torso/arm animation or safety
    // buffer is active. Previously only arm/torso were checked, so head
    // kept getting interrupted and the jaw-first follow-up was skipped.
    const uint32_t jawNow = millis();
    const bool bodyMotorsReady = reached(jawNow, headSafeAfter) &&
                                 reached(jawNow, torsoSafeAfter) &&
                                 reached(jawNow, armSafeAfter) &&
                                 (ALLOW_BODY_MOTOR_OVERLAP ||
                                  reached(jawNow, bodySafeAfter));
    if (JAW_PROTECTS_ARM_TORSO && !bodyMotorsReady) {
      if (!jawDelayNotified) {
        logLine("JAW deferred: waiting for head/arm/torso cooldown.");
        jawDelayNotified = true;
      }
    } else {
      if (sentBodyThisLoop) delay(250);
      startMouth(millis());
      sentMouthThisLoop = true;
    }
  }

  // Experimental independent eye expressions. Can overlap animations.
  // Give adjacent BLE write-without-response commands a small gap.
  if (connected && EYES_ENABLED && (lastEye == 0 || EYE_ROTATION_ENABLED) && reached(millis(), nextEyeAt) && routineWindowOpen()) {
    if (sentBodyThisLoop || sentMouthThisLoop) delay(250);
    if (routineWindowOpen()) changeEyes(millis());
  }

  serviceLightRotation(millis()); // Low priority; no new rotation during idle breaks/closed windows.
  delay(100);
}

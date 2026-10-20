#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <BLEClient.h>

// =============================================================
// ULTRA SKELLY V2: RANDOM HEAD + SILENT JAW + OPTIONAL EYES
// ESP32 Dev Module, Arduino-ESP32 3.3.12
// Optional torso and arm movements default OFF; arm command needs hardware testing.
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
// This is NOT hardware-verified: test arm+head, then torso+head, then all.
const bool ALLOW_BODY_MOTOR_OVERLAP = false;
// Opt-in coordinated body motions: send ONE tested AACA mask, not several
// competing AACA packets. This mode replaces standalone body scheduling.
// Each mask must contain only motors switched ON below.
const bool COMPOUND_BODY_ENABLED = false;
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
// 4 = HEAD after jaw (UNTESTED). Only ONE motor follows each MP3.
// Mode 3 requires recurrence in Studio. All modes are OFF by default.
// If AAC6 applies 0x00 movement flags only once at playback start, this may
// allow jaw + motor together. The reverse (AACA stops jaw) is also possible.
const uint8_t JAW_FOLLOWUP_MOTOR = 0;
const uint32_t JAW_FOLLOWUP_DELAY_MS = 2000;
// false = one successful diagnostic test per BLE connection.
// true = trigger the selected motor only when its own configured random
// frequency is due; wait for the next jaw clip, not every clip. This
// periodic coordination is NEW and needs extended hardware testing.
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
// 0: apply once after connection; 1: also restore AFTER an MP3 (conservative);
// 2: restore 3s into MP3 and again after MP3 (experimental).
const uint8_t LIGHT_RESTORE_MODE = 1;
const uint32_t LIGHT_WRITE_SPACING_MS = 300;
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
// The eye packet is documented by the web controller but has not yet
// been verified on this particular Skelly/ESP32 combination.
const bool EYES_ENABLED = false;
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

// Scan five seconds; retry thirty seconds after misses/failures
const uint32_t SCAN_SECONDS = 5;
const uint32_t SCAN_RETRY_MS = 30000;

BLEScan *scanner = nullptr;
BLEClient *client = nullptr;
BLERemoteCharacteristic *writeChar = nullptr;
BLEAdvertisedDevice *skellyDevice = nullptr;

bool found = false;
bool connected = false;
uint32_t nextScanAt = 0;
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

bool reached(uint32_t now, uint32_t when) {
  return (int32_t)(now - when) >= 0;
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
      writeChar == nullptr || length < 4 || length > 13) {
    return false;
  }
  packet[length - 1] = skellyCRC(packet, length - 1);
  writeChar->writeValue(packet, length, false); // WRITE_NR
  return client->isConnected();
}
bool sendFrame(uint8_t packet[11]) {
  return sendVariableFrame(packet, 11);
}
void queueLightSequence(uint32_t now, uint32_t delayMs) {
  if (!LIGHTS_ENABLED) return;
  lightApplyStep = 0;
  lightApplyPending = true;
  nextLightWriteAt = now + delayMs;
}
// Upstream live F2/F3/F4 layout (zero cluster, empty filename).
// We send 6 writes in order: torso F2/F3/F4, then head F2/F3/F4.
// Each write is spaced; don't assume a successful BLE write verifies LEDs.
void progressLights(uint32_t now) {
  if (!LIGHTS_ENABLED || !lightApplyPending ||
      !reached(now, nextLightWriteAt) || !reached(now, nextBodyWriteAt) ||
      (jawFollowupPending && !reached(now, jawFollowupAt))) return;
  const uint8_t channel = lightApplyStep >= 3 ? 1 : 0;
  const uint8_t stage = lightApplyStep % 3;
  const uint8_t brightness = channel ? HEAD_LIGHT_BRIGHTNESS : TORSO_LIGHT_BRIGHTNESS;
  const uint8_t r = channel ? HEAD_LIGHT_R : TORSO_LIGHT_R;
  const uint8_t g = channel ? HEAD_LIGHT_G : TORSO_LIGHT_G;
  const uint8_t b = channel ? HEAD_LIGHT_B : TORSO_LIGHT_B;
  bool ok = false;
  if (stage == 0) {
    // F2 static mode: community live-mode implementation uses 8 payload
    // bytes for torso ch0, 9 for head ch1.
    uint8_t frame[12] = {0xAA, 0xF2, channel, 0x01, 0, 0, 0, 0, 0, 0, 0, 0};
    ok = sendVariableFrame(frame, channel ? 12 : 11);
  } else if (stage == 1) {
    uint8_t frame[11] = {0xAA, 0xF3, channel, brightness, 0, 0, 0, 0, 0, 0, 0};
    ok = sendFrame(frame);
  } else {
    // F4: channel + RGB + cycle=0 + cluster=00000000 + empty filename=00
    uint8_t frame[13] = {0xAA, 0xF4, channel, r, g, b, 0, 0, 0, 0, 0, 0, 0};
    ok = sendVariableFrame(frame, 13);
  }
  if (!ok) {
    Serial.println("LIGHTS: BLE write failed; reconnecting.");
    resetConnection();
    return;
  }
  Serial.printf("LIGHTS: ch%u %s sent (visual effect unverified).\n",
                channel, stage == 0 ? "static" : stage == 1 ? "brightness" : "RGB");
  ++lightApplyStep;
  nextLightWriteAt = now + LIGHT_WRITE_SPACING_MS;
  if (lightApplyStep >= 6) lightApplyPending = false;
}
void startCompoundBody(uint32_t now) {
  const size_t maskCount = sizeof(COMPOUND_BODY_MASKS) / sizeof(COMPOUND_BODY_MASKS[0]);
  if (!maskCount) return;
  const uint8_t mask = COMPOUND_BODY_MASKS[random(maskCount)];
  const uint8_t enabled = (HEAD_ENABLED ? 1 : 0) | (ARM_ENABLED ? 2 : 0) |
                          (TORSO_ENABLED ? 4 : 0);
  if (mask < 3 || mask > 7 || (mask & ~enabled) != 0 ||
      ((mask & (mask - 1)) == 0)) {
    Serial.println("COMPOUND: invalid mask or motor disabled; skipping.");
    nextCompoundAt = now + COMPOUND_BODY_MAX_INTERVAL_MS;
    return;
  }
  uint8_t frame[11] = {0xAA, 0xCA, mask, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    Serial.println("COMPOUND: send failed.");
    resetConnection();
    return;
  }
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
  Serial.printf("COMPOUND mask 0x%02X SENT; locked %lu sec; next target %lu sec.\n",
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
    Serial.print("Found Skelly: ");
    Serial.println(advertisedDevice.getAddress().toString().c_str());
    scanner->stop(); // The connection will happen AFTER scanning returns.
  }
};

void resetConnection() {
  connected = false;
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
}

bool connectToSkelly() {
  if (!found || skellyDevice == nullptr) return false;
  if (client == nullptr) client = BLEDevice::createClient();

  Serial.println("Connecting to Skelly (scan is finished)...");
  if (!client->connect(skellyDevice)) {
    Serial.println("Connection failed.");
    resetConnection();
    return false;
  }

  BLERemoteService *service = client->getService(SERVICE_UUID);
  if (service == nullptr) {
    Serial.println("AE00 service missing.");
    resetConnection();
    return false;
  }
  writeChar = service->getCharacteristic(WRITE_UUID);
  if (writeChar == nullptr) {
    Serial.println("AE01 characteristic missing.");
    resetConnection();
    return false;
  }

  connected = true;
  const uint32_t now = millis();
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
  queueLightSequence(now, 1500);
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

  Serial.printf("CONNECTED. Head %s, jaw %s, torso %s, arm %s.\n",
    HEAD_ENABLED ? "ON" : "OFF", MOUTH_ENABLED ? "ON" : "OFF",
    TORSO_ENABLED ? "ON" : "OFF", ARM_ENABLED ? "ON" : "OFF");
  Serial.printf("Compound body mode %s; live RGB lights %s (restore mode %u).\n",
                COMPOUND_BODY_ENABLED ? "ON" : "OFF",
                LIGHTS_ENABLED ? "ON" : "OFF", (unsigned)LIGHT_RESTORE_MODE);
  Serial.printf("Body motor overlap %s. Jaw protection (head/arm/torso) %s.\n",
                ALLOW_BODY_MOTOR_OVERLAP ? "ON" : "OFF",
                JAW_PROTECTS_ARM_TORSO ? "ON" : "OFF");
  Serial.printf("Jaw-first follow-up: %s after %lu ms (%s).\n",
                JAW_FOLLOWUP_MOTOR == 1 ? "ARM" :
                JAW_FOLLOWUP_MOTOR == 2 ? "TORSO" :
                JAW_FOLLOWUP_MOTOR == 3 ? "ALTERNATING" :
                JAW_FOLLOWUP_MOTOR == 4 ? "HEAD (EXPERIMENTAL)" : "OFF",
                (unsigned long)JAW_FOLLOWUP_DELAY_MS,
                JAW_FOLLOWUP_RECURRING ? "RECURRING frequency-gated" : "ONE-SHOT");
  if (HEAD_ENABLED) {
    Serial.printf("First head in %lu seconds.\n",
                  (unsigned long)((nextHeadAt - now) / 1000));
  } else {
    Serial.println("Head motion disabled.");
  }
  if (mouthConfigured()) {
    Serial.printf("Jaw file serial %u; first attempt in ~%lu seconds.\n",
                  (unsigned)MOUTH_FILE_SERIAL,
                  (unsigned long)((nextMouthAt - now) / 1000));
  } else {
    Serial.println("Jaw OFF: set MOUTH_FILE_SERIAL after uploading the jaw MP3.");
  }
  if (EYES_ENABLED) {
    Serial.printf("First eye selection in ~%lu seconds.\n",
                  (unsigned long)((nextEyeAt - now) / 1000));
  } else {
    Serial.println("Random eyes OFF (enable after confirming eye commands).");
  }
  return true;
}

void scanAndConnect() {
  Serial.println("Scanning for Ultra Skelly v2...");
  found = false;
  if (skellyDevice != nullptr) {
    delete skellyDevice;
    skellyDevice = nullptr;
  }
  scanner->clearResults();
  scanner->start(SCAN_SECONDS, false);

  if (!found) {
    Serial.println("Not found. Retrying after 30 seconds.");
    nextScanAt = millis() + SCAN_RETRY_MS;
    return;
  }

  delay(500);
  if (!connectToSkelly()) {
    nextScanAt = millis() + SCAN_RETRY_MS;
    Serial.println("Retrying BLE connection after 30 seconds.");
  }
}

void startHead(uint32_t now) {
  // Verified head-only frame. No arm or torso movement bits.
  uint8_t frame[11] = {0xAA, 0xCA, 0x01, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    Serial.println("Head send failed / disconnected.");
    resetConnection();
    return;
  }

  headMovingUntil = now + HEAD_ANIMATION_MS;
  headSafeAfter = now + HEAD_ANIMATION_MS + HEAD_BUFFER_MS;
  bodySafeAfter = headSafeAfter;
  nextBodyWriteAt = now + BODY_WRITE_SPACING_MS;
  // Keep original start-to-start timing regardless of jaw playback.
  const uint32_t headInterval = random(HEAD_MIN_INTERVAL_MS,
                                       HEAD_MAX_INTERVAL_MS + 1);
  nextHeadAt = now + headInterval;

  const bool jawAlreadyPlaying = !reached(now, mouthPlayingUntil);
  Serial.printf("HEAD command sent; next head in %lu sec%s.\n",
                (unsigned long)(headInterval / 1000),
                jawAlreadyPlaying ? " (jaw audio may be playing too)" : "");
}

// Only called by the shared body-motor scheduler after cooldown.
void startTorso(uint32_t now) {
  uint8_t frame[11] = {0xAA, 0xCA, 0x04, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    Serial.println("Torso send failed / disconnected.");
    resetConnection();
    return;
  }
  bodySafeAfter = now + TORSO_ANIMATION_MS + TORSO_BUFFER_MS;
  torsoSafeAfter = bodySafeAfter;
  nextBodyWriteAt = now + BODY_WRITE_SPACING_MS;
  const uint32_t interval = random(TORSO_MIN_INTERVAL_MS, TORSO_MAX_INTERVAL_MS + 1);
  nextTorsoAt = now + interval;
  Serial.printf("TORSO command sent; next torso target in %lu sec.\n",
                (unsigned long)(interval / 1000));
}

void startArm(uint32_t now) {
  // Physically verified arm-only action: two back-to-back moves ~22s.
  uint8_t frame[11] = {0xAA, 0xCA, 0x02, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    Serial.println("Arm send failed / disconnected.");
    resetConnection();
    return;
  }
  bodySafeAfter = now + ARM_ANIMATION_MS + ARM_BUFFER_MS;
  armSafeAfter = bodySafeAfter;
  nextBodyWriteAt = now + BODY_WRITE_SPACING_MS;
  const uint32_t interval = random(ARM_MIN_INTERVAL_MS, ARM_MAX_INTERVAL_MS + 1);
  nextArmAt = now + interval;
  Serial.printf("ARM command sent; next arm target in %lu sec.\n",
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
  // AAC6 payload: 2-byte big-endian file serial, 01 = play,
  // remaining 5 bytes zero, CRC8 calculated automatically.
  uint8_t frame[11] = {
    0xAA, 0xC6,
    (uint8_t)(MOUTH_FILE_SERIAL >> 8),
    (uint8_t)(MOUTH_FILE_SERIAL & 0xFF),
    0x01, 0, 0, 0, 0, 0, 0
  };
  if (!sendFrame(frame)) {
    Serial.println("Jaw playback send failed / disconnected.");
    resetConnection();
    return;
  }
  jawDelayNotified = false;
  mouthPlayingUntil = now + MOUTH_CLIP_MS;
  if (LIGHTS_ENABLED && LIGHT_RESTORE_MODE != 0) {
    lightRestoreAt = mouthPlayingUntil + 500;
    lightRestorePending = true;
    if (LIGHT_RESTORE_MODE == 2) queueLightSequence(now, 3000);
  }
  // Choose one motor for this MP3, if one-shot or random-frequency-gated
  // coordination is due. New playback replaces an unserved pending event.
  jawFollowupChosenMotor = chooseJawFollowupMotor(now);
  jawFollowupPending = jawFollowupChosenMotor != 0 &&
                       (JAW_FOLLOWUP_RECURRING || !jawFollowupTestDone);
  jawFollowupAt = now + JAW_FOLLOWUP_DELAY_MS;
  if (jawFollowupPending) {
    Serial.printf("JAW-FIRST %s: scheduled %s %lu ms after MP3 start.\n",
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
  Serial.printf("JAW command sent (file #%u); next jaw in %lu sec%s.\n",
                (unsigned)MOUTH_FILE_SERIAL,
                (unsigned long)(jawInterval / 1000),
                headIsMoving ? " (OVERLAPPING head motion)" : "");
}

bool sendEyeIcon(uint8_t icon, const char *reason) {
  // Verified LIVE-eye AAF9 frame. No motor movement is commanded.
  uint8_t frame[11] = {0xAA, 0xF9, icon, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    Serial.println("Eye request failed / disconnected.");
    resetConnection();
    return false;
  }
  lastEye = icon;
  Serial.printf("EYES: icon %u (%s).\n", (unsigned)icon, reason);
  return true;
}

void changeEyes(uint32_t now) {
  uint8_t eye = (uint8_t)random(1, 19); // inclusive 1-18
  if (eye == lastEye) eye = (uint8_t)((eye % 18) + 1);
  if (!sendEyeIcon(eye, "random selection")) return;
  const uint32_t interval = random(EYE_MIN_INTERVAL_MS,
                                    EYE_MAX_INTERVAL_MS + 1);
  nextEyeAt = now + interval;
  Serial.printf("EYES: requested icon %u; next in %lu sec.\n",
                (unsigned)eye, (unsigned long)(interval / 1000));
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== ULTRA SKELLY: AUTONOMOUS HEAD/JAW/EYES + OPTIONAL TORSO/ARM ===");
  randomSeed(micros());
  BLEDevice::init("");
  scanner = BLEDevice::getScan();
  scanner->setAdvertisedDeviceCallbacks(new SkellyScanCallbacks());
  scanner->setActiveScan(true);
  nextScanAt = millis();
}

void loop() {
  const uint32_t now = millis();
  if (connected && (client == nullptr || !client->isConnected())) {
    Serial.println("Disconnected; scanning again.");
    resetConnection();
  }

  if (!connected) {
    if (reached(now, nextScanAt)) scanAndConnect();
    delay(100);
    return;
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
      queueLightSequence(millis(), 100);
    }
    progressLights(millis());
  }
  if (!connected) { delay(100); return; }

  // Jaw-first motor command: AAC6 plays before one selected AACA frame.
  // This is intentionally permitted through JAW_PROTECTS_ARM_TORSO for one
  // selected motor only; all ordinary scheduled arm/torso commands stay blocked
  // while the MP3 is active. One-shot mode allows one successful test
  // per BLE connection. In recurring mode, only when its random interval
  // is due; a skipped attempt can retry on the next jaw MP3.
  if (connected && jawFollowupPending && reached(millis(), jawFollowupAt)) {
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
      Serial.println("JAW-FIRST: skipped; MP3 is no longer active.");
    } else if (!selectedEnabled) {
      Serial.println("JAW-FIRST: skipped; selected motor is OFF.");
    } else if (!motorReady || !lockReady || !reached(t, nextBodyWriteAt)) {
      Serial.println("JAW-FIRST: skipped; motor cooldown or body lock active.");
    } else if (headSelected) {
      // AACA head-only after AAC6, exactly like the verified jaw-first arm
      // and torso order. No independent head request is allowed to preempt
      // the one-shot trial. Head/jaw physical overlap is NOT yet verified.
      Serial.println("JAW-FIRST: sending HEAD after MP3 start (UNTESTED).");
      startHead(t);
      if (connected && !JAW_FOLLOWUP_RECURRING) jawFollowupTestDone = true;
    } else if (armSelected) {
      Serial.println("JAW-FIRST: sending ARM after MP3 start (experimental).");
      startArm(t);
      if (connected) {
        lastJawFollowupMotor = 1;
        if (!JAW_FOLLOWUP_RECURRING) jawFollowupTestDone = true;
      }
    } else if (torsoSelected) {
      Serial.println("JAW-FIRST: sending TORSO after MP3 start (experimental).");
      startTorso(t);
      if (connected) {
        lastJawFollowupMotor = 2;
        if (!JAW_FOLLOWUP_RECURRING) jawFollowupTestDone = true;
      }
    }
  }
  if (!connected) { delay(100); return; }

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
      (!reached(now, mouthPlayingUntil) || jawReady);
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
    if (!COMPOUND_BODY_ENABLED && HEAD_ENABLED && reached(now, nextHeadAt) &&
        // In head-first diagnostic mode, don't let a standalone HEAD
        // preempt the one-shot trial; recurring mode always coordinates it.
        !(JAW_FOLLOWUP_MOTOR == 4 &&
          (JAW_FOLLOWUP_RECURRING || !jawFollowupTestDone)) &&
        reached(now, headSafeAfter) && !blockBodyForJaw) {
      choice = 1;
      overdue = now - nextHeadAt;
    }
    if (!COMPOUND_BODY_ENABLED && TORSO_ENABLED && reached(now, nextTorsoAt) &&
        !(JAW_FOLLOWUP_RECURRING && (JAW_FOLLOWUP_MOTOR == 2 ||
                                    JAW_FOLLOWUP_MOTOR == 3)) &&
        reached(now, torsoSafeAfter) && !blockBodyForJaw &&
        (choice == 0 || (uint32_t)(now - nextTorsoAt) > overdue)) {
      choice = 4;
      overdue = now - nextTorsoAt;
    }
    if (!COMPOUND_BODY_ENABLED && ARM_ENABLED && reached(now, nextArmAt) &&
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
      reached(millis(), mouthSafeAfter)) {
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
        Serial.println("JAW deferred: waiting for head/arm/torso cooldown.");
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
  if (connected && EYES_ENABLED && reached(millis(), nextEyeAt)) {
    if (sentBodyThisLoop || sentMouthThisLoop) delay(250);
    changeEyes(millis());
  }

  delay(100);
}

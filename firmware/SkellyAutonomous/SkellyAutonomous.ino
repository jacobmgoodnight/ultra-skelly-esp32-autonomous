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
// Arm AACA 0x02 is supported by upstream protocol, but not yet hardware-tested.
// OFF by default, including the arm in Haunted until one-shot test succeeds.
const bool TORSO_ENABLED = false;
const bool ARM_ENABLED = false;
const uint32_t TORSO_ANIMATION_MS = 25000;
const uint32_t TORSO_BUFFER_MS = 10000;
const uint32_t TORSO_MIN_INTERVAL_MS = 240000;
const uint32_t TORSO_MAX_INTERVAL_MS = 420000;
const uint32_t ARM_ANIMATION_MS = 30000; // conservative estimate, verify on hardware
const uint32_t ARM_BUFFER_MS = 15000;
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
uint32_t bodySafeAfter = 0; // Global motor cooldown, serialize head/torso/arm.
uint32_t nextTorsoAt = 0;
uint32_t nextArmAt = 0;
uint32_t nextMouthAt = 0;
uint32_t mouthSafeAfter = 0;
uint32_t mouthPlayingUntil = 0;
uint32_t nextEyeAt = 0;
uint8_t lastEye = 0; // Last successfully requested eye icon.
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

bool sendFrame(uint8_t packet[11]) {
  if (!connected || client == nullptr || !client->isConnected() ||
      writeChar == nullptr) {
    return false;
  }
  packet[10] = skellyCRC(packet, 10);
  writeChar->writeValue(packet, 11, false); // WRITE_NR
  return client->isConnected();
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
  jawEyeStartPending = false;
  jawEyeEndPending = false;
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
  nextTorsoAt = now + random(TORSO_MIN_INTERVAL_MS, TORSO_MAX_INTERVAL_MS + 1);
  nextArmAt = now + random(ARM_MIN_INTERVAL_MS, ARM_MAX_INTERVAL_MS + 1);
  mouthSafeAfter = now;
  mouthPlayingUntil = now;
  nextMouthAt = now + random(MOUTH_MIN_INTERVAL_MS, MOUTH_MAX_INTERVAL_MS + 1);
  nextEyeAt = now + random(EYE_MIN_INTERVAL_MS, EYE_MAX_INTERVAL_MS + 1);
  // Establish an eye icon promptly after connection so jaw playback can restore it.
  if (EYES_ENABLED) nextEyeAt = now + 2000;
  lastEye = 0;
  jawEyeStartPending = false;
  jawEyeEndPending = false;

  Serial.printf("CONNECTED. Head %s, jaw %s, torso %s, arm %s. Body motor overlap BLOCKED.\n",
    HEAD_ENABLED ? "ON" : "OFF", MOUTH_ENABLED ? "ON" : "OFF",
    TORSO_ENABLED ? "ON" : "OFF", ARM_ENABLED ? "ON" : "OFF");
  Serial.printf("First head in %lu seconds.\n",
                (unsigned long)((nextHeadAt - now) / 1000));
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
  const uint32_t interval = random(TORSO_MIN_INTERVAL_MS, TORSO_MAX_INTERVAL_MS + 1);
  nextTorsoAt = now + interval;
  Serial.printf("TORSO command sent; next torso target in %lu sec.\n",
                (unsigned long)(interval / 1000));
}

void startArm(uint32_t now) {
  // Command is protocol-grounded but arm-only action is NOT yet field-tested.
  uint8_t frame[11] = {0xAA, 0xCA, 0x02, 0, 0, 0, 0, 0, 0, 0, 0};
  if (!sendFrame(frame)) {
    Serial.println("Arm send failed / disconnected.");
    resetConnection();
    return;
  }
  bodySafeAfter = now + ARM_ANIMATION_MS + ARM_BUFFER_MS;
  const uint32_t interval = random(ARM_MIN_INTERVAL_MS, ARM_MAX_INTERVAL_MS + 1);
  nextArmAt = now + interval;
  Serial.printf("ARM command sent (EXPERIMENTAL); next arm target in %lu sec.\n",
                (unsigned long)(interval / 1000));
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
  mouthPlayingUntil = now + MOUTH_CLIP_MS;
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

  // Independently timed head and jaw: they MAY overlap.
  // Shared motor lock preserves minimum cool-down across all body parts.
  // Head target may be delayed when torso or arm movement is enabled.
  // The 45 sec jaw minimum prevents replay before the 20s clip finishes.
  bool sentHeadThisLoop = false;
  bool sentBodyThisLoop = false;
  bool sentMouthThisLoop = false;
  // Only ONE physical body motor command may be active at a time.
  // Prioritize the most overdue scheduled movement to avoid starving torso/arm.
  // Jaw audio and digital eyes remain independently scheduled.
  if (reached(now, bodySafeAfter)) {
    uint8_t choice = 0;
    uint32_t overdue = 0;
    if (HEAD_ENABLED && reached(now, nextHeadAt)) {
      choice = 1;
      overdue = now - nextHeadAt;
    }
    if (TORSO_ENABLED && reached(now, nextTorsoAt) &&
        (choice == 0 || (uint32_t)(now - nextTorsoAt) > overdue)) {
      choice = 4;
      overdue = now - nextTorsoAt;
    }
    if (ARM_ENABLED && reached(now, nextArmAt) &&
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
    // If both commands become due together, space BLE writes a little.
    // A mouth clip can still run while the head is moving.
    if (sentBodyThisLoop) delay(250);
    startMouth(millis());
    sentMouthThisLoop = true;
  }

  // Experimental independent eye expressions. Can overlap animations.
  // Give adjacent BLE write-without-response commands a small gap.
  if (connected && EYES_ENABLED && reached(millis(), nextEyeAt)) {
    if (sentBodyThisLoop || sentMouthThisLoop) delay(250);
    changeEyes(millis());
  }

  delay(100);
}

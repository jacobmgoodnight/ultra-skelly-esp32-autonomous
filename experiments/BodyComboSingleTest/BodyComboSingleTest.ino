#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <BLEClient.h>

// ONE-SHOT COMPOUND BODY MOTOR TEST: EXPERIMENTAL. No jaw MP3 or eye commands.
// CA payload accepts a movement BITFIELD in community SkellyUltraWebController.
// Individually verified on this prop: 0x01 HEAD, 0x02 ARM, 0x04 TORSO.
// Physically verified on this prop: 0x03 HEAD+ARM, 0x05 HEAD+TORSO,
// 0x06 ARM+TORSO, and 0x07 ALL THREE. Each was sent as a single AACA frame.
// Physical movement was observed; individual cycle durations were not timed.
// Run supervised, with stable prop and joints clear.
// Unlike sending multiple AACA commands, this sends ONE bitmask command.
// Only change TEST_MOVEMENT_MASK deliberately, then re-upload/reboot.
const uint8_t TEST_MOVEMENT_MASK = 0x03;

#define SKELLY_NAME "Ultra Skelly v2"
#define SERVICE_UUID "0000ae00-0000-1000-8000-00805f9b34fb"
#define WRITE_UUID   "0000ae01-0000-1000-8000-00805f9b34fb"

BLEScan* scanner = nullptr;
BLEAdvertisedDevice* foundDevice = nullptr;
BLEClient* client = nullptr;

uint8_t crc8Skelly(const uint8_t* b, size_t n) {
  uint8_t crc = 0;
  for (size_t i = 0; i < n; ++i) {
    uint8_t x = crc ^ b[i];
    for (uint8_t j = 0; j < 8; ++j)
      x = (x & 1) ? ((x >> 1) ^ 0x8C) : (x >> 1);
    crc = x;
  }
  return crc;
}

class ScanCB : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice device) {
    if (foundDevice || !device.haveName()) return;
    if (String(device.getName().c_str()) != SKELLY_NAME) return;
    foundDevice = new BLEAdvertisedDevice(device);
    Serial.print("Found Skelly: ");
    Serial.println(device.getAddress().toString().c_str());
    scanner->stop(); // Connection must happen after scan returns.
  }
};

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\nUltra Skelly v2 - ONE-SHOT COMBINED body movement test");
  BLEDevice::init("");
  scanner = BLEDevice::getScan();
  scanner->setAdvertisedDeviceCallbacks(new ScanCB());
  scanner->setActiveScan(true);
  // Retry BLE advertisement *and* failed connections. Earlier tests showed
  // scanning can find Skelly but the subsequent connection still fail.
  // Each attempt uses a NEW BLE client and freshly discovered advertisement;
  // neither a scan retry nor a connect retry may send any motor packet.
  const uint8_t MAX_CONNECT_ATTEMPTS = 4;
  const uint8_t MAX_SCAN_ATTEMPTS = 8;
  const uint32_t RETRY_DELAY_MS = 10000;
  bool established = false;
  for (uint8_t connectionAttempt = 1;
       connectionAttempt <= MAX_CONNECT_ATTEMPTS && !established;
       ++connectionAttempt) {
    if (foundDevice) {
      delete foundDevice;
      foundDevice = nullptr;
    }
    scanner->clearResults();
    for (uint8_t scanAttempt = 1;
         scanAttempt <= MAX_SCAN_ATTEMPTS && !foundDevice;
         ++scanAttempt) {
      Serial.printf("Scanning 5 seconds... attempt %u/%u (connection %u/%u)\n",
                    scanAttempt, MAX_SCAN_ATTEMPTS,
                    connectionAttempt, MAX_CONNECT_ATTEMPTS);
      scanner->start(5, false); // Blocking: connect AFTER scan returns.
      Serial.println("Scan finished.");
      if (!foundDevice && scanAttempt < MAX_SCAN_ATTEMPTS) {
        scanner->clearResults();
        Serial.println("Skelly not found; retrying scan in 10 seconds.");
        delay(RETRY_DELAY_MS);
      }
    }

    if (!foundDevice) {
      Serial.println("Skelly not found after 8 scans.");
      break; // No connection possible without an advertisement.
    }

    delay(500); // Allow BLE scanning/advertising to settle.
    BLEClient* candidate = BLEDevice::createClient();
    Serial.printf("Connecting AFTER scan... attempt %u/%u\n",
                  connectionAttempt, MAX_CONNECT_ATTEMPTS);
    if (candidate && candidate->connect(foundDevice)) {
      client = candidate;
      established = true;
    } else {
      Serial.println("Connection failed; will rescan and retry automatically.");
      if (candidate) {
        if (candidate->isConnected()) candidate->disconnect();
        delete candidate;
      }
      // Never retain stale advertised-device data across a failed connection.
      delete foundDevice;
      foundDevice = nullptr;
      scanner->clearResults();
      if (connectionAttempt < MAX_CONNECT_ATTEMPTS) {
        Serial.println("Next connection attempt in 10 seconds.");
        delay(RETRY_DELAY_MS);
      }
    }
  }

  if (!established) {
    Serial.println("Could not connect. Close other BLE apps, check Skelly power, then reset ESP32.");
    return; // No motor command was sent.
  }
  Serial.println("CONNECTED");
  BLERemoteService* service = client->getService(SERVICE_UUID);
  if (!service) {
    Serial.println("AE00 service not found");
    client->disconnect();
    return;
  }
  BLERemoteCharacteristic* writer = service->getCharacteristic(WRITE_UUID);
  if (!writer) {
    Serial.println("AE01 write characteristic not found");
    client->disconnect();
    return;
  }

  // Only allow explicit TWO- or THREE-motor test masks.
  if (TEST_MOVEMENT_MASK != 0x03 &&
      TEST_MOVEMENT_MASK != 0x05 &&
      TEST_MOVEMENT_MASK != 0x06 &&
      TEST_MOVEMENT_MASK != 0x07) {
    Serial.println("Invalid TEST_MOVEMENT_MASK. Use 0x03 / 0x05 / 0x06 / 0x07.");
    client->disconnect();
    return;
  }
  // AA CA [mask] 00 00 00 00 00 00 00 [CRC8].
  // Head=bit0, Arm=bit1, Torso=bit2. CRC computed below.
  uint8_t frame[11] = {0xAA, 0xCA, TEST_MOVEMENT_MASK, 0, 0, 0, 0, 0, 0, 0, 0};
  frame[10] = crc8Skelly(frame, 10);
  Serial.printf("Requested motors: HEAD=%s ARM=%s TORSO=%s\n",
                (TEST_MOVEMENT_MASK & 0x01) ? "YES" : "NO",
                (TEST_MOVEMENT_MASK & 0x02) ? "YES" : "NO",
                (TEST_MOVEMENT_MASK & 0x04) ? "YES" : "NO");
  Serial.printf("Sending ONE compound body command, mask 0x%02X: ", TEST_MOVEMENT_MASK);
  for (size_t i = 0; i < sizeof(frame); ++i) {
    if (frame[i] < 16) Serial.print("0");
    Serial.print(frame[i], HEX);
    Serial.print(' ');
  }
  Serial.println();
  delay(1500);
  writer->writeValue(frame, sizeof(frame), false);
  Serial.println("Compound movement request SENT ONCE (not motor-confirmed).");
  Serial.println("Observe which selected joints physically move, then time completion.");
  Serial.println("No further motor commands will be sent until the ESP32 resets.");

}

void loop() { delay(1000); }

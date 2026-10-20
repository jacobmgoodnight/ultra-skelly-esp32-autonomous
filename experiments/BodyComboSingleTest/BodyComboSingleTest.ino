#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <BLEClient.h>

// ONE-SHOT COMPOUND BODY MOTOR TEST: EXPERIMENTAL. No jaw MP3 or eye commands.
// CA payload accepts a movement BITFIELD in community SkellyUltraWebController.
// Individually verified on this prop: 0x01 HEAD, 0x02 ARM, 0x04 TORSO.
// Physically verified: 0x03 HEAD+ARM BOTH MOVED together on original Skelly.
// Not yet tested: 0x05 HEAD+TORSO, 0x06 ARM+TORSO, 0x07 all three.
// Run supervised, with stable prop and joints clear.
// 0x05 = next suggested test, once 0x03 has been observed.
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
  // The original one-shot sketch forced a manual reset after every 5-second
  // scan miss. The physical 0x03 test needed FOUR resets before discovery.
  // Retry discovery without ever repeating the motor command.
  const uint8_t MAX_SCAN_ATTEMPTS = 8;
  const uint32_t SCAN_RETRY_DELAY_MS = 10000;
  for (uint8_t attempt = 1; attempt <= MAX_SCAN_ATTEMPTS && !foundDevice;
       ++attempt) {
    Serial.printf("Scanning 5 seconds... attempt %u/%u\n",
                  attempt, MAX_SCAN_ATTEMPTS);
    scanner->start(5, false); // Synchronous: connection AFTER scan returns.
    Serial.println("Scan finished.");
    if (!foundDevice && attempt < MAX_SCAN_ATTEMPTS) {
      scanner->clearResults();
      Serial.println("Skelly not found; retrying scan in 10 seconds.");
      delay(SCAN_RETRY_DELAY_MS);
    }
  }

  if (!foundDevice) {
    Serial.println("Skelly not found after 8 scans. Check power and BLE apps; reset ESP32 to retry.");
    return;
  }

  delay(500);
  client = BLEDevice::createClient();
  Serial.println("Connecting AFTER scan...");
  if (!client->connect(foundDevice)) {
    Serial.println("Connection failed. Close phone/web app and reset ESP32.");
    return;
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

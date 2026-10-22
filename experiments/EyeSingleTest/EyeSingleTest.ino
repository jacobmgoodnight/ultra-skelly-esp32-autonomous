#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <BLEClient.h>

// ONE-SHOT LIVE EYE TEST (not yet verified on user's hardware).
// Head, arm, torso, and audio commands are NEVER sent.
// Select 1..18. Re-upload or use the web controller to choose another.
const uint8_t TEST_EYE_ICON = 2;

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
    Serial.println("Found Skelly by advertised name.");
    scanner->stop(); // Connection must happen after scan returns.
  }
};

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\nUltra Skelly v2 - SINGLE eye-change test");
  if (TEST_EYE_ICON < 1 || TEST_EYE_ICON > 18) {
    Serial.println("Invalid TEST_EYE_ICON (expected 1..18)");
    return;
  }

  BLEDevice::init("");
  scanner = BLEDevice::getScan();
  scanner->setAdvertisedDeviceCallbacks(new ScanCB());
  scanner->setActiveScan(true);
  Serial.println("Scanning 5 seconds...");
  scanner->start(5, false);
  Serial.println("Scan finished.");

  if (!foundDevice) {
    Serial.println("Skelly not found; power on and reset ESP32 to retry.");
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

  // Based on the web controller's LIVE eye command (not file edit):
  // AA F9 [icon] 00 [4-byte zero cluster] 00 [1 byte padding] [CRC]
  uint8_t frame[11] = {0xAA, 0xF9, TEST_EYE_ICON, 0, 0, 0, 0, 0, 0, 0, 0};
  frame[10] = crc8Skelly(frame, 10);
  Serial.print("Sending ONE eye command: ");
  for (size_t i = 0; i < sizeof(frame); ++i) {
    if (frame[i] < 16) Serial.print("0");
    Serial.print(frame[i], HEX);
    Serial.print(' ');
  }
  Serial.println();
  delay(1500);
  writer->writeValue(frame, sizeof(frame), false);
  Serial.printf("Requested eye icon %u. No more commands will be sent.\n",
                (unsigned)TEST_EYE_ICON);
}

void loop() { delay(1000); }

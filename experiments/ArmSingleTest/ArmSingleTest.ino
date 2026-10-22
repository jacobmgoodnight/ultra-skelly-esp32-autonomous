#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <BLEClient.h>

// ONE-SHOT ARM-ONLY TEST: movement bit 0x02 is supported in upstream protocol.
// Experimental on this Skelly. Clear moving parts and stand back.
// No head, torso, jaw or eye command is sent. Run once per reset.

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
  Serial.println("\nUltra Skelly v2 - ONE-SHOT ARM movement test");
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

  // AA CA 02 00 00 00 00 00 00 00 [CRC8] = ARM ONLY.
  uint8_t frame[11] = {0xAA, 0xCA, 0x02, 0, 0, 0, 0, 0, 0, 0, 0};
  frame[10] = crc8Skelly(frame, 10);
  Serial.print("Sending ONE arm command: ");
  for (size_t i = 0; i < sizeof(frame); ++i) {
    if (frame[i] < 16) Serial.print("0");
    Serial.print(frame[i], HEX);
    Serial.print(' ');
  }
  Serial.println();
  delay(1500);
  writer->writeValue(frame, sizeof(frame), false);
  Serial.println("ARM request sent once. Observe movement and report duration.");

}

void loop() { delay(1000); }

#pragma once
#include "Arduino.h"
inline std::vector<std::vector<uint8_t>> fakeWrites;
inline bool fakeWriteOK = true;
inline uint32_t fakeWriteLatency = 0;
class BLEAdvertisedDevice {
 public:
  bool haveName() { return true; }
  String getName() { return "Ultra Skelly v2"; }
  BLEAdvertisedDevice getAddress() { return {}; }
  String toString() { return "test address"; }
};
class BLEAdvertisedDeviceCallbacks {
 public: virtual void onResult(BLEAdvertisedDevice) {}
};
class BLERemoteCharacteristic {
 public:
  bool writeValue(uint8_t *data, size_t length, bool response) {
    if (response) throw std::runtime_error("WRITE_NR required");
    fakeWrites.emplace_back(data, data + length);
    fakeNow += fakeWriteLatency;
    return fakeWriteOK;
  }
};
class BLERemoteService {
 public:
  BLERemoteCharacteristic *getCharacteristic(const char *) {
    static BLERemoteCharacteristic value; return &value;
  }
};
class BLEClient {
 public:
  bool active = true;
  bool isConnected() { return active; }
  bool connect(BLEAdvertisedDevice *) { active = true; return true; }
  void disconnect() { active = false; }
  BLERemoteService *getService(const char *) { static BLERemoteService value; return &value; }
};
class BLEScan {
 public:
  void stop() {}
  void clearResults() {}
  void start(uint32_t, bool) {}
  void setAdvertisedDeviceCallbacks(BLEAdvertisedDeviceCallbacks *) {}
  void setActiveScan(bool) {}
};
class BLEDevice {
 public:
  static void init(const char *) {}
  static BLEScan *getScan() { static BLEScan scan; return &scan; }
  static BLEClient *createClient() { static BLEClient value; return &value; }
};

#pragma once
#include "Arduino.h"
#include <map>
inline std::vector<std::vector<uint8_t>> fakeWrites;
inline std::vector<uint32_t> fakeWriteTimes;
inline bool fakeWriteOK = true;
inline uint32_t fakeWriteLatency = 0;
inline bool fakeConnectOK = true;
inline bool fakeDiscoveryOK = true;
inline bool fakeServicePresent = true;
inline bool fakeCharacteristicPresent = true;
inline bool fakeDisconnectOnDiscovery = false;
inline unsigned fakeDiscoveryCount = 0;
inline bool fakeScanFindsDevice = false;
inline bool fakeScanInProgress = false;
inline uint32_t fakeScanDuration = 0;
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
  bool canNotify() { return true; }
  void registerForNotify(void (*)(BLERemoteCharacteristic *, uint8_t *, size_t, bool)) {}
  bool writeValue(uint8_t *data, size_t length, bool response) {
    if (response) throw std::runtime_error("WRITE_NR required");
    fakeWrites.emplace_back(data, data + length);
    fakeNow += fakeWriteLatency;
    fakeWriteTimes.push_back(fakeNow);
    return fakeWriteOK;
  }
};
class BLERemoteService {
 public:
  BLERemoteCharacteristic *getCharacteristic(const char *) {
    static BLERemoteCharacteristic value;
    return fakeCharacteristicPresent ? &value : nullptr;
  }
};
class BLEClient {
 public:
  bool active = true;
  bool isConnected() { return active; }
  bool connect(BLEAdvertisedDevice *) {
    if (fakeScanInProgress) throw std::runtime_error("Must finish scanning before connecting");
    active = fakeConnectOK; return active;
  }
  void disconnect() { active = false; }
  std::map<std::string, BLERemoteService *> services;
  BLERemoteService discoveredService;
  std::map<std::string, BLERemoteService *> *getServices() {
    ++fakeDiscoveryCount;
    services.clear();
    if (fakeDisconnectOnDiscovery) active = false;
    if (fakeDiscoveryOK && active)
      services[fakeServicePresent ? "ae00" : "other"] = &discoveredService;
    return &services;
  }
  BLERemoteService *getService(const char *) {
    const auto found = services.find("ae00");
    return found == services.end() ? nullptr : found->second;
  }
};
class BLEScan {
 public:
  BLEAdvertisedDeviceCallbacks *callbacks = nullptr;
  void stop() {}
  void clearResults() {}
  void start(uint32_t, bool) {
    fakeScanInProgress=true;fakeNow+=fakeScanDuration;
    if(fakeScanFindsDevice && callbacks) callbacks->onResult(BLEAdvertisedDevice{});
    fakeScanInProgress=false;
  }
  void setAdvertisedDeviceCallbacks(BLEAdvertisedDeviceCallbacks *value) { callbacks=value; }
  void setActiveScan(bool) {}
};
class BLEDevice {
 public:
  static void init(const char *) {}
  static BLEScan *getScan() { static BLEScan scan; return &scan; }
  static BLEClient *createClient() { static BLEClient value; return &value; }
};

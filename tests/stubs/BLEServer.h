#pragma once
#include "BLEDevice.h"
class BLECharacteristic;
inline const uint16_t ESP_GATT_PERM_READ=1;
class BLECharacteristicCallbacks {
 public: virtual void onRead(BLECharacteristic *) {}
};
class BLECharacteristic {
 public:
  static const unsigned PROPERTY_READ=2;
  unsigned properties=0;
  uint16_t permissions=0xffff;
  BLECharacteristicCallbacks *callbacks=nullptr;
  std::string value;
  void setCallbacks(BLECharacteristicCallbacks *cb){callbacks=cb;}
  void setAccessPermissions(uint16_t value){permissions=value;}
  void setValue(const char *text){value=text;}
};
inline BLECharacteristic fakeServerCharacteristic;
inline unsigned fakeServerPhoneCount=0;
class BLEService {
 public:
  BLECharacteristic *createCharacteristic(const char *,unsigned properties){fakeServerCharacteristic.properties=properties;return &fakeServerCharacteristic;}
  void start(){}
  const char *getUUID(){return "test-service";}
};
class BLEServer;
class BLEServerCallbacks {
 public: virtual void onDisconnect(BLEServer *) {}
};
class BLEServer {
 public:
  BLEServerCallbacks *callbacks=nullptr;
  void setCallbacks(BLEServerCallbacks *cb){callbacks=cb;}
  unsigned getConnectedCount(){return fakeServerPhoneCount;}
  BLEService *createService(const char *){static BLEService s;return &s;}
};
inline BLEServer *BLEDevice::createServer(){static BLEServer s;return &s;}

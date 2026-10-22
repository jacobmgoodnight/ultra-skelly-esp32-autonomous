#include <iostream>
#define REQUIRE(c) do { if (!(c)) throw std::runtime_error(#c); } while (false)
void readyRefresh(uint32_t at) {
  fakeNow=at;fakeWriteLatency=0;fakeWriteOK=true;fakeRandomChoices.clear();
  fakeConnectOK=fakeDiscoveryOK=fakeServicePresent=fakeCharacteristicPresent=true;
  fakeDisconnectOnDiscovery=false;
  scanner=BLEDevice::getScan();
  static BLEAdvertisedDevice device;skellyDevice=&device;found=true;
  REQUIRE(connectToSkelly());fakeWrites.clear();
}
int main() {
  try {
    for(uint32_t at : {1000u, UINT32_MAX-1000u}) {
      readyRefresh(at);
      startupScanStartedAt=at;startupScanActive=true;
      REQUIRE(scanRetryDelay(at)==5000);
      REQUIRE(scanRetryDelay(at+59999)==5000);
      REQUIRE(scanRetryPause(at,at+5000)==0);
      REQUIRE(scanRetryPause(at,at+2000)==3000);
      REQUIRE(scanRetryDelay(at+60000)==30000);
      REQUIRE(!startupScanActive);
      REQUIRE(scanRetryDelay(at+120000)==30000);
      // A full wrap must not reactivate the startup burst.
      REQUIRE(scanRetryDelay(at+1)==30000);
      startupScanActive=true;startupScanStartedAt=at;
      skellyDevice=nullptr;fakeNow=at;scanAndConnect();
      REQUIRE(nextScanAt-fakeNow==5000);
      fakeNow=at+60000;scanAndConnect();REQUIRE(nextScanAt-fakeNow==30000);
      // Exercise a scan hit plus failed connection, then successful discovery.
      scanner->setAdvertisedDeviceCallbacks(new SkellyScanCallbacks());
      startupScanStartedAt=at;startupScanActive=true;
      fakeNow=at;fakeScanFindsDevice=true;fakeScanDuration=5000;fakeConnectOK=false;
      scanAndConnect();REQUIRE(nextScanAt==fakeNow);REQUIRE(startupScanActive);
      fakeConnectOK=true;scanAndConnect();REQUIRE(connected && !startupScanActive);
      REQUIRE(scanRetryDelay(fakeNow)==30000);
      delete skellyDevice;skellyDevice=nullptr;
      fakeScanFindsDevice=false;fakeScanDuration=0;

      readyRefresh(at);
      nextHeadAt=nextArmAt=nextTorsoAt=nextCompoundAt=at;
      fakeRandomChoices.push_back(3); // all three motors, one packet
      loop();REQUIRE(fakeWrites.size()==1);REQUIRE(fakeWrites[0][2]==7);
      const uint32_t safe=bodySafeAfter;
      REQUIRE(safe-at==35000);
      nextHeadAt=nextArmAt=nextTorsoAt=at; // overdue singles must wait
      fakeWrites.clear();fakeNow=safe-1;loop();REQUIRE(fakeWrites.empty());
      fakeNow=safe;loop();REQUIRE(fakeWrites.size()==1);
      REQUIRE(fakeWrites[0][2]==1); // individual requests resume after combo
      fakeWrites.clear();fakeNow=bodySafeAfter-1;loop();REQUIRE(fakeWrites.empty());
      // Due combo waits for the current single to finish, then takes priority.
      nextCompoundAt=bodySafeAfter;fakeNow=bodySafeAfter;
      fakeRandomChoices.push_back(0);loop();
      REQUIRE(fakeWrites.size()==1 && fakeWrites[0][2]==3);
    }
    std::cout << "PASS startup retry expiry/wrap and combined priority, full locks and standalone resume\n";
  } catch(const std::exception &e) { std::cerr << "FAIL " << e.what() << '\n'; return 1; }
}

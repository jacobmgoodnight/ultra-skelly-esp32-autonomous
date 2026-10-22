#include <iostream>
#define REQUIRE(c) do { if (!(c)) throw std::runtime_error(#c); } while (false)
void ready(uint32_t at) {
  fakeNow=at; fakeWriteLatency=0; fakeWriteOK=true; fakeRandomChoices.clear();
  fakeConnectOK=fakeDiscoveryOK=fakeServicePresent=fakeCharacteristicPresent=true;
  fakeDisconnectOnDiscovery=false;
  static BLEAdvertisedDevice device; skellyDevice=&device; found=true;
  REQUIRE(connectToSkelly()); fakeWrites.clear();
}
int main() {
  try {
    const uint8_t masks[]={3,5,6,7};
    for (uint32_t at : {1000u, UINT32_MAX-1000u}) {
      for (int choice=0; choice<4; ++choice) {
        ready(at); fakeWriteLatency=5000; fakeRandomChoices.push_back(choice);
        startCompoundBody(fakeNow); fakeWriteLatency=0;
        REQUIRE(fakeWrites.size()==1 && fakeWrites[0][1]==0xca);
        REQUIRE(fakeWrites[0][2]==masks[choice]);
        REQUIRE(skellyCRC(fakeWrites[0].data(),10)==fakeWrites[0].back());
        const uint32_t duration=(masks[choice]&4) ? 35000 : 32000;
        REQUIRE(bodySafeAfter-fakeNow==duration);
        REQUIRE(compoundSafeAfter==bodySafeAfter);
        if (masks[choice]&1) REQUIRE(headSafeAfter-fakeNow==32000);
        if (masks[choice]&2) REQUIRE(armSafeAfter-fakeNow==32000);
        if (masks[choice]&4) REQUIRE(torsoSafeAfter-fakeNow==35000);
        REQUIRE(nextBodyWriteAt-fakeNow==BODY_WRITE_SPACING_MS);
        nextMouthAt=fakeNow; mouthSafeAfter=fakeNow;
        const uint32_t safe=bodySafeAfter;
        fakeWrites.clear(); fakeNow=safe-1; loop(); REQUIRE(fakeWrites.empty());
        fakeNow=safe; loop();
        REQUIRE(fakeWrites.size()==1 && fakeWrites[0][1]==0xc6);
      }
    }
    std::cout << "PASS every compound mask, longest full cooldown, MP3 protection and wrap\n";
    ready(1000); fakeWriteOK=false; startCompoundBody(fakeNow);
    REQUIRE(!connected && writeChar==nullptr && !jawFollowupPending);
    REQUIRE(!lightApplyPending && !lightRestorePending);
    std::cout << "PASS failed compound write cancels connection work\n";
#ifdef TEST_JAW_POOL
    for (int choice=0; choice<3; ++choice) {
      ready(1000); fakeRandomChoices.push_back(choice); startMouth(fakeNow);
      REQUIRE(fakeWrites.size()==1 && fakeWrites[0][1]==0xc6);
      const uint16_t file=(uint16_t(fakeWrites[0][2])<<8)|fakeWrites[0][3];
      REQUIRE(file==12+choice);
    }
    std::cout << "PASS all three configured jaw pool selections execute\n";
#endif
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "FAIL scheduler: " << error.what() << '\n'; return 1;
  }
}

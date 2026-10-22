#include <iostream>
#define REQUIRE(c) do { if (!(c)) throw std::runtime_error(#c); } while (false)
void drainLights() {
  for (int i=0;i<50 && lightApplyPending;++i) { fakeNow+=300; progressLights(fakeNow); }
  REQUIRE(!lightApplyPending);
}
void checkSequence(int palette) {
  const size_t expected=6+(TORSO_LIGHT_MODE!=1)+(HEAD_LIGHT_MODE!=1);
  REQUIRE(fakeWrites.size()==expected);
  size_t index=0;
  for (uint8_t channel=0;channel<2;++channel) {
    const uint8_t mode=channel?HEAD_LIGHT_MODE:TORSO_LIGHT_MODE;
    const auto &f2=fakeWrites[index++];
    REQUIRE(f2[1]==0xf2 && f2[2]==channel && f2[3]==mode);
    REQUIRE(f2.size()==(channel?12:11));
    if(mode!=1) {
      const auto &f6=fakeWrites[index++];
      REQUIRE(f6.size()==11 && f6[1]==0xf6 && f6[2]==channel);
      REQUIRE(f6[3]==(channel?0:254)); // Upstream 254-UI conversion.
    }
    REQUIRE(fakeWrites[index][1]==0xf3);++index;
    const auto &rgb=fakeWrites[index++];REQUIRE(rgb.size()==13 && rgb[1]==0xf4);
    for(uint8_t i=0;i<3;++i) REQUIRE(rgb[3+i]==LIGHT_PALETTES[palette][channel*3+i]);
  }
  for(size_t i=0;i<fakeWrites.size();++i) {
    const auto &f=fakeWrites[i];REQUIRE(skellyCRC(f.data(),f.size()-1)==f.back());
    if(i) REQUIRE(uint32_t(fakeWriteTimes[i]-fakeWriteTimes[i-1])>=LIGHT_WRITE_SPACING_MS);
  }
}
int main() {
  try {
    setup();skellyDevice=new BLEAdvertisedDevice();found=true;REQUIRE(connectToSkelly());
    fakeWrites.clear();fakeWriteTimes.clear();
    REQUIRE(!lightApplyPending);nextLightRotationAt=fakeNow;serviceLightRotation(fakeNow);REQUIRE(!lightApplyPending);
    acceptUsbCommand("SKELLY TIME 1704067200");loop();REQUIRE(lightApplyPending);drainLights();checkSequence(0);
    const uint32_t rotationDue=nextLightRotationAt;
    restUntil=fakeNow+30000;nextRestAt=restUntil+600000;nextLightRotationAt=fakeNow;
    loop();REQUIRE(!lightApplyPending);restUntil=fakeNow;nextLightRotationAt=rotationDue;
    fakeWrites.clear();fakeWriteTimes.clear();
    fakeNow=nextLightRotationAt-1;serviceLightRotation(fakeNow);REQUIRE(!lightApplyPending);
    ++fakeNow;serviceLightRotation(fakeNow);REQUIRE(lightApplyPending && activeLightPalette==2);
    drainLights();checkSequence(2);
    if(MOUTH_ENABLED) {
      startMouth(fakeNow);REQUIRE(mouthEndPending && lightRestorePending);
      fakeWrites.clear();fakeWriteTimes.clear();
      fakeNow=mouthPlayingUntil+LIGHT_RESTORE_GRACE_MS+100;loop();
      REQUIRE(lightApplyPending && activeLightPalette==2);drainLights();checkSequence(2);
    }
    fakeWrites.clear();fakeWriteTimes.clear();fakeNow=nextLightRotationAt;
    nextMouthAt=fakeNow+600000;
    mouthEndPending=true;serviceLightRotation(fakeNow);REQUIRE(!lightApplyPending);mouthEndPending=false;
    jawFollowupPending=true;serviceLightRotation(fakeNow);REQUIRE(!lightApplyPending);jawFollowupPending=false;
    lightRestorePending=true;serviceLightRotation(fakeNow);REQUIRE(!lightApplyPending);lightRestorePending=false;
    // Midnight/end-exclusive guard and unknown time cannot start rotations.
    acceptUsbCommand("SKELLY TIME 1704153540");serviceLightRotation(fakeNow);REQUIRE(!lightApplyPending);
    clockValid=false;serviceLightRotation(fakeNow);REQUIRE(!lightApplyPending);
    acceptUsbCommand("SKELLY TIME 1704067200");
    // Unsigned uptime wrap keeps the full rotation interval.
    fakeNow=UINT32_MAX-5000;clockLastTick=fakeNow;nextLightRotationAt=fakeNow+15000;
    nextBodyWriteAt=fakeNow;haveBleWrite=false; // Fresh spacing baseline near wrap.
    fakeNow+=14999;serviceLightRotation(fakeNow);REQUIRE(!lightApplyPending);
    ++fakeNow;serviceLightRotation(fakeNow);REQUIRE(lightApplyPending && activeLightPalette==0);
    // Mid-sequence disconnect/failure discards work and reconnect starts fresh.
    fakeNow+=100;fakeWriteOK=false;progressLights(fakeNow);REQUIRE(!connected && !lightApplyPending && activeLightPalette==-1);
    fakeWriteOK=true;found=true;REQUIRE(connectToSkelly());REQUIRE(activeLightPalette==0 && !lightApplyPending);
    REQUIRE(nextLightRotationAt==fakeNow+15000);
    std::cout<<"PASS rotation selection, full spaced effect packets/CRC, clock gating, jaw/restore deferral, wrap and reconnect\n";
    return 0;
  }catch(const std::exception &e){std::cerr<<"FAIL lighting: "<<e.what()<<'\n';return 1;}
}

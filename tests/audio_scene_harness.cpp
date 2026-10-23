#include <iostream>
#define REQUIRE(c) do { if (!(c)) throw std::runtime_error(#c); } while (false)
void audioReady(uint32_t at) {
  fakeNow=at;audioHoldPending=false;fakeWriteLatency=0;fakeWriteOK=true;fakeConnectOK=fakeDiscoveryOK=fakeServicePresent=fakeCharacteristicPresent=true;fakeDisconnectOnDiscovery=false;
#if SKELLY_RUNTIME
  fakeNVS.clear();runtimeBoot();REQUIRE(RuntimeEngine::valid(runtimeEngine.active));
  RuntimeRecord bad=runtimeEngine.active;bad.words[3+RF_overlap]=1;bad.crc=RuntimeEngine::checksum(bad);REQUIRE(!RuntimeEngine::valid(bad));
  bad=runtimeEngine.active;bad.words[3+RF_eyeJawMode]=1;bad.crc=RuntimeEngine::checksum(bad);REQUIRE(RuntimeEngine::valid(bad));
#endif
  delete skellyDevice;skellyDevice=new BLEAdvertisedDevice();found=true;REQUIRE(connectToSkelly());fakeWrites.clear();
  lightApplyPending=lightRestorePending=false;lastEye=4;nextEyeAt=at+15000;
}
int main(){try{
  for(uint32_t at:{1000u,UINT32_MAX-20000u}){
    audioReady(at);fakeWriteLatency=5000;startMouth(fakeNow);fakeWriteLatency=0;
    REQUIRE(fakeWrites.size()==1&&fakeWrites[0][1]==0xc6&&fakeWrites[0][3]==27);
    const uint32_t start=fakeNow,end=mouthPlayingUntil;REQUIRE(end-start==65000);
    REQUIRE(audioHoldPending&&audioHoldUntil==end);REQUIRE(!jawEyeStartPending&&!jawFollowupPending&&jawEyeEndPending);
    REQUIRE(headSafeAfter==end&&armSafeAfter==end&&torsoSafeAfter==end&&bodySafeAfter==end);
    nextHeadAt=nextArmAt=nextTorsoAt=nextEyeAt=start;nextMouthAt=start+180000;
    for(uint32_t offset=0;offset<64000;offset+=1000){fakeNow=start+offset;loop();REQUIRE(fakeWrites.size()==1);}
    // A reconnect during the estimate must not restart eyes/lights/motors early.
    fakeNow=start+10000;resetConnection();REQUIRE(connectToSkelly());REQUIRE(mouthPlayingUntil==end&&bodySafeAfter==end);
    for(uint32_t offset=11000;offset<65000;offset+=1000){fakeNow=start+offset;loop();REQUIRE(fakeWrites.size()==1);}
    nextMouthAt=end+180000;nextHeadAt=nextEyeAt=end;
    for(uint32_t offset=65000;offset<75000;offset+=100){fakeNow=start+offset;loop();}
    REQUIRE(!audioHoldPending);bool eye=false,light=false,motor=false;
    for(size_t i=1;i<fakeWrites.size();i++){const auto &b=fakeWrites[i];eye|=b[1]==0xf9;light|=b[1]==0xf2;motor|=b[1]==0xca;}
    REQUIRE(eye&&light&&motor);
  }
  audioReady(1000);startMouth(fakeNow);resetConnection();fakeScanFindsDevice=false;
  for(uint32_t hour=1;hour<=25u*24u;hour++){fakeNow=1000u+hour*3600000u;loop();}
  REQUIRE(!audioHoldPending);skellyDevice=new BLEAdvertisedDevice();found=true;REQUIRE(connectToSkelly());REQUIRE(!audioHoldPending&&reached(fakeNow,mouthPlayingUntil));
  std::cout<<"PASS exclusive audio owns eyes/lights/motors across write latency, reconnect and millis wrap; routine resumes\n";
  return 0;
}catch(const std::exception &e){std::cerr<<"FAIL audio scene: "<<e.what()<<'\n';return 1;}}

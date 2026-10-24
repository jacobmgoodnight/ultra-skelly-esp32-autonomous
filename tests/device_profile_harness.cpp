#include <iostream>
#define REQUIRE(c) do{if(!(c))throw std::runtime_error(#c);}while(false)
int main(){try{
  static_assert(DEVICE_PROFILE.headMask==2 && DEVICE_PROFILE.eyeCount==20 && DEVICE_PROFILE.lightChannels==1,"12-foot mapping");
  static_assert(!DEVICE_PROFILE.audio && !DEVICE_PROFILE.bodyMotors,"Unsupported operations");
  REQUIRE(HEAD_ANIMATION_MS==60000 && HEAD_BUFFER_MS==30000);
  REQUIRE(strcmp(DEVICE_PROFILE.storageNamespace,"skelly-12ft")==0);
  setup();fakeScanFindsDevice=true;
  // A shared service or another advertised model must not match this build.
  fakeAdvertisedName="Ultra Skelly v2";scanAndConnect();REQUIRE(!connected);
  fakeAdvertisedName="12ft Skelly";scanAndConnect();REQUIRE(connected);
  REQUIRE(!fakeScanInProgress && fakeDiscoveryCount==1);
  fakeWrites.clear();fakeWriteTimes.clear();startHead(fakeNow);
  REQUIRE(fakeWrites.size()==1);
  const uint8_t expected[]={0xaa,0xca,2,0,0,0,0,0,0,0,0x94};
  REQUIRE(fakeWrites[0]==std::vector<uint8_t>(expected,expected+11));
  REQUIRE(headSafeAfter-fakeNow==90000 && bodySafeAfter==headSafeAfter);
  startArm(fakeNow);startTorso(fakeNow);startCompoundBody(fakeNow);startMouth(fakeNow);REQUIRE(fakeWrites.size()==1);
  uint8_t invalid[11]={0xaa,0xca,1,0,0,0,0,0,0,0,0};REQUIRE(!sendFrame(invalid));
  invalid[1]=0xf9;invalid[2]=21;REQUIRE(!sendFrame(invalid));
  invalid[1]=0xf4;invalid[2]=1;REQUIRE(!sendFrame(invalid));
  invalid[1]=0xc6;invalid[2]=0;REQUIRE(!sendFrame(invalid));
  REQUIRE(sendEyeIcon(20,"software test"));
#if SKELLY_RUNTIME
  REQUIRE(runtimeEyeCount==2 && runtimeEyes[0]==19 && runtimeEyes[1]==20);
  RuntimeRecord record=runtimeEngine.active;REQUIRE(RuntimeEngine::valid(record));
  record.words[0]=1;record.crc=RuntimeEngine::checksum(record);REQUIRE(!RuntimeEngine::valid(record));
  record=runtimeEngine.active;record.words[3+RF_armEnabled]=1;record.crc=RuntimeEngine::checksum(record);REQUIRE(!RuntimeEngine::valid(record));
  record=runtimeEngine.active;record.words[3+RF_eyeMask]=1UL<<20;record.crc=RuntimeEngine::checksum(record);REQUIRE(!RuntimeEngine::valid(record));
  record=runtimeEngine.active;record.words[3+RF_headMin]=89;record.crc=RuntimeEngine::checksum(record);REQUIRE(!RuntimeEngine::valid(record));
  record=runtimeEngine.active;record.words[3+RF_eyeJawMode]=3;record.crc=RuntimeEngine::checksum(record);REQUIRE(!RuntimeEngine::valid(record));
#endif
  fakeWrites.clear();fakeWriteTimes.clear();const uint32_t begin=fakeNow;
  while(uint32_t(fakeNow-begin)<500000)loop();
  size_t heads=0,lights=0,eyes=0;uint32_t previous=0;
  for(size_t i=0;i<fakeWrites.size();++i){const auto &f=fakeWrites[i];
    REQUIRE(f.back()==skellyCRC(f.data(),f.size()-1));
    if(f[1]==0xca){REQUIRE(f[2]==2);if(heads)REQUIRE(uint32_t(fakeWriteTimes[i]-previous)>=90000);previous=fakeWriteTimes[i];++heads;}
    else if(f[1]==0xf9){REQUIRE(f[2]==19||f[2]==20);++eyes;}
    else {REQUIRE(f[1]==0xf2||f[1]==0xf3||f[1]==0xf4||f[1]==0xf6);REQUIRE(f[2]==0);++lights;}
  }
  REQUIRE(heads>=2 && lights==4 && eyes>=1);
  resetConnection();REQUIRE(!connected&&!lightApplyPending&&!jawFollowupPending);
  fakeServicePresent=false;scanAndConnect();REQUIRE(!connected);
  fakeServicePresent=true;scanAndConnect();REQUIRE(connected&&fakeDiscoveryCount==3);
  const uint32_t reconnected=fakeNow;while(uint32_t(fakeNow-reconnected)<5000)loop();
  REQUIRE(!lightApplyPending);
#if SKELLY_RUNTIME
  // Save/reboot the experimental namespace without touching Ultra's prior slot.
  fakeNVS["slot0"]={0xde,0xad};
  runtimeEngine.staging=runtimeEngine.active;REQUIRE(runtimeEngine.persist());
  REQUIRE(fakeNVS["slot0"]==std::vector<uint8_t>({0xde,0xad}));
  runtimeBoot();REQUIRE(runtimeEngine.active.sequence==1);
  REQUIRE(runtimeEngine.active.words[0]==12 && runtimeEyeCount==2);
#endif
  std::cout<<"PASS experimental profile bytes, restrictions, eyes, chest, cooldowns, format isolation and reconnect (software-only)\n";
}catch(const std::exception&e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}

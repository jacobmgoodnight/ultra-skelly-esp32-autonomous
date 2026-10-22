#include <iostream>
#define REQUIRE(c) do { if(!(c))throw std::runtime_error(#c); } while(false)
void ready(uint32_t at=1000) {
  fakeNow=at;fakeWriteLatency=0;fakeWriteOK=true;fakeRandomChoices.clear();Serial.input.clear();
  fakeConnectOK=fakeDiscoveryOK=fakeServicePresent=fakeCharacteristicPresent=true;fakeDisconnectOnDiscovery=false;
  static BLEAdvertisedDevice device;skellyDevice=&device;found=true;REQUIRE(connectToSkelly());
  clockValid=true;clockCivilMillis=1792796400ULL*1000;clockLastTick=fakeNow;clockWindowWasOpen=CLOCK_WINDOW_ENABLED;
  lightApplyPending=false;
  fakeWrites.clear();
  fakeWriteTimes.clear();
}
int main(){try{
  ready(UINT32_MAX-10000);
  nextHeadAt=nextArmAt=nextTorsoAt=nextCompoundAt=nextMouthAt=fakeNow;
  // Coarse loop service can miss the short quiet gap before restoration.
  // Reproduce that contention without claiming a measured BLE latency.
  for(int i=0;i<130;++i){loop();delay(2700);}
  size_t jaws=0,bodies=0;for(const auto &p:fakeWrites){if(p[1]==0xc6)++jaws;if(p[1]==0xca)++bodies;}
  std::cout<<"TRACE fair="<<FAIR_BODY_TURNS<<" compound="<<COMPOUND_BODY_ENABLED<<" jaws="<<jaws<<" bodies="<<bodies<<"\n";
  REQUIRE(jaws>=3);if(FAIR_BODY_TURNS)REQUIRE(bodies>=3);else REQUIRE(bodies==0);
  uint32_t bodyUntil=UINT32_MAX-10000,jawUntil=bodyUntil;
  for(size_t i=0;i<fakeWrites.size();++i){
    const auto &p=fakeWrites[i];const uint32_t at=fakeWriteTimes[i];
    if(p[1]==0xc6){REQUIRE(reached(at,bodyUntil));jawUntil=at+jawDurationMs(uint16_t(p[2]<<8|p[3]));}
    if(p[1]==0xca){REQUIRE(reached(at,jawUntil));REQUIRE(reached(at,bodyUntil));bodyUntil=at+((p[2]&4)?35000:32000);}
  }
  std::cout<<"PASS jaw-heavy fairness policy, conservative locks and wrap\n";
  ready();const uint32_t before=mouthPlayingUntil;
  uint8_t frame[]={0xbb,0xc6,0,13,0,0,21};
  if(PLAYBACK_DIAGNOSTICS){
    REQUIRE(notifySource!=nullptr);
    for(int i=0;i<20;++i)playbackNotification(notifySource,frame,sizeof(frame),true);
    REQUIRE(playbackDropped==13);drainPlaybackObservation();REQUIRE(mouthPlayingUntil==before);
    const uint8_t write=playbackWrite;frame[4]=2;playbackNotification(notifySource,frame,sizeof(frame),true);REQUIRE(playbackWrite==write);
    resetConnection();REQUIRE(notifySource==nullptr);REQUIRE(playbackRead==playbackWrite);
    std::cout<<"PASS bounded passive notification queue, no timer changes, disconnect cleanup\n";
  }
  ready();Serial.output.clear();acceptUsbCommand("SKELLY HELLO");REQUIRE(Serial.output.find("USB READY v1 CLOCK")!=std::string::npos);
  clockValid=false;for(const char *bad:{"SKELLY TIME 1","SKELLY TIME 1792796400x","SKELLY TIME -792796400","SKELLY TIME 9999999999"})acceptUsbCommand(bad);REQUIRE(!clockValid);
  const std::string flood=std::string(100,'9')+"\nSKELLY TIME 1792796400\n";
  for(unsigned char c:flood)Serial.input.push_back(c);serviceUsbClock();REQUIRE(!clockValid);serviceUsbClock();REQUIRE(clockValid);
  const uint64_t base=clockCivilMillis;fakeNow+=500;serviceUsbClock();REQUIRE(clockCivilMillis==base+500);
  ready(UINT32_MAX-250);const uint64_t wrapBase=clockCivilMillis;fakeNow+=500;serviceUsbClock();REQUIRE(clockCivilMillis==wrapBase+500);
#ifdef TEST_FILE_DURATIONS
  ready();clockValid=false;
  for(int day=0;day<26;++day){fakeNow+=86400000;loop();}
  REQUIRE(!reached(fakeNow,restUntil));
  clockValid=true;clockWindowWasOpen=false;loop();
  REQUIRE(reached(fakeNow,restUntil));REQUIRE(!reached(fakeNow,nextRestAt));
  const uint32_t expectedDurations[]={21000,24000,30000};
  for(int choice=0;choice<3;++choice){
    ready();fakeRandomChoices.push_back(choice);startMouth(fakeNow);
    REQUIRE(fakeWrites.back()[1]==0xc6);REQUIRE(fakeWrites.back()[3]==12+choice);
    REQUIRE(mouthPlayingUntil-fakeNow==expectedDurations[choice]);
    REQUIRE(lightRestoreAt==mouthPlayingUntil+LIGHT_RESTORE_GRACE_MS);
  }
  std::cout<<"PASS selected pool serial uses its own conservative playback estimate\n";
#endif
  if(CLOCK_WINDOW_ENABLED){
    ready();clockValid=false;nextHeadAt=nextArmAt=nextTorsoAt=nextMouthAt=nextCompoundAt=fakeNow;loop();REQUIRE(fakeWrites.empty());
    acceptUsbCommand("SKELLY TIME 1792796400");REQUIRE(routineWindowOpen()); // Fri 23:00
    clockCivilMillis+=2ULL*3600000;REQUIRE(routineWindowOpen()); // Sat 01:00 belongs to Friday.
    clockCivilMillis+=3600000;REQUIRE(!routineWindowOpen()); // Sat 02:00 exclusive.
    clockCivilMillis+=20ULL*3600000;REQUIRE(!routineWindowOpen()); // Saturday not selected.
    jawFollowupPending=true;clockWindowWasOpen=true;fakeWrites.clear();loop();
    REQUIRE(!jawFollowupPending);for(const auto &p:fakeWrites)REQUIRE(p[1]!=0xca&&p[1]!=0xc6);
    acceptUsbCommand("SKELLY TIME 1792796400");fakeWrites.clear();loop();
    REQUIRE(!reached(fakeNow,nextMouthAt));for(const auto &p:fakeWrites)REQUIRE(p[1]!=0xca&&p[1]!=0xc6);
    clockValid=false;REQUIRE(!routineWindowOpen());
    ready();clockCivilMillis=1792807199ULL*1000;clockLastTick=fakeNow; // Sat 01:59:59
    fakeWriteLatency=2000;startHead(fakeNow);fakeWriteLatency=0;
    REQUIRE(fakeWrites.size()==1);startMouth(fakeNow);REQUIRE(fakeWrites.size()==1);
    REQUIRE(!routineWindowOpen()); // A blocking write cannot authorize another request after closing.
    std::cout<<"PASS fail-closed boot, USB validation, overnight weekday window and closing boundary\n";
  }
  REQUIRE(jawDurationMs(65535)==MOUTH_CLIP_MS);
  return 0;
}catch(const std::exception &e){std::cerr<<"FAIL USB/scheduler: "<<e.what()<<'\n';return 1;}}

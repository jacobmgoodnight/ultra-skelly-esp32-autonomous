#include <iostream>
#define REQUIRE(c) do{if(!(c))throw std::runtime_error(#c);}while(false)
void feedRuntime(const std::string &line){for(unsigned char c:line+"\n")Serial.input.push_back(c);serviceUsbClock();}
void runtimeIdle(uint32_t at){fakeNow=at;connected=false;bodySafeAfter=headSafeAfter=armSafeAfter=torsoSafeAfter=mouthPlayingUntil=mouthSafeAfter=at;jawFollowupPending=mouthEndPending=jawEyeStartPending=jawEyeEndPending=lightApplyPending=lightRestorePending=false;}
void seal(RuntimeRecord &r){r.crc=RuntimeEngine::checksum(r);}
int main(){try{
  fakeNVS.clear();fakeNVSWriteCount=0;fakeNVSOpen=fakeNVSWrite=true;runtimeIdle(1000);runtimeBoot();
  REQUIRE(RuntimeEngine::valid(runtimeEngine.active));REQUIRE(HEAD_ENABLED&&!MOUTH_ENABLED&&!LIGHTS_ENABLED);
  REQUIRE(runtimeEngine.active.words[1]==2 && runtimeEngine.scene==0);REQUIRE(runtimeEyeCount==18);
  RuntimeRecord initial=runtimeEngine.active;
  for(size_t index:{size_t(RF_headMin),size_t(RF_clockDays),size_t(RF_jawClipSec)}){RuntimeRecord bad=initial;bad.words[3+index]=RUNTIME_LIMITS[index][0]-1;seal(bad);REQUIRE(!RuntimeEngine::valid(bad));}
  RuntimeRecord bad=initial;bad.words[3+RF_fileCount]=2;bad.words[3+RF_file1]=bad.words[3+RF_file0];seal(bad);REQUIRE(!RuntimeEngine::valid(bad));
  bad=initial;bad.words[3+RF_compoundEnabled]=1;bad.words[3+RF_comboMask]=15;seal(bad);REQUIRE(!RuntimeEngine::valid(bad));
  // Atomic staging: incomplete or invalid data never changes active settings.
  acceptUsbCommand("SKELLY CFG BEGIN 7 3");acceptUsbCommand("SKELLY CFG DATA 7 1 00000001");REQUIRE(runtimeEngine.received==0);
  acceptUsbCommand("SKELLY CFG COMMIT 7 0");REQUIRE(runtimeEngine.active.crc==initial.crc);acceptUsbCommand("SKELLY CFG ABORT 7");
  RuntimeRecord desired=initial;desired.words[3+RF_headMin]=90;desired.words[3+RF_headMax]=90;seal(desired);
  feedRuntime("SKELLY CFG BEGIN 8 "+std::to_string(desired.count));
  for(uint32_t i=0;i<desired.count;i+=8){std::string line="SKELLY CFG DATA 8 "+std::to_string(i);for(uint32_t j=i;j<desired.count&&j<i+8;++j){char word[12];snprintf(word,sizeof(word)," %08lX",(unsigned long)desired.words[j]);line+=word;}feedRuntime(line);}
  REQUIRE(runtimeEngine.received==desired.count);feedRuntime("SKELLY CFG COMMIT 8 "+std::to_string(desired.crc));REQUIRE(runtimeEngine.pending);
  headSafeAfter=fakeNow+32000;serviceRuntime();REQUIRE(HEAD_MIN_INTERVAL_MS==60000 && runtimeEngine.pending);REQUIRE(fakeNVS.empty());
  fakeNow=headSafeAfter;serviceRuntime();REQUIRE(HEAD_MIN_INTERVAL_MS==90000 && !runtimeEngine.pending);REQUIRE(runtimeEngine.active.sequence==1);
  REQUIRE(fakeNVS["slot1"].size()==sizeof(RuntimeRecord));
  // A failed write leaves both the running program and previous valid slot intact.
  const uint32_t saved=runtimeEngine.active.crc;runtimeEngine.staging=initial;runtimeEngine.pending=runtimeEngine.savePending=true;fakeNVSWrite=false;serviceRuntime();REQUIRE(runtimeEngine.active.crc==saved && !runtimeEngine.pending);fakeNVSWrite=true;
  fakeNVS["slot0"]=std::vector<uint8_t>(17,0xff);clockValid=true;runtimeBoot();REQUIRE(!clockValid && runtimeEngine.active.sequence==1 && HEAD_MIN_INTERVAL_MS==90000);
  RuntimeRecord next=runtimeEngine.active;next.sequence=2;next.guard=RuntimeEngine::headerGuard(next);fakeNVS["slot0"]=std::vector<uint8_t>((uint8_t*)&next,(uint8_t*)&next+sizeof(next));fakeNVS["slot0"][4]^=1;runtimeBoot();REQUIRE(runtimeEngine.active.sequence==1);
  // Scene boundary waits for full cooldown, then updates all settings together.
  runtimeIdle(10000);runtimeEngine.sceneAt=fakeNow;serviceRuntime();REQUIRE(!runtimeEngine.pending);connected=true;torsoSafeAfter=fakeNow+35000;serviceRuntime();REQUIRE(runtimeEngine.pending&&runtimeEngine.scene==0);
  fakeNow=torsoSafeAfter;serviceRuntime();REQUIRE(!runtimeEngine.pending&&runtimeEngine.scene==1);REQUIRE(ARM_ENABLED&&TORSO_ENABLED&&COMPOUND_BODY_ENABLED&&COMPOUND_ALONGSIDE&&LIGHTS_ENABLED&&EYES_ENABLED);
  REQUIRE(runtimeMaskCount==4 && runtimeFileCount==1);REQUIRE(HEAD_ANIMATION_MS+HEAD_BUFFER_MS==32000);
  runtimeSceneConnected();REQUIRE(runtimeEngine.sceneAt-fakeNow==120000);
  REQUIRE(fakeNVSWriteCount==1); // automatic scene rotation never writes flash
  RuntimeRecord wrap=runtimeEngine.active;wrap.sequence=0;wrap.guard=RuntimeEngine::headerGuard(wrap);fakeNVS["slot0"]=std::vector<uint8_t>((uint8_t*)&wrap,(uint8_t*)&wrap+sizeof(wrap));
  wrap.sequence=UINT32_MAX;wrap.guard=RuntimeEngine::headerGuard(wrap);fakeNVS["slot1"]=std::vector<uint8_t>((uint8_t*)&wrap,(uint8_t*)&wrap+sizeof(wrap));runtimeBoot();REQUIRE(runtimeEngine.active.sequence==0);
  runtimeIdle(100000);runtimeEngine.active=initial;
  uint32_t *v=runtimeEngine.active.words+3;v[RF_jawEnabled]=1;v[RF_jawFile]=v[RF_file0]=13;v[RF_fileCount]=3;v[RF_file1]=12;v[RF_duration1]=30;v[RF_file2]=14;v[RF_duration2]=45;seal(runtimeEngine.active);REQUIRE(RuntimeEngine::valid(runtimeEngine.active));runtimeEngine.select(0);
  static BLEAdvertisedDevice device;skellyDevice=&device;found=true;REQUIRE(connectToSkelly());fakeWrites.clear();fakeRandomChoices.clear();fakeRandomChoices.push_back(2);startMouth(fakeNow);
  REQUIRE(fakeWrites.size()==1&&fakeWrites[0][1]==0xc6&&fakeWrites[0][3]==14);REQUIRE(mouthPlayingUntil-fakeNow==45000);REQUIRE(jawDurationMs(12)==30000);
  std::cout<<"PASS runtime validation, staged transfer, full cooldown, atomic persistence, torn/corrupt fallback, invalid boot clock and scene transitions\n";
}catch(const std::exception&e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}

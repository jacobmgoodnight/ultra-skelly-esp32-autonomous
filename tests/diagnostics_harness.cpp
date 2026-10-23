#include <iostream>
#define CHECK(c) do { if(!(c)) throw std::runtime_error(#c); } while(false)
int main() {
  fakeNow=10000; connected=true;
  bodySafeAfter=headSafeAfter=armSafeAfter=torsoSafeAfter=mouthPlayingUntil=restUntil=fakeNow;
  lightApplyPending=lightRestorePending=mouthEndPending=jawEyeStartPending=jawEyeEndPending=jawFollowupPending=false;
  CHECK(diagnosticWait(fakeNow)==0);
  headSafeAfter=fakeNow+32000; CHECK(diagnosticWait(fakeNow)==4);
  const uint32_t saved=headSafeAfter;
  mouthPlayingUntil=fakeNow+21000; CHECK(diagnosticWait(fakeNow)==2);
  Serial.output.clear(); emitUsbStatus();
  CHECK(Serial.output.find("firmware=4 build=2026102301 wait=2 jawMs=21000 accepted=0")!=std::string::npos);
  CHECK(Serial.output.back()=='\n'); CHECK(headSafeAfter==saved); CHECK(fakeWrites.empty());
  mouthPlayingUntil=fakeNow;headSafeAfter=fakeNow;
  lightRestorePending=true;CHECK(diagnosticWait(fakeNow)==3);lightRestorePending=false;
  jawFollowupPending=true;CHECK(diagnosticWait(fakeNow)==7);jawFollowupPending=false;
  runtimeValues[RF_restEnabled]=1;restUntil=fakeNow+20000;CHECK(diagnosticWait(fakeNow)==5);
  restUntil=fakeNow;runtimeValues[RF_clockEnabled]=1;clockValid=false;CHECK(diagnosticWait(fakeNow)==6);
  runtimeValues[RF_clockEnabled]=0;runtimeEngine.pending=true;
  Serial.output.clear();emitUsbStatus();CHECK(Serial.output.find("pending=1")!=std::string::npos);runtimeEngine.pending=false;
  connected=false;CHECK(diagnosticWait(fakeNow)==1);connected=true;
  fakeNow=0xfffffff0UL;mouthPlayingUntil=fakeNow+21000;CHECK(diagnosticWait(fakeNow)==2);
  lastAcceptedTag=0xca;lastAcceptedAt=fakeNow-3000;
  Serial.output.clear();emitUsbStatus();CHECK(Serial.output.find("accepted=1 acceptedAge=3000\n")!=std::string::npos);
  CHECK(fakeWrites.empty());
  // Worst-case counters must retain the final fields and line ending.
  scanAttempts=connectionAttempts=writeAttempts=writeFailures=0xffffffffUL;
  Serial.output.clear();emitUsbStatus();
  CHECK(Serial.output.size()<640);CHECK(Serial.output.find("acceptedAge=3000\n")!=std::string::npos);
#if SKELLY_WIRELESS_STATUS
  setupWirelessStatus();
  CHECK(fakeServerCharacteristic.properties==BLECharacteristic::PROPERTY_READ);
  CHECK(fakeServerCharacteristic.permissions==ESP_GATT_PERM_READ);
  const auto starts=fakeAdvertisingStarts;
  // Even a phone that connects/disconnects between loop ticks must readvertise.
  fakeServerPhoneCount=0;wirelessStatusServer->callbacks->onDisconnect(wirelessStatusServer);
  CHECK(fakeAdvertisingStarts==starts);serviceWirelessStatus();CHECK(fakeAdvertisingStarts==starts+1);
  fakeServerCharacteristic.callbacks->onRead(&fakeServerCharacteristic);
  CHECK(fakeServerCharacteristic.value.find("Experimental status v1")!=std::string::npos);
  CHECK(fakeServerCharacteristic.value.size()<320);
  CHECK(fakeWrites.empty()); CHECK(connected);
#endif
  std::cout<<"PASS read-only diagnostics, timing wrap, idle breaks, pending settings and wireless isolation\n";
}

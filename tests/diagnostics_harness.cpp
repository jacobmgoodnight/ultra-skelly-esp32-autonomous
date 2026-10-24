#include <iostream>
#define CHECK(c) do { if(!(c)) throw std::runtime_error(#c); } while(false)
int main(){
 fakeNow=10000;connected=true;
 bodySafeAfter=headSafeAfter=armSafeAfter=torsoSafeAfter=mouthPlayingUntil=restUntil=fakeNow;
 lightApplyPending=lightRestorePending=mouthEndPending=jawEyeStartPending=jawEyeEndPending=jawFollowupPending=audioHoldPending=false;
 CHECK(diagnosticWait(fakeNow)==0);
 headSafeAfter=fakeNow+32000;CHECK(diagnosticWait(fakeNow)==4);const auto saved=headSafeAfter;
 mouthPlayingUntil=fakeNow+21000;CHECK(diagnosticWait(fakeNow)==2);
 Serial.output.clear();emitUsbStatus();CHECK(Serial.output.find("firmware=5 build=2026102401 wait=2 jawMs=21000 accepted=0")!=std::string::npos);
 CHECK(Serial.output.back()=='\n');CHECK(headSafeAfter==saved);CHECK(fakeWrites.empty());
 audioHoldPending=true;audioHoldUntil=fakeNow+56000;CHECK(diagnosticWait(fakeNow)==8);audioHoldPending=false;
 mouthPlayingUntil=headSafeAfter=fakeNow;lightRestorePending=true;CHECK(diagnosticWait(fakeNow)==3);lightRestorePending=false;
 jawFollowupPending=true;CHECK(diagnosticWait(fakeNow)==7);jawFollowupPending=false;
 runtimeValues[RF_restEnabled]=1;restUntil=fakeNow+20000;CHECK(diagnosticWait(fakeNow)==5);restUntil=fakeNow;
 runtimeValues[RF_clockEnabled]=1;clockValid=false;CHECK(diagnosticWait(fakeNow)==6);runtimeValues[RF_clockEnabled]=0;
 runtimeEngine.pending=true;Serial.output.clear();emitUsbStatus();CHECK(Serial.output.find("pending=1")!=std::string::npos);runtimeEngine.pending=false;
 connected=false;CHECK(diagnosticWait(fakeNow)==1);connected=true;
 fakeNow=0xfffffff0UL;mouthPlayingUntil=fakeNow+21000;CHECK(diagnosticWait(fakeNow)==2);
 lastAcceptedTag=0xca;lastAcceptedAt=fakeNow-3000;scanAttempts=connectionAttempts=writeAttempts=writeFailures=0xffffffffUL;
 Serial.output.clear();emitUsbStatus();CHECK(Serial.output.size()<640);CHECK(Serial.output.find("accepted=1 acceptedAge=3000\n")!=std::string::npos);
 CHECK(fakeWrites.empty());CHECK(headSafeAfter==10000);
 std::cout<<"PASS read-only status, all wait reasons, audio hold, timer wrap, pending settings, bounded full line; no actuator writes\n";
}

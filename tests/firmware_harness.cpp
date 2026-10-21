// The runner prepends the actual canonical or generated firmware, with only
// configuration constants changed. These assertions execute its C++ functions.
#include <functional>
#include <iostream>
#define CHECK(condition) do { if (!(condition)) throw std::runtime_error(#condition); } while (false)

void prepare(uint32_t at = 1000) {
  fakeNow = at;
  fakeWriteLatency = 0;
  scanner = BLEDevice::getScan();
  static BLEAdvertisedDevice device;
  skellyDevice = &device;
  found = true;
  CHECK(connectToSkelly());
  fakeWrites.clear();
  fakeWriteOK = true;
  Serial.output.clear();
}
void finishLights() {
  for (int i = 0; i < 40 && lightApplyPending; ++i) {
    fakeNow += 300;
    progressLights(fakeNow);
  }
  CHECK(!lightApplyPending);
}

int main() {
  int failed = 0;
  auto run = [&](const char *name, std::function<void()> fn) {
    try { fn(); std::cout << "PASS " << name << '\n'; }
    catch (const std::exception &e) { ++failed; std::cout << "FAIL " << name << ": " << e.what() << '\n'; }
  };
  run("initial six lighting packets, lengths and CRC", [] {
    prepare(); fakeNow += 1500; finishLights();
    CHECK(fakeWrites.size() == 6);
    const size_t lengths[] = {11, 11, 13, 12, 11, 13};
    const uint8_t tags[] = {0xf2, 0xf3, 0xf4, 0xf2, 0xf3, 0xf4};
    const uint8_t crc[] = {0xa5, 0x4b, 0xd3, 0x34, 0x08, 0xfc};
    for (size_t i = 0; i < 6; ++i) {
      CHECK(fakeWrites[i].size() == lengths[i]);
      CHECK(fakeWrites[i][1] == tags[i]);
      CHECK(fakeWrites[i][2] == i / 3);
      CHECK(fakeWrites[i].back() == crc[i]);
    }
  });
  run("WRITE_NR failure while connected is detected", [] {
    prepare(); fakeWriteOK = false;
    uint8_t frame[11] = {0xaa, 0xf9, 2};
    CHECK(!sendFrame(frame));
  });
  run("failed lighting write cancels pending work", [] {
    for (int stage = 0; stage < 6; ++stage) {
      prepare(); fakeNow += 1500;
      for (int i = 0; i < stage; ++i) { progressLights(fakeNow); fakeNow += 300; }
      fakeWriteOK = false;
      progressLights(fakeNow);
      CHECK(!connected); CHECK(!lightApplyPending); CHECK(!lightRestorePending);
    }
  });
  run("modeled restoration deadline survives millis wrap", [] {
    prepare(UINT32_MAX - 10000); finishLights();
    const uint32_t start = fakeNow;
    startMouth(start); fakeWrites.clear();
    if (LIGHT_RESTORE_MODE == 0) {
      CHECK(!lightRestorePending); CHECK(!lightApplyPending); return;
    }
    CHECK(lightRestorePending);
    CHECK(!reached(start + 21499, lightRestoreAt));
    CHECK(reached(start + 21500, lightRestoreAt));
    fakeNow = start + 21500; loop();
    CHECK(!lightRestorePending); CHECK(lightApplyPending);
    finishLights(); CHECK(fakeWrites.size() == 6);
  });
  run("MP3 replaces stale light sequence only in restore modes", [] {
    prepare(); fakeNow += 1500; progressLights(fakeNow);
    CHECK(lightApplyStep == 1);
    startMouth(fakeNow); fakeWrites.clear();
    if (LIGHT_RESTORE_MODE == 1) CHECK(!lightApplyPending);
    if (LIGHT_RESTORE_MODE == 2) {
      CHECK(lightApplyStep == 0); CHECK(lightApplyPending);
      progressLights(fakeNow + 2999); CHECK(fakeWrites.empty());
      progressLights(fakeNow + 3000); CHECK(fakeWrites.size() == 1);
    }
  });
  run("next MP3 waits for complete final lighting sequence", [] {
    prepare(); finishLights();
    const uint32_t start = fakeNow; startMouth(start); fakeWrites.clear();
    if (LIGHT_RESTORE_MODE == 0) return;
    nextMouthAt = start + 22000;
    fakeNow = start + 21500; loop();
    fakeNow = start + 22000; loop();
    CHECK(lightApplyPending);
    for (const auto &p : fakeWrites) CHECK(p[1] != 0xc6);
    // Complete using the real loop: playback must eventually resume.
    for (int i = 0; i < 50; ++i) loop();
    size_t colors = 0; bool sawJaw = false;
    for (const auto &p : fakeWrites) {
      if (p[1] == 0xf4) ++colors;
      if (p[1] == 0xc6) { CHECK(colors == 2); sawJaw = true; break; }
    }
    CHECK(sawJaw);
  });
  run("reconnect cancels stale restoration and restarts initial lights", [] {
    prepare(); finishLights(); startMouth(fakeNow);
    resetConnection(); CHECK(!lightApplyPending); CHECK(!lightRestorePending);
    CHECK(!jawFollowupPending); CHECK(!jawEyeStartPending); CHECK(!jawEyeEndPending);
    fakeWrites.clear(); CHECK(connectToSkelly());
    CHECK(!lightRestorePending); CHECK(lightApplyStep == 0);
    finishLights(); CHECK(fakeWrites.size() == 6);
  });
  run("lighting yields to a pending motor and recent BLE traffic", [] {
    prepare(); fakeNow += 1500;
    jawFollowupPending = true;
    CHECK(!progressLights(fakeNow)); CHECK(fakeWrites.empty());
    jawFollowupPending = false;
    uint8_t eye[11] = {0xaa, 0xf9, 2}; CHECK(sendFrame(eye));
    const size_t count = fakeWrites.size();
    CHECK(!progressLights(fakeNow + 249)); CHECK(fakeWrites.size() == count);
    fakeNow += 250; CHECK(progressLights(fakeNow));
  });
  run("modeled MP3 timing begins after blocking write returns", [] {
    prepare(); finishLights(); fakeWriteLatency = 700;
    const uint32_t before = fakeNow;
    startMouth(before);
    CHECK(mouthPlayingUntil == before + 700 + MOUTH_CLIP_MS);
    fakeWriteLatency = 0;
  });
  run("modeled end is logged once and remains explicitly unconfirmed", [] {
    prepare(); finishLights(); startMouth(fakeNow);
    Serial.output.clear(); fakeNow = mouthPlayingUntil;
    loop(); loop();
    const auto at = Serial.output.find("actual playback end unconfirmed");
    CHECK(at != std::string::npos);
    CHECK(Serial.output.find("actual playback end unconfirmed", at + 1) == std::string::npos);
  });
  run("text logger bounds output and prefixes uptime", [] {
    prepare(1234);
    logEvent("%s", std::string(1000, 'x').c_str());
    CHECK(Serial.output.size() <= 383);
    CHECK(Serial.output.find("[      1234 ms] ") == 0);
  });
  return failed ? 1 : 0;
}

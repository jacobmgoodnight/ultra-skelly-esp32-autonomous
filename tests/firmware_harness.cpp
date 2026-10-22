// The runner prepends the actual canonical or generated firmware, with only
// configuration constants changed. These assertions execute its C++ functions.
#include <functional>
#include <iostream>
#define CHECK(condition) do { if (!(condition)) throw std::runtime_error(#condition); } while (false)

void prepare(uint32_t at = 1000) {
  fakeNow = at;
  fakeWriteLatency = 0;
  fakeConnectOK = fakeDiscoveryOK = fakeServicePresent = fakeCharacteristicPresent = true;
  fakeDisconnectOnDiscovery = false;
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
  run("boot counter validates retained memory and resets on power-on", [] {
    bootCount = 42; bootCountGuard = 0;
    recordBoot(ESP_RST_SW); CHECK(bootCount == 1);
    recordBoot(ESP_RST_SW); CHECK(bootCount == 2);
    recordBoot(ESP_RST_PANIC); CHECK(bootCount == 3);
    recordBoot(ESP_RST_POWERON); CHECK(bootCount == 1);
    bootCountGuard ^= 1;
    recordBoot(ESP_RST_SW); CHECK(bootCount == 1);
  });
  run("body cooldowns and target intervals begin after blocking writes", [] {
    for (uint32_t at : {1000u, UINT32_MAX - 1000u}) {
      prepare(at); finishLights(); fakeWriteLatency = 5000;
      startHead(fakeNow);
      CHECK(headSafeAfter - fakeNow == HEAD_ANIMATION_MS + HEAD_BUFFER_MS);
      CHECK(headMovingUntil - fakeNow == HEAD_ANIMATION_MS);
      CHECK(nextBodyWriteAt - fakeNow == BODY_WRITE_SPACING_MS);
      CHECK(nextHeadAt - fakeNow >= HEAD_MIN_INTERVAL_MS);
      startArm(fakeNow);
      CHECK(armSafeAfter - fakeNow == ARM_ANIMATION_MS + ARM_BUFFER_MS);
      CHECK(nextArmAt - fakeNow >= ARM_MIN_INTERVAL_MS);
      startTorso(fakeNow);
      CHECK(torsoSafeAfter - fakeNow == TORSO_ANIMATION_MS + TORSO_BUFFER_MS);
      CHECK(nextTorsoAt - fakeNow >= TORSO_MIN_INTERVAL_MS);
    }
    fakeWriteLatency = 0;
  });
  run("future motor cooldown blocks jaw until full post-write duration", [] {
    prepare(UINT32_MAX - 10000); finishLights();
    fakeWriteLatency = 5000; startHead(fakeNow); fakeWriteLatency = 0;
    const uint32_t safe = headSafeAfter;
    nextMouthAt = fakeNow; mouthSafeAfter = fakeNow;
    fakeWrites.clear(); fakeNow = safe - 1; loop();
    CHECK(fakeWrites.empty()); CHECK(headSafeAfter == safe);
    fakeNow = safe; loop();
    CHECK(!fakeWrites.empty() && fakeWrites.back()[1] == 0xc6);
  });
  run("inactive motor timers do not stop jaw after 60 simulated days and wrap", [] {
    for (uint32_t at : {1000u, UINT32_MAX - 10000u}) {
      prepare(at); finishLights();
      const uint32_t begin = fakeNow;
      for (uint32_t day = 0; day < 60; ++day) {
        fakeNow = begin + uint32_t(uint64_t(day) * 86400000ULL);
        fakeWrites.clear();
        // Regular loop servicing is required by the cooperative scheduler.
        // Sample daily operation with enough time for modeled clips/restores.
        for (int i = 0; i < 14; ++i) { loop(); fakeNow += 30000; finishLights(); }
        bool sawJaw = false;
        for (const auto &frame : fakeWrites) if (frame[1] == 0xc6) sawJaw = true;
        CHECK(sawJaw);
      }
    }
  });
  run("each reconnect rediscovers services before accepting a writer", [] {
    prepare(); const unsigned before = fakeDiscoveryCount;
    resetConnection(); CHECK(connectToSkelly());
    CHECK(fakeDiscoveryCount == before + 1);
    CHECK(connected && writeChar != nullptr);
    for (int failure = 0; failure < 5; ++failure) {
      prepare(); resetConnection();
      if (failure == 0) fakeConnectOK = false;
      if (failure == 1) fakeDiscoveryOK = false;
      if (failure == 2) fakeServicePresent = false;
      if (failure == 3) fakeCharacteristicPresent = false;
      if (failure == 4) fakeDisconnectOnDiscovery = true;
      fakeWrites.clear();
      CHECK(!connectToSkelly()); CHECK(!connected && writeChar == nullptr);
      CHECK(fakeWrites.empty());
      CHECK(!lightApplyPending && !lightRestorePending && !jawFollowupPending);
    }
    prepare(); // Restore fake transport settings for later tests.
  });
  return failed ? 1 : 0;
}

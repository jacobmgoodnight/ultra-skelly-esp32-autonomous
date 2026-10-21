#include <iostream>
#define REQUIRE(condition) do { if (!(condition)) throw std::runtime_error(#condition); } while (false)

int main() {
  try {
    setup();
    skellyDevice = new BLEAdvertisedDevice();
    found = true;
    REQUIRE(connectToSkelly());
    fakeWrites.clear();
    const uint32_t begin = fakeNow;
    while (fakeNow - begin < 20U * 60000U) loop();
    size_t motors = 0, jaw = 0, eyes = 0, lights = 0;
    uint8_t observedMotorMask = 0;
    for (const auto &frame : fakeWrites) {
      REQUIRE(frame.size() >= 3 && frame.front() == 0xaa);
      REQUIRE(skellyCRC(frame.data(), frame.size() - 1) == frame.back());
      if (frame[1] == 0xca) {
        ++motors;
        REQUIRE(frame.size() == 11);
        REQUIRE(frame[2] != 0 && (frame[2] & ~expectedMotorMask) == 0);
        observedMotorMask |= frame[2];
      } else if (frame[1] == 0xc6) {
        ++jaw; REQUIRE(expectJaw && frame.size() == 11);
        const uint16_t file = (uint16_t(frame[2]) << 8) | frame[3];
        bool allowed = false;
        for (uint16_t selected : expectedFiles) if (file == selected) allowed = true;
        REQUIRE(allowed);
      } else if (frame[1] == 0xf9) {
        ++eyes; REQUIRE(expectEyes && frame.size() == 11);
        bool allowed = false;
        for (uint8_t selected : expectedEyes) if (frame[2] == selected) allowed = true;
        REQUIRE(allowed);
      } else {
        ++lights; REQUIRE(expectLights);
        REQUIRE(frame[1] == 0xf2 || frame[1] == 0xf3 || frame[1] == 0xf4);
        REQUIRE(frame[2] <= 1);
      }
    }
    REQUIRE((motors > 0) == (expectedMotorMask != 0));
    if (!COMPOUND_BODY_ENABLED) REQUIRE(observedMotorMask == expectedMotorMask);
    REQUIRE((jaw > 0) == expectJaw);
    REQUIRE((eyes > 0) == expectEyes);
    REQUIRE((lights > 0) == expectLights);
    if (expectRest) REQUIRE(Serial.output.find("REST: new animations paused") != std::string::npos);
    std::cout << "PASS 20 simulated minutes: permitted motors, clips, eyes, lighting and CRC\n";
    resetConnection();
    REQUIRE(!connected && writeChar == nullptr);
    REQUIRE(!lightApplyPending && !lightRestorePending && !jawFollowupPending);
    REQUIRE(!jawEyeStartPending && !jawEyeEndPending && !mouthEndPending);
    std::cout << "PASS disconnect cancels queued work\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "FAIL attended pack: " << error.what() << '\n';
    return 1;
  }
}

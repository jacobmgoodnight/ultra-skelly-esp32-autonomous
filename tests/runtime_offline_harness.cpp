#include <iostream>
#define REQUIRE(c) do { if (!(c)) throw std::runtime_error(#c); } while (false)

int main() {
  try {
    fakeNVS.clear(); fakeNVSWriteCount = 0; fakeNow = 1000;
    setup();
    // Service the real disconnected loop throughout the signed half-range.
    // This is continuous operation, not a weeks-long pause between loop calls.
    for (unsigned hour = 0; hour < 25 * 24; ++hour) {
      fakeNow = 2000 + hour * 3600000UL;
      loop();
    }
    fakeNow = 2000 + 25UL * 86400000UL;
    REQUIRE(!connected && scanAttempts >= 600 && fakeWrites.empty());
    acceptUsbCommand("SKELLY CFG RESET 123");
    REQUIRE(runtimePending());
    loop();
    REQUIRE(!runtimePending() && fakeNVSWriteCount == 1);
    REQUIRE(runtimeSequence() == 1 && fakeWrites.empty());

    // Keeping old deadlines fresh must never shorten a future active lock.
    const uint32_t start = fakeNow;
    headSafeAfter = start + 32000;
    acceptUsbCommand("SKELLY CFG RESET 124");
    loop();
    REQUIRE(runtimePending() && headSafeAfter == start + 32000);
    REQUIRE(fakeNVSWriteCount == 1);
    fakeNow = start + 31999;
    loop();
    REQUIRE(runtimePending() && fakeNVSWriteCount == 1);
    fakeNow = start + 32000;
    loop();
    REQUIRE(!runtimePending() && fakeNVSWriteCount == 2);

    // Continue through millis wrap, still without the prop or actuator writes.
    const uint32_t later = fakeNow;
    uint32_t previous = fakeNow;
    bool wrapped = false;
    for (unsigned hour = 1; hour <= 25 * 24; ++hour) {
      fakeNow = later + hour * 3600000UL;
      wrapped |= fakeNow < previous;
      loop(); previous = fakeNow;
    }
    REQUIRE(wrapped && !connected && fakeWrites.empty());
    acceptUsbCommand("SKELLY CFG RESET 125");
    loop();
    REQUIRE(!runtimePending() && fakeNVSWriteCount == 3);
    REQUIRE(runtimeSequence() == 3 && fakeWrites.empty());
    std::cout << "PASS continuously serviced offline settings across 25 days and millis wrap; future cooldown preserved\n";
  } catch (const std::exception &e) {
    std::cerr << "FAIL " << e.what() << '\n'; return 1;
  }
}

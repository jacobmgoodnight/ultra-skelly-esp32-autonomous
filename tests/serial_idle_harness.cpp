#include <iostream>

void require(bool condition, const char *message) {
  if (!condition) throw std::runtime_error(message);
}

void testCadence(uint32_t initial) {
  fakeNow = initial;
  cycle = 0;
  endPending = false;
  finished = false;
  Serial.output.clear();
  setup();
  const uint32_t ready = fakeNow;
  fakeNow = nextEventAt - 1;
  const size_t bootSize = Serial.output.size();
  loop();
  require(Serial.output.size() == bootSize, "output before first deadline");
  for (int n = 0; n < 4; ++n) {
    require(nextEventAt == ready + 60000U * (n + 1), "start interval changed");
    fakeNow = nextEventAt;
    loop();
    require(cycle == n + 1 && endPending && !finished, "missing START");
    require(nextEventAt == ready + 60000U * (n + 1) + 21000U, "end interval changed");
    fakeNow = nextEventAt - 1;
    const size_t beforeEnd = Serial.output.size();
    loop();
    require(Serial.output.size() == beforeEnd, "premature END");
    fakeNow = nextEventAt;
    loop();
    require(!endPending, "END not consumed");
  }
  require(finished && cycle == 4, "test did not stop after four cycles");
  const size_t finishedSize = Serial.output.size();
  fakeNow += 60000;
  loop();
  require(Serial.output.size() == finishedSize, "output continued after completion");
  size_t first = 0, second = 0, pos = 0;
  while ((pos = Serial.output.find(" FIRST ", pos)) != std::string::npos) { ++first; ++pos; }
  pos = 0;
  while ((pos = Serial.output.find(" SECOND ", pos)) != std::string::npos) { ++second; ++pos; }
  require(first == 8 && second == 8, "missing paired log lines");
  for (unsigned char c : Serial.output) require(c == '\n' || (c >= 32 && c <= 126), "non-ASCII application output");
}

int main() {
  try {
    testCadence(1000);
    std::cout << "PASS serial-only four-cycle cadence, quiet periods and completion\n";
    testCadence(UINT32_MAX - 30000);
    std::cout << "PASS serial-only cadence across millis wrap\n";
    return 0;
  } catch (const std::exception &e) {
    std::cerr << "FAIL serial-only: " << e.what() << '\n';
    return 1;
  }
}

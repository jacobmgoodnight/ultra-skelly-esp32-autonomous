#pragma once
#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>
using String = std::string;
using std::max;
inline uint32_t fakeNow = 1000;
inline uint32_t millis() { return fakeNow; }
inline uint32_t micros() { return fakeNow * 1000; }
inline void delay(uint32_t ms) { fakeNow += ms; }
inline void randomSeed(uint32_t) {}
inline long random(long hi) { return hi ? hi - 1 : 0; }
inline long random(long lo, long hi) { return lo + (hi - lo) / 2; }
struct SerialStub {
  std::string output;
  void begin(int) {}
  void print(const char *s) { output += s; }
  void println(const char *s) { output += s; output += '\n'; }
  template<class... Args> void printf(const char *fmt, Args... args) {
    char line[2048]; std::snprintf(line, sizeof(line), fmt, args...); output += line;
  }
};
inline SerialStub Serial;
struct ESPStub {
  uint32_t getFreeHeap() { return 100000; }
  uint32_t getMinFreeHeap() { return 90000; }
};
inline ESPStub ESP;

#pragma once
#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>
#include <deque>
using String = std::string;
using std::max;
using portMUX_TYPE = int;
#define portMUX_INITIALIZER_UNLOCKED 0
#define portENTER_CRITICAL(lock) ((void)(lock))
#define portEXIT_CRITICAL(lock) ((void)(lock))
inline uint32_t fakeNow = 1000;
inline uint32_t millis() { return fakeNow; }
inline uint32_t micros() { return fakeNow * 1000; }
inline void delay(uint32_t ms) { fakeNow += ms; }
inline void randomSeed(uint32_t) {}
inline std::deque<long> fakeRandomChoices;
inline long random(long hi) {
  if (fakeRandomChoices.empty()) return hi ? hi - 1 : 0;
  const long choice = fakeRandomChoices.front(); fakeRandomChoices.pop_front();
  if (choice < 0 || choice >= hi) throw std::runtime_error("Invalid queued random choice");
  return choice;
}
inline long random(long lo, long hi) {
  return fakeRandomChoices.empty() ? lo + (hi - lo) / 2 : lo + random(hi - lo);
}
struct SerialStub {
  std::string output;
  std::deque<unsigned char> input;
  int available() { return int(input.size()); }
  int read() { if(input.empty())return -1;const int c=input.front();input.pop_front();return c; }
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

#include <Arduino.h>
#include <esp_system.h>
#include <stdarg.h>

// Serial isolation only: no BLE, MP3 playback, lighting or motor commands.
// ESP32 Dev Module, Arduino-ESP32 3.3.12, Serial Monitor 115200.
// Reproduce the controller's 60-second start and 21-second modeled-end cadence.
// Four cycles finish about 4 minutes 21 seconds after the startup banner.
const uint32_t CYCLE_INTERVAL_MS = 60000;
const uint32_t END_DELAY_MS = 21000;
const uint8_t TEST_CYCLES = 4;

uint32_t nextEventAt = 0;
uint32_t nextCycleAt = 0;
uint8_t cycle = 0;
bool endPending = false;
bool finished = false;

// Same bounded formatting and Serial.print path as the main controller.
void logEvent(const char *format, ...) {
  char line[384];
  const int prefix = snprintf(line, sizeof(line), "[%10lu ms] ", (unsigned long)millis());
  if (prefix < 0 || (size_t)prefix >= sizeof(line)) return;
  va_list args;
  va_start(args, format);
  vsnprintf(line + prefix, sizeof(line) - prefix, format, args);
  va_end(args);
  Serial.print(line);
}

void printBurst(const char *phase) {
  logEvent("SERIAL-ONLY cycle=%u phase=%s FIRST 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\n",
           (unsigned)cycle, phase);
  logEvent("SERIAL-ONLY cycle=%u phase=%s SECOND 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\n",
           (unsigned)cycle, phase);
  logEvent("SERIAL-ONLY heap=%lu minHeap=%lu; ASCII text only; no Skelly commands.\n",
           (unsigned long)ESP.getFreeHeap(), (unsigned long)ESP.getMinFreeHeap());
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  logEvent("BOOT SERIAL-IDLE-TEST-v1 resetReason=%u; no BLE, MP3, lighting or motors.\n",
           (unsigned)esp_reset_reason());
  logEvent("Wait 60 seconds for cycle 1. Four cycles; leave baud at 115200.\n");
  nextEventAt = millis() + CYCLE_INTERVAL_MS;
}

void loop() {
  const uint32_t now = millis();
  if (!finished && (int32_t)(now - nextEventAt) >= 0) {
    if (!endPending) {
      ++cycle;
      nextCycleAt = now + CYCLE_INTERVAL_MS;
      printBurst("START");
      endPending = true;
      nextEventAt = now + END_DELAY_MS;
    } else {
      printBurst("END"); // Timing label only: no audio was played.
      endPending = false;
      nextEventAt = nextCycleAt;
      if (cycle >= TEST_CYCLES) {
        finished = true;
        logEvent("SERIAL-IDLE-TEST COMPLETE: four cycles. Save the full output, including any garbled prefixes.\n");
      }
    }
  }
  delay(100);
}

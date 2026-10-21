# Serial-only isolation test

The lighting-OFF jaw run still produced corrupted text, so RGB F2/F3/F4 writes
are not required to trigger the symptom. The cause remains unknown. The new
`experiments/SerialIdleTest/SerialIdleTest.ino` uses the controller's same bounded
formatting/Serial.print path and its 60-second / 21-second logging cadence, without
initializing BLE or sending any commands to Skelly. This tests whether the symptom
also occurs without Bluetooth or MP3 playback; it is not a proposed controller fix.

1. Keep the current lighting-OFF diagnostic as a backup.
2. Open `experiments/SerialIdleTest/SerialIdleTest.ino` and upload using **ESP32 Dev
   Module**, Arduino-ESP32 **3.3.12**. Keep the same USB cable, port, computer and
   Arduino Serial Monitor for this comparison. Skelly need not be powered on.
3. Open Serial Monitor at **115200**. Confirm `BOOT SERIAL-IDLE-TEST-v1`.
   This sketch does not play the jaw MP3 or command the prop.
4. Wait about **4 minutes 21 seconds after the startup banner** for four cycles
   and `SERIAL-IDLE-TEST COMPLETE`. Each START and END prints FIRST, SECOND and
   heap lines. Copy the full output, including any garbled text.
5. Note whether corruption affects FIRST while SECOND remains readable. All
   application text in this sketch is ASCII with known letter/number patterns.

If corruption persists, BLE and MP3 playback are not required to reproduce it;
the shared formatter/UART/USB/monitor path still needs investigation. If it is
clean, that does not prove BLE caused the earlier failures: compare repeated
runs and, next, a second serial terminal at the same baud with the Arduino
monitor closed. The original received bytes are more useful than pasted Unicode
replacement characters for separating received data from display/decoding issues.

Do not change baud, cable, USB port and sketch together.

## October 21 result

The user supplied the complete four-cycle run, from BOOT at 1,010 ms through
COMPLETE at 262,197 ms. All eight FIRST/SECOND pairs and heap lines are readable,
with no replacement characters. Free heap remains 331,404 bytes and minimum heap
299,452 bytes throughout. This is a clean serial-only comparison on the tested
board. It does not establish a BLE cause, rule out an intermittent serial/capture
problem, or fix controller log corruption. Next repeat the lighting-OFF jaw
sketch with a second terminal and save original bytes; a BLE-connected/no-command
control can further isolate the difference if needed.

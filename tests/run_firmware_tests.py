"""Run actual firmware C++ with mocked clock/BLE/Serial. Requires C++17 g++ or MSVC.
Windows: run from a VS developer shell with CXX=cl. No ESP32 is connected.
"""
import os
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
compiler = os.environ.get("CXX", "g++")
sources = {
    "Canonical": (ROOT / "firmware/SkellyAutonomous/SkellyAutonomous.ino").read_text(encoding="utf-8"),
    "Generated": subprocess.check_output(
        [os.environ.get("NODE", "node"), str(ROOT / "studio/tests/export-host-fixture.cjs")],
        encoding="utf-8"),
}
harness = (ROOT / "tests/firmware_harness.cpp").read_text(encoding="utf-8")


def build_and_run(directory, source, assertions, label, expected_error=None):
    directory.mkdir(parents=True, exist_ok=True)
    unit = directory / "test.cpp"
    unit.write_text('#include <stdexcept>\n#include "Arduino.h"\n' + source + assertions, encoding="utf-8")
    exe = directory / ("test.exe" if os.name == "nt" else "test")
    if Path(compiler).stem.lower() == "cl":
        args = [compiler, "/nologo", "/std:c++17", "/EHsc", f"/I{ROOT / 'tests/stubs'}", str(unit), f"/Fe:{exe}", f"/Fo:{directory / 'test.obj'}"]
    else:
        args = [compiler, "-std=c++17", "-Wall", "-Wextra", "-I", str(ROOT / "tests/stubs"), str(unit), "-o", str(exe)]
    result = subprocess.run(args, check=expected_error is None,
                            capture_output=expected_error is not None, text=True)
    if expected_error is not None:
        if result.returncode == 0 or expected_error not in result.stdout + result.stderr:
            print("FAIL expected compile rejection: " + label, flush=True)
            return True
        print("PASS compile rejects " + label, flush=True)
        return False
    print(label, flush=True)
    return subprocess.run([str(exe)], check=False).returncode != 0


failed = False
for name, flags in [("Static", []), ("Mixed", ["--mixed"]), ("SingleEffect", ["--mixed", "--single"]), ("JawRestore", ["--mixed", "--jaw"])]:
    source = subprocess.check_output([os.environ.get("NODE", "node"), str(ROOT / "studio/tests/export-lighting-fixture.cjs"), *flags], encoding="utf-8")
    failed |= build_and_run(ROOT / (".skelly-build/host/Lighting" + name), source,
                            (ROOT / "tests/lighting_routines_harness.cpp").read_text(encoding="utf-8"),
                            "Lighting rotation/effects " + name)
audio_free = subprocess.check_output(
    [os.environ.get("NODE", "node"), str(ROOT / "studio/tests/export-host-fixture.cjs"), "--audio-free"], encoding="utf-8")
audio_free_assertions = """
const uint8_t expectedMotorMask = 7;
const uint16_t expectedFiles[] = {12};
const uint8_t expectedEyes[] = {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18};
const uint32_t expectedWindowMS = 1200000;
const bool expectQuick = false, expectJaw = false, expectEyes = true, expectLights = true, expectRest = true;
static_assert(!MOUTH_ENABLED, "Studio defaults must not require audio");
""" + (ROOT / "tests/attended_pack_harness.cpp").read_text(encoding="utf-8")
failed |= build_and_run(ROOT / ".skelly-build/host/AudioFreeStudio", audio_free, audio_free_assertions,
                        "Audio-free Studio: head/arm/torso/eyes/lights/rest without AAC6")
for name, mode in ((name, mode) for name in sources for mode in (0, 1, 2)):
    source = sources[name]
    directory = ROOT / ".skelly-build/host" / f"{name}Mode{mode}"
    configured = source.replace("const bool LIGHTS_ENABLED = false;", "const bool LIGHTS_ENABLED = true;")
    configured = configured.replace("const bool HEAD_ENABLED = true;", "const bool HEAD_ENABLED = false;")
    configured = configured.replace("const uint8_t LIGHT_RESTORE_MODE = 1;", f"const uint8_t LIGHT_RESTORE_MODE = {mode};")
    failed |= build_and_run(directory, configured, harness, f"{name} RESTORE MODE {mode}")
failed |= build_and_run(
    ROOT / ".skelly-build/host/SerialIdle",
    (ROOT / "experiments/SerialIdleTest/SerialIdleTest.ino").read_text(encoding="utf-8"),
    (ROOT / "tests/serial_idle_harness.cpp").read_text(encoding="utf-8"),
    "Serial-only idle diagnostic",
)
scheduler_harness = (ROOT / "tests/scheduler_harness.cpp").read_text(encoding="utf-8")
usb_harness = (ROOT / "tests/usb_scheduler_harness.cpp").read_text(encoding="utf-8")
usb_source = sources["Canonical"].replace("const bool ARM_ENABLED = false;", "const bool ARM_ENABLED = true;").replace("const bool TORSO_ENABLED = false;", "const bool TORSO_ENABLED = true;")
usb_source = usb_source.replace("const uint32_t MOUTH_MIN_INTERVAL_MS = 45000;", "const uint32_t MOUTH_MIN_INTERVAL_MS = 22000;").replace("const uint32_t MOUTH_MAX_INTERVAL_MS = 90000;", "const uint32_t MOUTH_MAX_INTERVAL_MS = 22000;")
usb_source = usb_source.replace("const bool LIGHTS_ENABLED = false;", "const bool LIGHTS_ENABLED = true;")
for fair in (False, True):
    configured = usb_source
    if fair:
        for before, after in [("FAIR_BODY_TURNS = false", "FAIR_BODY_TURNS = true"), ("PLAYBACK_DIAGNOSTICS = false", "PLAYBACK_DIAGNOSTICS = true"), ("CLOCK_WINDOW_ENABLED = false", "CLOCK_WINDOW_ENABLED = true"), ("CLOCK_START_MINUTE = 1080", "CLOCK_START_MINUTE = 1320"), ("CLOCK_END_MINUTE = 1380", "CLOCK_END_MINUTE = 120"), ("CLOCK_DAYS = 127", "CLOCK_DAYS = 32")]:
            configured = configured.replace(before, after)
    failed |= build_and_run(ROOT / f".skelly-build/host/UsbFair{fair}", configured, usb_harness, f"USB clock and fair turns {fair}")
generated_usb = subprocess.check_output([os.environ.get("NODE", "node"), str(ROOT / "studio/tests/export-usb-fixture.cjs")], encoding="utf-8")
failed |= build_and_run(ROOT / ".skelly-build/host/UsbGenerated", "#define TEST_FILE_DURATIONS\n" + generated_usb, usb_harness, "Generated USB/compound/fair/clip-duration fixture")
scheduler_source = sources["Canonical"].replace("const bool ARM_ENABLED = false;", "const bool ARM_ENABLED = true;")
scheduler_source = scheduler_source.replace("const bool TORSO_ENABLED = false;", "const bool TORSO_ENABLED = true;")
scheduler_source = scheduler_source.replace("const bool COMPOUND_BODY_ENABLED = false;", "const bool COMPOUND_BODY_ENABLED = true;")
failed |= build_and_run(ROOT / ".skelly-build/host/SchedulerCanonical", scheduler_source, scheduler_harness, "Canonical scheduler")
for name, source, message in [
    ("CompoundJawFirst", scheduler_source.replace("const uint8_t JAW_FOLLOWUP_MOTOR = 0;", "const uint8_t JAW_FOLLOWUP_MOTOR = 1;"),
     "Compound and jaw-first modes must be selected separately."),
    ("CompoundUnprotectedJaw", scheduler_source.replace("const bool JAW_PROTECTS_ARM_TORSO = true;", "const bool JAW_PROTECTS_ARM_TORSO = false;"),
     "Compound mode with jaw playback requires MP3 body protection."),
]:
    failed |= build_and_run(ROOT / ".skelly-build/host" / name, source, "", name, expected_error=message)
generated_scheduler = subprocess.check_output(
    [os.environ.get("NODE", "node"), str(ROOT / "studio/tests/export-scheduler-fixture.cjs")], encoding="utf-8")
failed |= build_and_run(ROOT / ".skelly-build/host/SchedulerGenerated",
                        "#define TEST_JAW_POOL\n" + generated_scheduler, scheduler_harness, "Generated scheduler and jaw pool")
pack_fixtures = []
for name, flags in [("attended-host-pack", []), ("quick-host-pack", ["--quick"])]:
    pack_dir = ROOT / ".skelly-build" / name
    subprocess.run([os.environ.get("NODE", "node"), str(ROOT / "scripts/export-attended-tests.cjs"), str(pack_dir), *flags], check=True)
    pack = json.loads((pack_dir / "manifest.json").read_text(encoding="utf-8"))
    pack_fixtures.extend((pack_dir, case, pack["quick"]) for case in pack["tests"])
for pack_dir, case, quick in pack_fixtures:
    c = case["config"]
    motor_mask = (1 if c["headEnabled"] else 0) | (2 if c["armEnabled"] else 0) | (4 if c["torsoEnabled"] else 0)
    files = [c["jawFile"]] + [int(n.strip()) for n in c["jawExtras"].split(",") if n.strip()]
    assertions = (
        f"\nconst uint8_t expectedMotorMask = {motor_mask};\n"
        f"const uint16_t expectedFiles[] = {{{', '.join(map(str, files))}}};\n"
        f"const uint8_t expectedEyes[] = {{{', '.join(map(str, c['eyeChoices']))}}};\n"
        f"const uint32_t expectedWindowMS = {int(case['minutes'] * 60000) if quick else 1200000};\n"
        f"const bool expectQuick = {str(quick).lower()};\n"
        + "".join(f"const bool {label} = {str(c[key]).lower()};\n" for label, key in
                  [("expectJaw", "jawEnabled"), ("expectEyes", "eyesEnabled"), ("expectLights", "lightsEnabled"), ("expectRest", "restEnabled")])
        + (ROOT / "tests/attended_pack_harness.cpp").read_text(encoding="utf-8")
    )
    failed |= build_and_run(
        ROOT / ".skelly-build/host" / case["name"],
        (pack_dir / case["name"] / (case["name"] + ".ino")).read_text(encoding="utf-8"),
        assertions, case["name"],
    )
raise SystemExit(1 if failed else 0)

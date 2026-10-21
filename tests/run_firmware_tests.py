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


def build_and_run(directory, source, assertions, label):
    directory.mkdir(parents=True, exist_ok=True)
    unit = directory / "test.cpp"
    unit.write_text('#include <stdexcept>\n#include "Arduino.h"\n' + source + assertions, encoding="utf-8")
    exe = directory / ("test.exe" if os.name == "nt" else "test")
    if Path(compiler).stem.lower() == "cl":
        args = [compiler, "/nologo", "/std:c++17", "/EHsc", f"/I{ROOT / 'tests/stubs'}", str(unit), f"/Fe:{exe}", f"/Fo:{directory / 'test.obj'}"]
    else:
        args = [compiler, "-std=c++17", "-Wall", "-Wextra", "-I", str(ROOT / "tests/stubs"), str(unit), "-o", str(exe)]
    subprocess.run(args, check=True)
    print(label, flush=True)
    return subprocess.run([str(exe)], check=False).returncode != 0


failed = False
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
pack_dir = ROOT / ".skelly-build/attended-host-pack"
subprocess.run([os.environ.get("NODE", "node"), str(ROOT / "scripts/export-attended-tests.cjs"), str(pack_dir)], check=True)
pack = json.loads((pack_dir / "manifest.json").read_text(encoding="utf-8"))
for case in pack["tests"]:
    c = case["config"]
    motor_mask = (1 if c["headEnabled"] else 0) | (2 if c["armEnabled"] else 0) | (4 if c["torsoEnabled"] else 0)
    files = [c["jawFile"]] + [int(n.strip()) for n in c["jawExtras"].split(",") if n.strip()]
    assertions = (
        f"\nconst uint8_t expectedMotorMask = {motor_mask};\n"
        f"const uint16_t expectedFiles[] = {{{', '.join(map(str, files))}}};\n"
        f"const uint8_t expectedEyes[] = {{{', '.join(map(str, c['eyeChoices']))}}};\n"
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

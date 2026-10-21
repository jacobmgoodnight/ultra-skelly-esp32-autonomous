"""Run actual firmware C++ with mocked clock/BLE/Serial. Requires C++17 g++ or MSVC.
Windows: run from a VS developer shell with CXX=cl. No ESP32 is connected.
"""
import os
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
failed = False
for name, mode in ((name, mode) for name in sources for mode in (0, 1, 2)):
    source = sources[name]
    directory = ROOT / ".skelly-build/host" / f"{name}Mode{mode}"
    directory.mkdir(parents=True, exist_ok=True)
    configured = source.replace("const bool LIGHTS_ENABLED = false;", "const bool LIGHTS_ENABLED = true;")
    configured = configured.replace("const bool HEAD_ENABLED = true;", "const bool HEAD_ENABLED = false;")
    configured = configured.replace("const uint8_t LIGHT_RESTORE_MODE = 1;", f"const uint8_t LIGHT_RESTORE_MODE = {mode};")
    unit = directory / "test.cpp"
    unit.write_text('#include <stdexcept>\n#include "Arduino.h"\n' + configured + harness, encoding="utf-8")
    exe = directory / ("test.exe" if os.name == "nt" else "test")
    if Path(compiler).stem.lower() == "cl":
        args = [compiler, "/nologo", "/std:c++17", "/EHsc", f"/I{ROOT / 'tests/stubs'}", str(unit), f"/Fe:{exe}", f"/Fo:{directory / 'test.obj'}"]
    else:
        args = [compiler, "-std=c++17", "-Wall", "-Wextra", "-I", str(ROOT / "tests/stubs"), str(unit), "-o", str(exe)]
    subprocess.run(args, check=True)
    print(f"{name} RESTORE MODE {mode}", flush=True)
    failed |= subprocess.run([str(exe)], check=False).returncode != 0
raise SystemExit(1 if failed else 0)

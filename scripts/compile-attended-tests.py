"""Compile exported test sources with one scratch sketch to reuse BLE libraries.
No upload or hardware access. Run export-attended-tests.cjs first.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--arduino-cli", default="arduino-cli")
parser.add_argument("--jobs", default=2, type=int)
parser.add_argument("--pack", default=str(ROOT / ".skelly-build/attended-tests"))
args = parser.parse_args()
platforms = json.loads(subprocess.check_output([args.arduino_cli, "core", "list", "--format", "json"], text=True))
if not any(p.get("id") == "esp32:esp32" and p.get("installed_version") == "3.3.12" for p in platforms.get("platforms", [])):
    raise SystemExit("Install pinned esp32:esp32@3.3.12 before compiling the test pack.")
pack = Path(args.pack).resolve()
manifest = json.loads((pack / "manifest.json").read_text(encoding="utf-8"))
scratch = ROOT / ".skelly-build/attended-compile/AttendedCompile"
scratch.mkdir(parents=True, exist_ok=True)
results = []
for test in manifest["tests"]:
    source = (pack / test["name"] / (test["name"] + ".ino")).read_bytes()
    if hashlib.sha256(source).hexdigest() != test["sha256"]:
        raise SystemExit("Exported source changed: " + test["name"])
    (scratch / "AttendedCompile.ino").write_bytes(source)
    print("Compiling " + test["name"], flush=True)
    subprocess.run([args.arduino_cli, "compile", "--jobs", str(args.jobs),
                    "--fqbn", "esp32:esp32:esp32", "--build-path", str(scratch.parent / "cache"), str(scratch)], check=True)
    results.append({"name": test["name"], "sha256": test["sha256"], "result": "compiled"})
(pack / "compile-results.json").write_text(json.dumps({"core": "3.3.12", "board": "esp32:esp32:esp32", "results": results}, indent=2) + "\n", encoding="utf-8")
print(f"PASS {len(manifest['tests'])} attended sketches on ESP32 core 3.3.12", flush=True)

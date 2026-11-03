"""Optional Windows launcher smoke on isolated ports; no browser or audio."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import time
import tkinter as tk

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('launcher', ROOT / 'scripts/skelly-live-launcher.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


def main():
    if sys.platform != 'win32':
        raise SystemExit('This launcher test requires Windows.')
    if any(launcher.occupied(port) for port in (18776, 18777, 18778)):
        raise SystemExit('Smoke-test ports are occupied; no process was started.')
    launcher.URL = 'http://127.0.0.1:18777/'
    launcher.LAUNCHER_PORT = 18778
    real_probe, real_popen = launcher.occupied, subprocess.Popen
    launcher.occupied = lambda port: real_probe({8776: 18776, 8777: 18777}.get(port, port))
    def isolated_popen(args, **kwargs):
        return real_popen([*args, '--port', '18777', '--model-port', '18776'], **kwargs)
    launcher.subprocess.Popen = isolated_popen
    window = tk.Tk()
    window.withdraw()
    app = launcher.Launcher(window)
    app.open_page = lambda: None
    started, failure = time.monotonic(), []
    launcher.messagebox.showwarning = lambda title, message: failure.append(message)
    def poll():
        if app.token:
            app.close()
        elif time.monotonic() - started > 110 or (app.process and app.process.poll() is not None):
            failure.append(app.message.get())
            app.close()
        else:
            window.after(200, poll)
    window.after(200, poll)
    window.mainloop()
    if failure or not app.process or app.process.poll() is None:
        raise RuntimeError('Launcher startup/shutdown smoke failed: ' + '; '.join(failure))
    if app.process.returncode != 0 or real_probe(18776) or real_probe(18777):
        raise RuntimeError('An owned companion or model did not stop cleanly.')
    print('PASS: Windows launcher started and gracefully stopped its local companion and model. No browser, audio or Bluetooth used.')


if __name__ == '__main__':
    main()

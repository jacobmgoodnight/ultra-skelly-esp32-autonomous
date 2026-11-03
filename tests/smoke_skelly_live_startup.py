"""Optional real local startup/shutdown smoke, using isolated loopback ports.

This does not open a microphone, play audio, connect to Bluetooth, or send a
conversation request. It needs the prepared local models and runtimes.
"""
import importlib.util
import json
import os
import secrets
from pathlib import Path
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PORT, MODEL_PORT = 18777, 18776
BASE = f'http://127.0.0.1:{PORT}'


def occupied(port):
    with socket.socket() as probe:
        probe.settimeout(.3)
        return probe.connect_ex(('127.0.0.1', port)) == 0


def main():
    if any(occupied(port) for port in (PORT, MODEL_PORT)):
        raise SystemExit('Smoke-test ports are occupied; no process was started.')
    spec = importlib.util.spec_from_file_location('launcher', ROOT / 'scripts/skelly-live-launcher.py')
    launcher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(launcher)
    job = launcher.OwnedJob()  # Own descendants even if startup fails.
    launch_id = secrets.token_urlsafe(32)
    child = subprocess.Popen([sys.executable, str(ROOT / 'experiments/pocket-conversation/chat_server.py'),
        '--voice', 'piper', '--skip-warmup', '--port', str(PORT), '--model-port', str(MODEL_PORT)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        env=dict(os.environ, SKELLY_LAUNCHER_INSTANCE=launch_id))
    token = None
    try:
        deadline = time.monotonic() + 100
        while time.monotonic() < deadline:
            if child.poll() is not None:
                raise RuntimeError('Companion exited before becoming ready.')
            try:
                with urllib.request.urlopen(BASE + '/api/status', timeout=2) as response:
                    status = json.loads(response.read(8193))
                if status.get('launcherInstance') != launch_id:
                    raise RuntimeError('The test port belongs to another process.')
                if status.get('conversation') is not True or status.get('ready') is not True or status.get('modelLoaded') is not True:
                    raise RuntimeError('The local conversation model did not become ready.')
                if status.get('tones') != ['natural'] or not any(name in status.get('voice', '') for name in ('Piper', 'Windows voice')):
                    raise RuntimeError('Unexpected local voice configuration.')
                token = status['token']
                break
            except (OSError, urllib.error.URLError):
                time.sleep(.5)
        if not token:
            raise RuntimeError('The local companion did not become ready within 100 seconds.')
        request = urllib.request.Request(BASE + '/api/shutdown', data=b'', method='POST', headers={'X-Skelly-Token': token})
        with urllib.request.urlopen(request, timeout=5) as response:
            if response.status != 200:
                raise RuntimeError('The companion did not accept shutdown.')
        child.wait(timeout=15)
        if child.returncode != 0:
            raise RuntimeError('The companion exited unsuccessfully.')
        print('PASS: local model and Piper/Windows voice ready; companion and owned model stopped. No audio or hardware used.')
    finally:
        # Windows closes the job at interpreter exit if a failure left children.
        pass


if __name__ == '__main__':
    main()

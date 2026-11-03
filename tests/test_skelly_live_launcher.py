import importlib.util
import json
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('skelly_live_launcher', Path(__file__).resolve().parents[1] / 'scripts/skelly-live-launcher.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LauncherChecks(unittest.TestCase):
    def test_port_probe_distinguishes_listening_and_closed(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            sock.listen()
            port = sock.getsockname()[1]
            self.assertTrue(launcher.occupied(port))
        self.assertFalse(launcher.occupied(port))

    def test_status_requires_ready_conversation(self):
        class Response:
            def __init__(self, data): self.data = data
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return json.dumps(self.data).encode()
        with patch.object(launcher.urllib.request, 'urlopen', return_value=Response({'ready': True, 'conversation': True, 'processId': 42})):
            self.assertEqual(launcher.status()['processId'], 42)
        with patch.object(launcher.urllib.request, 'urlopen', return_value=Response({'ready': True, 'conversation': False})):
            with self.assertRaises(ValueError): launcher.status()
        with patch.object(launcher.urllib.request, 'urlopen', return_value=Response([])):
            with self.assertRaises(ValueError): launcher.status()

    def test_occupied_companion_port_never_starts_or_stops_a_process(self):
        instance = object.__new__(launcher.Launcher)
        instance.lock = threading.Lock()
        instance.closing = False
        messages = []
        instance.report = messages.append
        with patch.object(launcher, 'claim_launcher_port', return_value=object()), patch.object(launcher, 'occupied', return_value=True), patch.object(launcher.subprocess, 'Popen') as start:
            instance.start_worker()
        start.assert_not_called()
        self.assertIn('8777 is already in use', messages[0])
        self.assertIn('No process was stopped', messages[0])

    def test_launcher_reservation_is_exclusive_until_released(self):
        with patch.object(launcher, 'LAUNCHER_PORT', 0):
            first = launcher.claim_launcher_port()
        try:
            with patch.object(launcher, 'LAUNCHER_PORT', first.getsockname()[1]):
                with self.assertRaises(OSError): launcher.claim_launcher_port()
        finally:
            first.close()

    def test_shutdown_does_not_send_token_to_a_replacement_service(self):
        instance = object.__new__(launcher.Launcher)
        instance.process = Mock()
        instance.process.poll.return_value = None
        instance.process.wait.return_value = 0
        instance.token = 'owned-token'
        instance.launch_id = 'owned-instance'
        instance.window = Mock()
        with patch.object(launcher, 'status', return_value={'launcherInstance': 'other-instance', 'token': 'other-token'}), patch.object(launcher.urllib.request, 'urlopen') as request:
            instance.close_worker()
        request.assert_not_called()
        instance.process.wait.assert_called_once()

    @unittest.skipUnless(sys.platform == 'win32', 'Windows job objects are required')
    def test_unexpected_launcher_exit_reaps_its_child(self):
        # A child would write this marker after the owner exits if it survived.
        with tempfile.TemporaryDirectory() as folder:
            marker = Path(folder) / 'survived.txt'
            script = ("import importlib.util, subprocess, sys, os; "
                f"s=importlib.util.spec_from_file_location('launcher', {str(Path(launcher.__file__))!r}); "
                "m=importlib.util.module_from_spec(s); s.loader.exec_module(m); job=m.OwnedJob(); "
                f"subprocess.Popen([sys.executable, '-c', {('import time,pathlib; time.sleep(2); pathlib.Path(' + repr(str(marker)) + ').write_text("survived")')!r}]); "
                "os._exit(0)")
            subprocess.run([sys.executable, '-c', script], check=True, timeout=10)
            time.sleep(3)
            self.assertFalse(marker.exists(), 'The owned child survived launcher exit.')


if __name__ == '__main__':
    unittest.main()

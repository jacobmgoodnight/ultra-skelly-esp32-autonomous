"""Local Windows launcher for the experimental conversational companion."""
import json
import ctypes
from ctypes import wintypes
import os
import secrets
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import urllib.parse
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import messagebox

ROOT = Path(__file__).resolve().parent.parent
URL = 'http://127.0.0.1:8777/'
COMPANION = ROOT / 'experiments/pocket-conversation/chat_server.py'
LAUNCHER_PORT = 8778


def claim_launcher_port():
    """Atomically reserve one launcher across startup, not just after bind."""
    sock = socket.socket()
    try:
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        sock.bind(('127.0.0.1', LAUNCHER_PORT))
        sock.listen(1)
        return sock
    except OSError:
        sock.close()
        raise


class OwnedJob:
    """Windows closes this job on launcher exit, reaping its process tree."""
    def __init__(self):
        class BasicLimits(ctypes.Structure):
            _fields_ = [('process_time', ctypes.c_longlong), ('job_time', ctypes.c_longlong),
                ('flags', wintypes.DWORD), ('min_working', ctypes.c_size_t), ('max_working', ctypes.c_size_t),
                ('active_limit', wintypes.DWORD), ('affinity', ctypes.c_size_t),
                ('priority', wintypes.DWORD), ('scheduling', wintypes.DWORD)]
        class IoCounters(ctypes.Structure):
            _fields_ = [(name, ctypes.c_ulonglong) for name in
                ('reads', 'writes', 'other', 'read_bytes', 'write_bytes', 'other_bytes')]
        class ExtendedLimits(ctypes.Structure):
            _fields_ = [('basic', BasicLimits), ('io', IoCounters), ('process_memory', ctypes.c_size_t),
                ('job_memory', ctypes.c_size_t), ('peak_process_memory', ctypes.c_size_t), ('peak_job_memory', ctypes.c_size_t)]
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
        kernel.CreateJobObjectW.restype = wintypes.HANDLE
        kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        kernel.SetInformationJobObject.restype = wintypes.BOOL
        kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        kernel.AssignProcessToJobObject.restype = wintypes.BOOL
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel.CreateJobObjectW(None, None)
        if not handle:
            raise ctypes.WinError(ctypes.get_last_error())
        limits = ExtendedLimits()
        limits.basic.flags = 0x00002000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not kernel.SetInformationJobObject(handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)) or not kernel.AssignProcessToJobObject(handle, kernel.GetCurrentProcess()):
            error = ctypes.get_last_error()
            kernel.CloseHandle(handle)
            raise ctypes.WinError(error)
        # Keep this non-inheritable handle open for the life of this process.
        self.handle = handle


def occupied(port):
    with socket.socket() as sock:
        sock.settimeout(.3)
        return sock.connect_ex(('127.0.0.1', port)) == 0


def status():
    request = urllib.request.Request(URL + 'api/status', headers={'Host': urllib.parse.urlsplit(URL).netloc})
    with urllib.request.urlopen(request, timeout=2) as response:
        data = json.loads(response.read(8193))
    if not isinstance(data, dict) or data.get('conversation') is not True or data.get('ready') is not True:
        raise ValueError('The service on port 8777 is not a ready conversation companion.')
    return data


class Launcher:
    def __init__(self, window):
        self.window = window
        self.process = None
        self.token = None
        self.launch_id = None
        self.closing = False
        self.lock = threading.Lock()
        self.lease = None
        self.job = None
        window.title('Skelly Live')
        window.geometry('620x330')
        window.minsize(560, 270)
        frame = tk.Frame(window, padx=22, pady=18)
        frame.pack(fill='both', expand=True)
        tk.Label(frame, text='Skelly Live', font=('Segoe UI', 20, 'bold')).pack(anchor='w')
        self.message = tk.StringVar(value='Checking local services. The microphone is off.')
        tk.Label(frame, textvariable=self.message, justify='left', wraplength=530,
                 font=('Segoe UI', 10)).pack(anchor='w', pady=12)
        self.open_button = tk.Button(frame, text='Open Skelly Live', state='disabled', command=self.open_page)
        self.open_button.pack(side='left', padx=(0, 10))
        tk.Button(frame, text='Stop and exit', command=self.close).pack(side='left')
        window.protocol('WM_DELETE_WINDOW', self.close)
        window.after(100, self.start)

    def report(self, text):
        if not self.closing:
            self.window.after(0, lambda: self.message.set(text) if not self.closing else None)

    def start(self):
        threading.Thread(target=self.start_worker, daemon=True).start()

    def start_worker(self):
        try:
            with self.lock:
                if self.closing:
                    return
                self.lease = claim_launcher_port()
        except OSError:
            self.report('Another Skelly Live launcher or an application is using port 8778. Close it normally before starting another. No process was stopped.')
            return
        if not COMPANION.is_file():
            self.report('Conversation companion is missing. Restore the local conversation files and retry. See docs/skelly-live-operator.md.')
            return
        # A foreign service is never shut down, even if it resembles a companion.
        if occupied(8777):
            self.report('Port 8777 is already in use. A companion may already be running. Close its launcher normally, or use its existing page. No process was stopped.')
            return
        if occupied(8776):
            self.report('Port 8776 is already in use. Close the other conversation model or application normally, then restart Skelly Live. No process was stopped.')
            return
        legacy = [str(port) for port in (8765, 8766, 8767) if occupied(port)]
        warning = (' Other local service ports in use: ' + ', '.join(legacy) + '.') if legacy else ''
        try:
            with self.lock:
                if self.closing:
                    return
                # Join the job before starting the child, so it and every
                # descendant are owned even if startup never opens HTTP.
                self.job = OwnedJob()
                self.launch_id = secrets.token_urlsafe(32)
                child_env = dict(os.environ, SKELLY_LAUNCHER_INSTANCE=self.launch_id)
                python = str(Path(sys.executable).with_name('python.exe'))
                self.process = subprocess.Popen([python, str(COMPANION), '--voice', 'piper', '--skip-warmup'], cwd=ROOT,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace',
                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), env=child_env)
            lines = []
            def drain():
                for line in self.process.stdout:
                    lines.append(line.strip()[:400])
                    del lines[:-12]
            threading.Thread(target=drain, daemon=True).start()
            deadline = time.monotonic() + 100
            while time.monotonic() < deadline and not self.closing:
                if self.process.poll() is not None:
                    detail = next((line for line in reversed(lines) if line), 'No startup details available.')
                    self.report('Companion failed to start: ' + detail + '\nSee docs/skelly-live-operator.md for missing runtime or model setup.')
                    return
                try:
                    result = status()
                    if result.get('launcherInstance') != self.launch_id:
                        raise ValueError('Port belongs to another process.')
                    self.token = result['token']
                    brain = 'Local model is running.' if result.get('modelLoaded') is True else 'Local model is stopped; the next turn may reload it.'
                    self.report('Local companion connected. ' + brain + ' Microphone off. Check the speaker and microphone in the browser.' + warning)
                    self.window.after(0, self.ready)
                    return
                except (OSError, ValueError, KeyError, urllib.error.URLError):
                    time.sleep(.5)
            if not self.closing:
                self.report('Companion did not become ready in 100 seconds. Choose Stop and exit, then review the local model and runtime setup.')
        except OSError as error:
                self.report('Could not start the local companion or secure its process cleanup: ' + str(error) + '\nCheck the local Python environment and setup notes.')

    def ready(self):
        if not self.closing:
            self.open_button.config(state='normal')
            self.open_page()
            self.window.after(3000, self.monitor)

    def monitor(self):
        if self.closing:
            return
        if self.process and self.process.poll() is not None:
            self.open_button.config(state='disabled')
            self.message.set('The companion stopped. Choose Stop and exit, then launch Skelly Live again. The microphone is controlled by the browser.')
        else:
            self.window.after(3000, self.monitor)

    def open_page(self):
        if not webbrowser.open(URL):
            messagebox.showerror('Skelly Live', 'Could not open the browser. Open http://127.0.0.1:8777/ in desktop Chrome or Edge.')

    def close(self):
        if self.closing:
            return
        with self.lock:
            self.closing = True
        self.message.set('Stopping the companion and its owned model…')
        self.open_button.config(state='disabled')
        threading.Thread(target=self.close_worker, daemon=True).start()

    def close_worker(self):
        process = self.process
        if process and process.poll() is None:
            # Startup can still be loading its model. Wait for our own server's
            # token so that it can close its children through its normal path.
            deadline = time.monotonic() + 15
            while not self.token and process.poll() is None and time.monotonic() < deadline:
                try:
                    result = status()
                    if result.get('launcherInstance') == self.launch_id:
                        self.token = result['token']
                        break
                except (OSError, ValueError, KeyError, urllib.error.URLError):
                    pass
                time.sleep(.5)
            if self.token:
                try:
                    current = status()
                    if current.get('launcherInstance') == self.launch_id and current.get('token') == self.token:
                        request = urllib.request.Request(URL + 'api/shutdown', data=b'', method='POST',
                            headers={'Host': urllib.parse.urlsplit(URL).netloc, 'X-Skelly-Token': self.token})
                        with urllib.request.urlopen(request, timeout=3) as response:
                            response.read(1024)
                except (OSError, ValueError, KeyError, urllib.error.URLError):
                    pass
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                # Do not kill unknown processes or claim their model stopped.
                def warn():
                    messagebox.showwarning('Skelly Live', 'The companion did not stop normally. Closing this launcher will force Windows to close its owned companion and model. Check that live audio has stopped before returning to autonomy.')
                    self.window.destroy()
                self.window.after(0, warn)
                return
        self.window.after(0, self.window.destroy)


if __name__ == '__main__':
    try:
        root = tk.Tk()
        Launcher(root)
        root.mainloop()
    except Exception as error:
        ctypes.windll.user32.MessageBoxW(None, 'Skelly Live could not open: ' + str(error) + '\nSee docs/skelly-live-operator.md.', 'Skelly Live', 0x10)
        raise

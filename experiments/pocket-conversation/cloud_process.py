"""Owned, cancellable cloud helper processes with bounded ephemeral I/O."""
import json
import os
import subprocess
import tempfile

from pocket_voice import check

MAX_INPUT_BYTES = 16384
SECRET_NAMES = frozenset(('SKELLY_ANTHROPIC_API_KEY', 'SKELLY_ELEVENLABS_API_KEY', 'SKELLY_GROQ_API_KEY'))


def run_worker(command, payload, secret_env, cancel, deadline, max_output_bytes=32768):
    """Return bounded child stdout; messages use stdin and secrets use env only.

    Anonymous temporary files avoid pipe backpressure. They close and disappear
    after this call; they are not transcript logs. Only this owned child is ever
    killed. Network cancellation does not leave a request thread running.
    """
    check(cancel, deadline)
    if (not isinstance(command, (list, tuple)) or not command
            or any(not isinstance(part, str) or not part or '\x00' in part for part in command)):
        raise ValueError('Invalid cloud worker command.')
    if (not isinstance(max_output_bytes, int) or isinstance(max_output_bytes, bool)
            or not 1 <= max_output_bytes <= 16 * 1024 * 1024):
        raise ValueError('Invalid cloud worker output bound.')
    if not isinstance(secret_env, dict) or set(secret_env) - SECRET_NAMES:
        raise ValueError('Invalid cloud worker credentials.')
    if any(not isinstance(value, str) or not value or len(value) > 2048
           or any(ord(char) < 33 or ord(char) > 126 for char in value)
           for value in secret_env.values()):
        raise ValueError('Invalid cloud worker credentials.')
    data = json.dumps(payload, ensure_ascii=True, allow_nan=False, separators=(',', ':')).encode('utf-8')
    if not 1 <= len(data) <= MAX_INPUT_BYTES:
        raise ValueError('Cloud worker input exceeds its bound.')
    # Do not inherit other providers' credentials, proxies, Python injection
    # variables or unrelated application configuration into a network worker.
    inherited = ('SystemRoot', 'WINDIR', 'PATH', 'PATHEXT', 'TEMP', 'TMP')
    environment = {name: os.environ[name] for name in inherited if name in os.environ}
    environment.update(PYTHONUTF8='1', PYTHONDONTWRITEBYTECODE='1')
    environment.update(secret_env)
    process = None
    with tempfile.TemporaryFile(mode='w+b') as source, tempfile.TemporaryFile(mode='w+b') as output:
        source.write(data)
        source.seek(0)
        try:
            check(cancel, deadline)
            process = subprocess.Popen(list(command), stdin=source, stdout=output,
                stderr=subprocess.DEVNULL, env=environment,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            while process.poll() is None:
                check(cancel, deadline)
                if os.fstat(output.fileno()).st_size > max_output_bytes:
                    raise ValueError('Cloud worker output exceeds its bound.')
                cancel.wait(.025)
            check(cancel, deadline)
            if process.returncode != 0:
                raise RuntimeError('Cloud worker request failed.')
            if os.fstat(output.fileno()).st_size > max_output_bytes:
                raise ValueError('Cloud worker output exceeds its bound.')
            output.seek(0)
            result = output.read(max_output_bytes + 1)
            if not result or len(result) > max_output_bytes:
                raise ValueError('Invalid bounded cloud worker output.')
            return result
        finally:
            if process is not None:
                if process.poll() is None:
                    process.kill()
                process.wait(timeout=2)


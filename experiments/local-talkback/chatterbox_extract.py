"""Extract the pinned Chatterbox test source without links or path traversal."""
from pathlib import Path, PurePosixPath
import stat
import zipfile


def safe_extract(archive, destination):
    with zipfile.ZipFile(archive) as source:
        members = source.infolist()
        if sum(entry.file_size for entry in members) > 100_000_000:
            raise ValueError('Oversized source archive')
        for entry in members:
            path = PurePosixPath(entry.filename)
            if path.is_absolute() or '..' in path.parts or '\\' in entry.filename or ':' in entry.filename or stat.S_ISLNK(entry.external_attr >> 16):
                raise ValueError('Unsafe source archive entry')
        source.extractall(destination)


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2] / '.skelly-build' / 'local-talkback'
    safe_extract(root / 'chatterbox-source-5de7a54.zip', root)
    print('Extracted pinned source into the project test folder.')

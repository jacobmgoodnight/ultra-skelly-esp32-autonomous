"""Safe archive extraction for the optional local speech experiment."""
import importlib.util
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('chatterbox_extract', Path(__file__).resolve().parents[1] / 'experiments/local-talkback/chatterbox_extract.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExtractionTests(unittest.TestCase):
    def test_regular_source_extracts_inside_destination(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = root / 'source.zip'
            dest = root / 'out'
            with zipfile.ZipFile(archive, 'w') as source:
                source.writestr('source/example.py', 'safe')
            module.safe_extract(archive, dest)
            self.assertEqual((dest / 'source/example.py').read_text(), 'safe')

    def test_rejects_traversal_absolute_and_symlink_entries_before_extraction(self):
        for name, link in [('../outside.txt', False), ('/absolute.txt', False), ('C:/outside.txt', False), ('..\\outside.txt', False), ('source/link', True)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                archive, dest = root / 'source.zip', root / 'out'
                with zipfile.ZipFile(archive, 'w') as source:
                    source.writestr('source/valid.py', 'no partial extraction')
                    info = zipfile.ZipInfo(name)
                    info.filename = name  # ZipInfo normalizes Windows separators on construction.
                    if link:
                        info.create_system = 3
                        info.external_attr = (stat.S_IFLNK | 0o777) << 16
                    source.writestr(info, 'bad')
                with self.assertRaises(ValueError):
                    module.safe_extract(archive, dest)
                self.assertFalse((dest / 'source/valid.py').exists())
                self.assertFalse((root / 'outside.txt').exists())


if __name__ == '__main__':
    unittest.main()

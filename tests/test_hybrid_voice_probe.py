"""Software-only checks of the isolated, not-integrated routing probe."""
import hashlib
import importlib.util
import io
import sys
import unittest
import wave
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'experiments/voice-research/hybrid_probe.py'
spec = importlib.util.spec_from_file_location('hybrid_probe', path)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


def valid_wave():
    data = io.BytesIO()
    with wave.open(data, 'wb') as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(22050)
        out.writeframes(b'\x01\x00' * 2205)
    return data.getvalue()


class HybridProbeTests(unittest.TestCase):
    def test_reviewed_matching_audio_is_used(self):
        wave_bytes = valid_wave()
        text = module.REPLIES[3][1]
        recording = module.Recording(text, wave_bytes, hashlib.sha256(wave_bytes).hexdigest(), True)
        self.assertEqual(module.route(3, 1, {(3, 1): recording}), ('recorded', text, wave_bytes))

    def test_absent_unapproved_changed_and_invalid_audio_fall_back(self):
        wave_bytes = valid_wave(); text = module.REPLIES[3][1]
        digest = hashlib.sha256(wave_bytes).hexdigest()
        variants = [None, module.Recording(text, wave_bytes, digest),
                    module.Recording('stale text', wave_bytes, digest, True),
                    module.Recording(text, wave_bytes, '0' * 64, True),
                    module.Recording(text, b'bad', hashlib.sha256(b'bad').hexdigest(), True)]
        for entry in variants:
            source, result, clip = module.route(3, 1, {(3, 1): entry})
            self.assertEqual((source, result, clip), ('live', text, None))

    def test_names_and_ids_never_enter_recording_lookup(self):
        source, text, clip = module.route(3, 1, {}, 'Emma')
        self.assertEqual(source, 'live'); self.assertTrue(text.startswith('Hi, Emma! ')); self.assertIsNone(clip)
        for args in [(True, 1, {}, ''), (3, 4, {}, ''), (3, 1, {}, 'NotAllowlisted')]:
            with self.assertRaises(ValueError): module.route(*args)


if __name__ == '__main__': unittest.main()

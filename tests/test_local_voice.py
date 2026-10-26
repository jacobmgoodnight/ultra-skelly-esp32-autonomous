"""Pure local voice contract tests: no runtime, microphone, output or model needed."""
import importlib.util
import io
import struct
import subprocess
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('local_voice', Path(__file__).resolve().parents[1] / 'experiments/local-talkback/voice.py')
voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voice)


def audio(rate=22050, seconds=1, channels=1, sample=0):
    result = io.BytesIO()
    with wave.open(result, 'wb') as stream:
        stream.setnchannels(channels)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes(struct.pack('<h', sample) * round(rate * seconds) * channels)
    return result.getvalue()


def neural_files(root):
    (root / 'piper').mkdir()
    for path in ['piper/piper.exe', 'en_US-joe-medium.onnx', 'en_US-joe-medium.onnx.json']:
        (root / path).touch()


def samples(data):
    with wave.open(io.BytesIO(data)) as stream:
        rate = stream.getframerate()
        pcm = stream.readframes(stream.getnframes())
    return rate, struct.unpack('<' + 'h' * (len(pcm) // 2), pcm)


class VoiceTests(unittest.TestCase):
    def test_reply_limits_keep_neural_sample_rate_and_eight_second_duration(self):
        for rate in (16000, 22050):
            voice.validate_reply_wave(audio(rate, 8))
        for data in [b'', audio(24000), audio(22050, 8.01), audio(16000, 8.01), audio(channels=2), audio()[:-10]]:
            with self.assertRaises(ValueError):
                voice.validate_reply_wave(data)
        self.assertEqual(voice.MAX_REPLY_WAV, 352844)

    def test_neural_voice_uses_fixed_local_files_and_only_approved_text_on_stdin(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'piper').mkdir()
            for path in ['piper/piper.exe', 'en_US-joe-medium.onnx', 'en_US-joe-medium.onnx.json']:
                (root / path).touch()
            calls = []

            def runner(command, **options):
                calls.append((command, options))
                Path(command[command.index('--output_file') + 1]).write_bytes(audio())

            engine = voice.LocalVoice(root, runner)
            self.assertTrue(engine.neural)
            self.assertIn('neural', engine.label)
            engine.synthesize('Hi, Emma! What a boo tiful day!', root)
            command, options = calls[0]
            self.assertEqual(command[0], str(root / 'piper/piper.exe'))
            self.assertEqual(command[command.index('--model') + 1], str(root / 'en_US-joe-medium.onnx'))
            self.assertEqual(options['input'], 'Hi, Emma! What a boo tiful day!\n')
            self.assertGreater(options['timeout'], 0)
            self.assertLessEqual(options['timeout'], 10)
            self.assertEqual(options['stdout'], subprocess.DEVNULL)
            self.assertNotIn('shell', options)
            for text in ['', 'x' * 181, 'bad\nline', None]:
                with self.assertRaises(ValueError):
                    engine.synthesize(text, root)
            self.assertEqual(len(calls), 1)

    def test_basic_fallback_is_visible_and_neural_failure_never_silently_switches(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            calls = []

            def basic(command, **options):
                calls.append(command)
                self.assertEqual(Path(command[command.index('-TextFile') + 1]).read_text(encoding='utf-8'), 'Boo there, friend!')
                Path(command[command.index('-WaveFile') + 1]).write_bytes(audio(16000))

            fallback = voice.LocalVoice(root, basic)
            self.assertFalse(fallback.neural)
            self.assertIn('basic fallback', fallback.label)
            fallback.synthesize('Boo there, friend!', root)
            self.assertEqual(calls[0][0], 'powershell.exe')
            (root / 'piper').mkdir()
            for path in ['piper/piper.exe', 'en_US-joe-medium.onnx', 'en_US-joe-medium.onnx.json']:
                (root / path).touch()

            def failing(*args, **kwargs):
                raise subprocess.TimeoutExpired('piper', 10)

            neural = voice.LocalVoice(root, failing)
            with self.assertRaises(subprocess.TimeoutExpired):
                neural.synthesize('Boo there, friend!', root)
            self.assertTrue(neural.neural)

    def test_joke_keeps_approved_words_and_inserts_a_punchline_pause(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            neural_files(root)
            calls = []

            def runner(command, **options):
                calls.append((command, options))
                sample = 1000 if len(calls) == 1 else 4000
                Path(command[command.index('--output_file') + 1]).write_bytes(audio(seconds=.2, sample=sample))

            text = 'Hi, Emma! Why did the ghost wear glasses? To improve its spook tacles!'
            result = voice.LocalVoice(root, runner).synthesize(text, root)
            self.assertEqual([options['input'] for _, options in calls], [
                'Hi, Emma! Why did the ghost wear glasses?\n',
                'To improve its spook tacles!\n',
            ])
            self.assertEqual([command[command.index('--length_scale') + 1] for command, _ in calls], ['0.99', '0.88'])
            rate, pcm = samples(result)
            self.assertEqual(rate, 22050)
            gaps = []
            start = None
            for index, sample in enumerate(pcm):
                if sample == 0 and start is None:
                    start = index
                elif sample != 0 and start is not None:
                    gaps.append((start, index))
                    start = None
            gap_start, gap_end = max(gaps, key=lambda gap: gap[1] - gap[0])
            self.assertGreaterEqual(gap_end - gap_start, round(rate * .4))
            self.assertLessEqual(gap_end - gap_start, round(rate * .4) + 2)
            self.assertGreater(max(pcm[:gap_start]), 900)
            self.assertLess(max(pcm[:gap_start]), 1100)
            self.assertGreater(max(pcm[gap_end:]), 3900)
            voice.validate_reply_wave(result)

    def test_only_a_nonempty_punchline_splits_and_only_at_the_first_question(self):
        phrases = [
            ('Boo there, friend!', ['Boo there, friend!']),
            ('Why was the ghost late?', ['Why was the ghost late?']),
            ('Why was the ghost late?   ', ['Why was the ghost late?   ']),
            ('? Just a punchline.', ['? Just a punchline.']),
            ('Why was the ghost late? Traffic!', ['Why was the ghost late?', 'Traffic!']),
            ('Why was the ghost late? Another question? Boo!', ['Why was the ghost late?', 'Another question? Boo!']),
        ]
        for text, expected in phrases:
            with self.subTest(text=text), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                neural_files(root)
                spoken = []

                def runner(command, **options):
                    spoken.append(options['input'])
                    Path(command[command.index('--output_file') + 1]).write_bytes(audio(seconds=.1, sample=1000))

                voice.LocalVoice(root, runner).synthesize(text, root)
                self.assertEqual(spoken, [part + '\n' for part in expected])
                self.assertLessEqual(len(spoken), 2)

    def test_segmented_synthesis_shares_one_total_deadline(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            neural_files(root)
            clock, timeouts = [100.0], []

            def runner(command, **options):
                timeouts.append(options['timeout'])
                Path(command[command.index('--output_file') + 1]).write_bytes(audio(seconds=.1, sample=1000))
                clock[0] += 6 if len(timeouts) == 1 else 2

            with patch.object(voice.time, 'monotonic', side_effect=lambda: clock[0]):
                voice.LocalVoice(root, runner).synthesize('Why did the ghost giggle? It heard a boo joke!', root)
            self.assertEqual(timeouts, [10, 4])

    def test_expired_first_segment_never_runs_a_second_or_writes_a_final_reply(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            neural_files(root)
            clock, calls = [100.0], []

            def runner(command, **options):
                calls.append(command)
                Path(command[command.index('--output_file') + 1]).write_bytes(audio(seconds=.1, sample=1000))
                clock[0] += 10.01

            with patch.object(voice.time, 'monotonic', side_effect=lambda: clock[0]):
                with self.assertRaises(subprocess.TimeoutExpired):
                    voice.LocalVoice(root, runner).synthesize('Why did the ghost giggle? It heard a boo joke!', root)
            self.assertEqual(len(calls), 1)
            self.assertFalse((root / 'reply.wav').exists())

    def test_mismatched_segment_rates_and_oversized_combined_audio_fail_closed(self):
        for failure in ['mismatched rates', 'combined duration']:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                neural_files(root)
                calls = []

                def runner(command, **options):
                    calls.append(command)
                    rate = 16000 if failure == 'mismatched rates' and len(calls) == 1 else 22050
                    duration = 4 if failure == 'combined duration' else .1
                    Path(command[command.index('--output_file') + 1]).write_bytes(audio(rate, duration, sample=1000))

                with self.assertRaises(ValueError):
                    voice.LocalVoice(root, runner).synthesize('Why did the ghost giggle? It heard a boo joke!', root)
                self.assertEqual(len(calls), 2)
                self.assertFalse((root / 'reply.wav').exists())

    def test_windows_fallback_joke_preserves_words_and_has_the_same_pause(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            spoken = []

            def runner(command, **options):
                self.assertEqual(command[0], 'powershell.exe')
                spoken.append(Path(command[command.index('-TextFile') + 1]).read_text(encoding='utf-8'))
                Path(command[command.index('-WaveFile') + 1]).write_bytes(audio(16000, .1, sample=1000))

            engine = voice.LocalVoice(root, runner)
            result = engine.synthesize('Why did the ghost giggle? It heard a boo joke!', root)
            self.assertFalse(engine.neural)
            self.assertEqual(spoken, ['Why did the ghost giggle?', 'It heard a boo joke!'])
            rate, pcm = samples(result)
            self.assertEqual(rate, 16000)
            longest, run = 0, 0
            for sample in pcm:
                run = run + 1 if sample == 0 else 0
                longest = max(longest, run)
            self.assertGreaterEqual(longest, 6400)
            voice.validate_reply_wave(result)

    def test_missing_new_output_cannot_reuse_a_stale_reply_or_segment(self):
        for text in ['Boo there, friend!', 'Why did the ghost giggle? It heard a boo joke!']:
            with self.subTest(text=text), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                neural_files(root)
                for target in ['reply.wav', 'setup.wav', 'punchline.wav']:
                    (root / target).write_bytes(audio(seconds=.1, sample=1000))
                calls = []

                def runner(command, **options):
                    calls.append(command)  # Simulate a zero exit with no newly written WAV.

                engine = voice.LocalVoice(root, runner)
                with self.assertRaises(ValueError):
                    engine.synthesize(text, root)
                self.assertEqual(len(calls), 1)
                self.assertFalse((root / 'reply.wav').exists())
                self.assertTrue(engine.neural)


if __name__ == '__main__':
    unittest.main()

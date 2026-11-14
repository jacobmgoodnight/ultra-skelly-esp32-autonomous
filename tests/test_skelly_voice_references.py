"""Voice selection is isolated per turn; previews accept only pinned local WAVs."""
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import wave

HERE=Path(__file__).resolve().parents[1]/'experiments/pocket-conversation'
sys.path[:0]=[str(HERE),str(HERE.parent/'local-talkback')]
from chat_server import ConversationalVoice
from pocket_voice import GuardedVoice,Cancelled
from voice_previews import load_previews


def wav():
    output=io.BytesIO()
    with wave.open(output,'wb') as audio:
        audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(22050);audio.writeframes(b'\x00\x01'*2205)
    return output.getvalue()


class ReferenceTests(unittest.TestCase):
    def voice(self):
        voice=object.__new__(ConversationalVoice);voice.pocket=True;voice.base_assets=({'voice':'E'},{'config':'E'})
        voice.haunt_assets={'haunt-dry':({'voice':'dry'},{'config':'dry'})};voice.tone='haunt-dry'
        return voice

    def test_selected_reference_is_labeled_and_base_assets_restored_after_success_or_cancel(self):
        voice=self.voice();seen=[]
        def synth(self,*args):seen.append(self.paths['voice']);return wav(),'pocket-e'
        with patch.object(GuardedVoice,'synthesize',autospec=True,side_effect=synth):
            audio,source=voice.synthesize('Boo!',Path('.'),threading.Event(),time.monotonic()+2)
        self.assertEqual(source,'pocket-haunt-dry');self.assertEqual(seen,['dry']);self.assertEqual(voice.paths['voice'],'E')
        with patch.object(GuardedVoice,'synthesize',side_effect=Cancelled()):
            with self.assertRaises(Cancelled):voice.synthesize('Boo!',Path('.'),threading.Event(),time.monotonic()+2)
        self.assertEqual(voice.paths['voice'],'E')

    def test_fallback_keeps_its_truthful_source_and_missing_reference_is_not_advertised(self):
        voice=self.voice()
        with patch.object(GuardedVoice,'synthesize',return_value=(wav(),'piper-fallback')):
            self.assertEqual(voice.synthesize('Boo!',Path('.'))[1],'piper-fallback')
        self.assertIn('haunt-dry',voice.available_tones);self.assertNotIn('haunt-croaky',voice.available_tones)

    def test_previews_reject_changed_wavs_and_paths_outside_the_root(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);data=wav();rows={}
            for key in ('dry','croaky','crypt'):
                (root/(key+'.wav')).write_bytes(data);rows[key]={'path':key+'.wav','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
            lock=root/'lock.json';lock.write_text(json.dumps({'clips':rows}))
            self.assertEqual(set(load_previews(root,lock)),set(rows))
            (root/'dry.wav').write_bytes(data+b'x')
            with self.assertRaises(ValueError):load_previews(root,lock)
            (root/'dry.wav').write_bytes(data);rows['dry']['path']='../escape.wav';lock.write_text(json.dumps({'clips':rows}))
            with self.assertRaises(ValueError):load_previews(root,lock)


if __name__=='__main__':unittest.main()

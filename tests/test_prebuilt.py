"""Packaging tests use a synthetic image, never a flashable artifact."""
import hashlib,importlib.util,json,tempfile,unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('package_prebuilt',ROOT/'scripts/package-prebuilt.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class PackagingTests(unittest.TestCase):
    def test_profile_metadata_and_bad_image_rejection(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);source=base/'source.ino';binary=base/'image.bin';out=base/'package'
            code='const bool HEAD_ENABLED = true;\nconst uint32_t HEAD_MIN_INTERVAL_MS = 120000;\nconst uint32_t HEAD_MAX_INTERVAL_MS = 240000;\nconst uint8_t JAW_FOLLOWUP_MOTOR = 0;\n'
            code+=''.join('const bool '+flag+' = false;\n' for flag in ['MOUTH_ENABLED','ARM_ENABLED','TORSO_ENABLED','EYES_ENABLED','LIGHTS_ENABLED','COMPOUND_BODY_ENABLED','ALLOW_BODY_MOTOR_OVERLAP','REST_ENABLED','CLOCK_WINDOW_ENABLED','FAIR_BODY_TURNS','PLAYBACK_DIAGNOSTICS'])
            source.write_text(code)
            image=bytearray(4194304);image[4096]=image[65536]=0xe9;binary.write_bytes(image)
            metadata=module.package(source,binary,out,'a'*40)
            self.assertEqual(metadata['physicalStatus'],'Untested')
            self.assertEqual(metadata['binarySHA256'],hashlib.sha256(image).hexdigest())
            self.assertEqual(json.loads((out/'manifest.json').read_text())['builds'][0]['parts'][0]['offset'],0)
            with self.assertRaises(ValueError):module.package(source,binary,out,'latest')
            source.write_text(code.replace('ARM_ENABLED = false','ARM_ENABLED = true'))
            with self.assertRaises(ValueError):module.package(source,binary,out,'a'*40)
            source.write_text(code)
            binary.write_bytes(image[:-1])
            with self.assertRaises(ValueError):module.package(source,binary,out,'a'*40)
            binary.write_bytes(image);source.write_text('jaw enabled')
            with self.assertRaises(ValueError):module.package(source,binary,out,'a'*40)
if __name__=='__main__':unittest.main()

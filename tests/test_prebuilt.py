"""Packaging tests use a synthetic image, never a flashable artifact."""
import hashlib,importlib.util,json,tempfile,unittest,subprocess,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('package_prebuilt',ROOT/'scripts/package-prebuilt.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
site_spec=importlib.util.spec_from_file_location('assemble_installer',ROOT/'scripts/assemble-installer.py')
site=importlib.util.module_from_spec(site_spec);site_spec.loader.exec_module(site)

class PackagingTests(unittest.TestCase):
    def test_public_catalog_and_experimental_package_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);binary=base/'image.bin';image=bytearray(4194304);image[4096]=image[65536]=0xe9;binary.write_bytes(image)
            packages=base/'packages';output=base/'site';revision='a'*40
            for device,artifact in [('ultra','universal-usb-preview'),('skelly12','experimental-12ft-usb-preview')]:
                source_dir=base/device
                subprocess.run(['node',str(ROOT/'scripts/prepare-universal.cjs'),str(source_dir),device],check=True,capture_output=True)
                source=source_dir/'Universal.ino'
                metadata=module.package(source,binary,packages/artifact,revision,'universal',device)
                self.assertEqual(metadata['deviceId'],device)
                if device=='skelly12':
                    self.assertIn('RUNTIME_SEED[] = {12UL,1UL,0UL',source.read_text(encoding='utf-8'))
                    with self.assertRaises(ValueError):module.package(source,binary,base/'bad',revision,'universal','ultra')
                    changed=source.read_text(encoding='utf-8').replace('12UL,1UL,0UL','1UL,1UL,0UL');source.write_text(changed,encoding='utf-8')
                    with self.assertRaises(ValueError):module.package(source,binary,base/'bad',revision,'universal',device)
                    subprocess.run(['node',str(ROOT/'scripts/prepare-universal.cjs'),str(source_dir),device],check=True,capture_output=True)
            catalog=site.assemble(packages,output,revision)
            self.assertEqual(set(catalog['packages']),{'ultra','skelly12'})
            for entry in catalog['packages'].values():self.assertTrue((output/'studio/firmware'/entry['metadata']).is_file())
            path=packages/'experimental-12ft-usb-preview/build.json';valid=path.read_text();bad=json.loads(valid);bad['sourceCommit']='b'*40;path.write_text(json.dumps(bad))
            with self.assertRaises(ValueError):site.assemble(packages,base/'rejected',revision)
            self.assertFalse((base/'rejected').exists())
            path.write_text(valid);damaged=packages/'universal-usb-preview/universal.bin';image[12345]=1;damaged.write_bytes(image)
            with self.assertRaises(ValueError):site.assemble(packages,base/'rejected',revision)

    def test_universal_seed_and_profile_isolation(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp)
            subprocess.run(['node',str(ROOT/'scripts/prepare-universal.cjs'),str(base/'source')],check=True,capture_output=True)
            source=base/'source'/'Universal.ino';binary=base/'image.bin';out=base/'package'
            image=bytearray(4194304);image[4096]=image[65536]=0xe9;binary.write_bytes(image)
            metadata=module.package(source,binary,out,'a'*40,'universal')
            self.assertEqual(metadata['profile'],'universal')
            self.assertEqual(metadata['releaseVersion'],'2026.10.24-preview.2')
            self.assertEqual(metadata['firmwareRevision'],5)
            self.assertEqual(metadata['firmwareBuild'],2026102402)
            self.assertEqual(metadata['binaryFile'],'universal.bin')
            self.assertEqual(json.loads((out/'manifest.json').read_text())['builds'][0]['parts'][0]['path'],'universal.bin')
            with self.assertRaises(ValueError):module.package(source,binary,out,'a'*40,'head-only')
            code=source.read_text(encoding='utf-8')
            changed=re.sub(r'(RUNTIME_SEED\[\] = \{1UL,1UL,)0UL,',r'\g<1>1UL,',code)
            self.assertNotEqual(changed,code)
            source.write_text(changed,encoding='utf-8')
            with self.assertRaises(ValueError):module.package(source,binary,out,'a'*40,'universal')

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

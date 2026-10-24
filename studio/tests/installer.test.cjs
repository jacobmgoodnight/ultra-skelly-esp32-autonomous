const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {verifyPackage}=require('../installer.js');
test('fixed head-only package stays isolated when the Studio Normal preset enables arms',()=>{
  const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
  const root=path.resolve(__dirname,'../..'),output=path.join(root,'.skelly-build/prebuilt-safety-test');
  execFileSync(process.execPath,[path.join(root,'scripts/prepare-prebuilt.cjs'),output]);
  const source=fs.readFileSync(path.join(output,'HeadOnly.ino'),'utf8');
  assert.match(source,/const bool HEAD_ENABLED = true;/);
  assert.match(source,/HEAD_MIN_INTERVAL_MS = 120000;/);assert.match(source,/HEAD_MAX_INTERVAL_MS = 240000;/);
  for(const flag of ['MOUTH_ENABLED','ARM_ENABLED','TORSO_ENABLED','EYES_ENABLED','LIGHTS_ENABLED','COMPOUND_BODY_ENABLED','CLOCK_WINDOW_ENABLED'])
    assert.match(source,new RegExp('const bool '+flag+' = false;'));
});
test('installer rejects wrong board, truncated images and mismatched hashes',async()=>{
  const bytes=new Uint8Array(4194304);bytes[4096]=bytes[65536]=0xe9;
  const metadata={profile:'head-only',chipFamily:'ESP32',core:'3.3.12',sourceCommit:'a'.repeat(40),sourceSHA256:'b'.repeat(64),physicalStatus:'Untested',binarySHA256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
  assert.equal((await verifyPackage(metadata,bytes)).profile,'head-only');
  assert.equal((await verifyPackage({...metadata,profile:'universal',binaryFile:'universal.bin'},bytes)).profile,'universal');
  await assert.rejects(verifyPackage({...metadata,profile:'universal',binaryFile:'head-only.bin'},bytes));
  await assert.rejects(verifyPackage({...metadata,chipFamily:'ESP32-C3'},bytes));
  await assert.rejects(verifyPackage({...metadata,physicalStatus:'Verified'},bytes));
  await assert.rejects(verifyPackage(metadata,bytes.slice(1)));
  bytes[100000]=1;await assert.rejects(verifyPackage(metadata,bytes),/hash mismatch/);
});


test('release metadata is optional for older packages and strictly bounded when present',async()=>{
 const bytes=new Uint8Array(4194304);bytes[4096]=bytes[65536]=0xe9;const metadata={profile:'universal',chipFamily:'ESP32',core:'3.3.12',sourceCommit:'a'.repeat(40),sourceSHA256:'b'.repeat(64),physicalStatus:'Untested',binarySHA256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,releaseVersion:'2026.10.24-preview.1',firmwareRevision:5,firmwareBuild:2026102401};
 assert.equal((await verifyPackage(metadata,bytes)).releaseVersion,metadata.releaseVersion);await assert.rejects(verifyPackage({...metadata,releaseVersion:'unbounded unexpected label'},bytes));await assert.rejects(verifyPackage({...metadata,firmwareBuild:-1},bytes));
});

const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {verifyPackage}=require('../installer.js');
test('installer rejects wrong board, truncated images and mismatched hashes',async()=>{
  const bytes=new Uint8Array(4194304);bytes[4096]=bytes[65536]=0xe9;
  const metadata={profile:'head-only',chipFamily:'ESP32',core:'3.3.12',sourceCommit:'a'.repeat(40),binarySHA256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
  assert.equal((await verifyPackage(metadata,bytes)).profile,'head-only');
  await assert.rejects(verifyPackage({...metadata,chipFamily:'ESP32-C3'},bytes));
  await assert.rejects(verifyPackage(metadata,bytes.slice(1)));
  bytes[100000]=1;await assert.rejects(verifyPackage(metadata,bytes),/hash mismatch/);
});

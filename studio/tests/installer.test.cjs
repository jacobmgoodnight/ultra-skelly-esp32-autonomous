const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {verifyPackage,verifyCatalog,loadPublicPackage,boundedFetch,supportMessage,installerManifest}=require('../installer.js');
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

test('universal installer generation preserves the original Ultra source exactly',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{execFileSync}=require('node:child_process'),root=path.resolve(__dirname,'../..');
 const c=vm.createContext({window:{},TextEncoder,TextDecoder});for(const file of ['template.js','runtime-schema.js','runtime.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,'studio',file),'utf8'),c);
 const g=c.window.SkellyStudioGenerator,expected=g.generateRuntimeSketch([{name:'Subtle',seconds:600,config:{...g.DEFAULTS,...g.PRESETS.subtle}}]);
 const output=path.join(root,'.skelly-build/universal-regression');execFileSync(process.execPath,[path.join(root,'scripts/prepare-universal.cjs'),output,'ultra']);
 assert.equal(fs.readFileSync(path.join(output,'Universal.ino'),'utf8'),expected);
});

function fixture(deviceId='ultra'){
 const release=require('../release.js'),bytes=new Uint8Array(4194304);bytes[4096]=bytes[65536]=0xe9;
 const metadata={deviceId,profile:'universal',binaryFile:'universal.bin',chipFamily:'ESP32',core:'3.3.12',sourceCommit:'a'.repeat(40),sourceSHA256:'b'.repeat(64),physicalStatus:'Untested',binarySHA256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,releaseVersion:release.VERSION,firmwareRevision:release.REVISION,firmwareBuild:release.BUILD};
 const catalog={schema:1,sourceCommit:metadata.sourceCommit,releaseVersion:release.VERSION,firmwareRevision:release.REVISION,firmwareBuild:release.BUILD,packages:{[deviceId]:{metadata:'./'+release.VERSION+'/'+metadata.sourceCommit+'/'+deviceId+'/build.json',binarySHA256:metadata.binarySHA256}}};
 return {release,bytes,metadata,catalog};
}
test('public packages fetch exact same-origin version/commit/model paths and verify both models',async()=>{
 for(const device of ['ultra','skelly12']){const f=fixture(device),urls=[],root='https://example.org/repo/studio/firmware/';
 const fetcher=async(url,options)=>{urls.push(String(url));assert.equal(options.redirect,'error');return new Response(String(url).endsWith('catalog.json')?JSON.stringify(f.catalog):String(url).endsWith('build.json')?JSON.stringify(f.metadata):f.bytes);};
 const bundle=await loadPublicPackage('https://example.org/repo/studio/install.html',device,f.release,{fetcher});assert.equal(bundle.metadata.deviceId,device);
 assert.deepEqual(urls,[root+'catalog.json',root+f.catalog.packages[device].metadata.slice(2),root+f.catalog.packages[device].metadata.slice(2).replace('build.json','universal.bin')]);
 const manifest=installerManifest(bundle.metadata,'blob:verified-bytes');assert.equal(manifest.new_install_prompt_erase,false);assert.equal(manifest.new_install_improv_wait_time,0);assert.deepEqual(manifest.builds,[{chipFamily:'ESP32',parts:[{path:'blob:verified-bytes',offset:0}]}]);
 }
});
test('catalog rejects stale, mixed or redirected package identities before flashing',async()=>{
 const f=fixture(),bad=[{...f.catalog,schema:2},{...f.catalog,releaseVersion:'2020.01.01-preview.1'},{...f.catalog,sourceCommit:'../bad'}, {...f.catalog,firmwareBuild:1},{...f.catalog,packages:{ultra:{...f.catalog.packages.ultra,metadata:'https://evil.test/build.json'}}}];
 for(const catalog of bad)assert.throws(()=>verifyCatalog(catalog,'ultra',f.release));
 assert.throws(()=>verifyCatalog(f.catalog,'unknown',f.release));assert.throws(()=>verifyCatalog(f.catalog,'skelly12',f.release));
 await assert.rejects(verifyPackage(f.metadata,f.bytes,{deviceId:'skelly12'}),/Wrong Skelly/);
 for(const key of ['sourceCommit','binarySHA256','releaseVersion','firmwareRevision','firmwareBuild'])await assert.rejects(verifyPackage(f.metadata,f.bytes,{[key]:'different'}),/does not match/);
 const fetcher=async url=>new Response(String(url).endsWith('catalog.json')?JSON.stringify(f.catalog):String(url).endsWith('build.json')?JSON.stringify({...f.metadata,deviceId:'skelly12'}):f.bytes);
 await assert.rejects(loadPublicPackage('https://example.org/studio/install.html','ultra',f.release,{fetcher}),/Wrong Skelly/);
});
test('download bounds, HTTP failures and unsupported browsers provide recovery without USB',async()=>{
 await assert.rejects(boundedFetch('https://example.org',8,{fetcher:async()=>new Response('123456789')}),/exceeds/);
 await assert.rejects(boundedFetch('https://example.org',8,{fetcher:async()=>new Response('',{headers:{'content-length':'9'}})}),/exceeds/);
 await assert.rejects(boundedFetch('https://example.org',8,{fetcher:async()=>new Response('',{status:404})}),/Arduino fallback/);
 assert.match(supportMessage({},false),/HTTPS/);assert.match(supportMessage(null,true),/Web Serial/);assert.equal(supportMessage({},true),'');
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

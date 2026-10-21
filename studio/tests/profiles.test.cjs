const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const context=vm.createContext({window:{}});
for(const file of ["template.js","app.js"])vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context);
const api=context.window.SkellyStudioGenerator;
const plain=value=>JSON.parse(JSON.stringify(value));
const config=changes=>({...plain(api.DEFAULTS),...changes});

test("jaw chooser uses device-specific mappings without guessing numbers",()=>{
  assert.throws(()=>api.jawSelection("longOpen",{}),/file number first/);
  const selection=api.jawSelection("longOpen",{longOpen:417});
  assert.deepEqual(plain(selection),{jawEnabled:true,jawFile:417,jawExtras:""});
  const sketch=api.generateSketch(config(selection));
  assert.match(sketch,/const uint16_t MOUTH_FILE_SERIAL = 417;/);
  assert.doesNotMatch(sketch,/const uint16_t JAW_FILE_POOL/);
});

test("jaw mix emits only entered distinct files and preserves motor protection",()=>{
  const selection=api.jawSelection("mix",{chatter:7,longOpen:25,gasp:39});
  const sketch=api.generateSketch(config(selection));
  assert.match(sketch,/const uint16_t JAW_FILE_POOL\[\] = \{7, 25, 39\};/);
  assert.match(sketch,/const bool JAW_PROTECTS_ARM_TORSO = true;/);
  assert.throws(()=>api.jawSelection("mix",{longOpen:25}),/at least two/);
  assert.throws(()=>api.jawSelection("mix",{chatter:25,gasp:25}),/different file number/);
  assert.throws(()=>api.jawSelection("unknown",{}),/file number first/);
  for(const bad of [0,65536,1.5,"13",NaN])assert.throws(()=>api.jawSelection("longOpen",{longOpen:bad}),/whole numbers/);
});

test("profile round trip keeps firmware output and device clip library",()=>{
  const before=config({jawFile:13,eyesEnabled:true,eyeChoices:[1,8,18],lightsEnabled:true,headColor:"#00ff00"});
  const encoded=api.createProfile(before,{chatter:12,longOpen:13,gasp:14});
  const restored=api.parseProfile(encoded);
  assert.deepEqual(plain(restored.config),before);
  assert.deepEqual(plain(restored.clips),{chatter:12,longOpen:13,gasp:14});
  assert.equal(api.generateSketch(restored.config),api.generateSketch(before));
});

test("profile rejects bad schema, wrong types and invalid dormant settings",()=>{
  const valid=JSON.parse(api.createProfile(config(),{}));
  for(const mutate of [
    p=>p.version=2,
    p=>p.config.headEnabled="false",
    p=>delete p.config.jawFile,
    p=>{p.config.jawEnabled=false;p.config.jawFile=65536;},
    p=>{p.config.eyesEnabled=false;p.config.eyeChoices=[99];},
    p=>{p.config.lightsEnabled=false;p.config.headColor="broken";},
    p=>p.config.compoundMin=-5,
    p=>p.clips.longOpen=-2
  ]) {
    const changed=structuredClone(valid);mutate(changed);
    assert.throws(()=>api.parseProfile(JSON.stringify(changed)));
  }
  assert.throws(()=>api.parseProfile("x".repeat(65537)),/64 KB/);
  assert.throws(()=>api.parseProfile("not JSON"));
});

test("profile ignores unknown keys and cannot inject generated code through BLE name",()=>{
  const valid=JSON.parse(api.createProfile(config(),{}));
  valid.config.unknown="surprise";
  valid.config.bleName='Skelly "quoted" \\ test';
  const restored=api.parseProfile(JSON.stringify(valid));
  assert.equal(Object.hasOwn(restored.config,"unknown"),false);
  assert.match(api.generateSketch(restored.config),/Skelly \\"quoted\\"/);
});

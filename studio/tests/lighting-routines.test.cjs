const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {previewItems}=require('../experience.js');
const ctx=vm.createContext({window:{}});for(const f of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);
const g=ctx.window.SkellyStudioGenerator,c=changes=>({...g.DEFAULTS,...changes});
const plain=x=>JSON.parse(JSON.stringify(x));
test('requested personalities have distinct quiet, normal and haunted movement intervals',()=>{
  assert.equal(g.PRESETS.subtle.headMin,60);assert.equal(g.PRESETS.subtle.headMax,120);assert.equal(g.PRESETS.subtle.armEnabled,false);
  assert.equal(g.DEFAULTS.headMin,35);assert.equal(g.DEFAULTS.headMax,75);assert.equal(g.DEFAULTS.armEnabled,true);
  assert.equal(g.PRESETS.normal.armMin,150);assert.equal(g.PRESETS.normal.armMax,240);
  assert.equal(g.PRESETS.haunted.armMin,60);assert.equal(g.PRESETS.haunted.armMax,120);
});
test('preview contains only used lanes, replacing standalone motor lanes in compound mode',()=>{
  assert.deepEqual(previewItems(c()),[['head','Head'],['arm','Arm']]);
  const mixed=c({compoundEnabled:true,compoundAlongside:false,jawEnabled:true,eyesEnabled:true,eyeChoices:[1,2],lightsEnabled:true,lightRotation:true});
  assert.deepEqual(previewItems(mixed),[['compound','Combined'],['eyes','Eyes'],['lights','Lighting'],['jaw','Jaw']]);
  assert.deepEqual(previewItems(c({headEnabled:false,armEnabled:false,lightsEnabled:true})),[]);
  const events=g.simulateSchedule(mixed);assert.ok(events.some(e=>e.kind==='lights'));assert.ok(!events.some(e=>['head','arm','torso'].includes(e.kind)));
});
test('rotation and effect settings emit the selected palette mask and inverted upstream speed',()=>{
  const code=g.generateSketch(c({lightsEnabled:true,lightRotation:true,lightInterval:25,lightPalettes:[1,3],torsoEffect:3,headEffect:2,torsoSpeed:0,headSpeed:254}));
  for(const pattern of [/LIGHT_ROTATION_ENABLED = true/,/LIGHT_ROTATION_INTERVAL_MS = 25000/,/LIGHT_PALETTE_MASK = 10/,/TORSO_LIGHT_MODE = 3/,/HEAD_LIGHT_MODE = 2/,/TORSO_LIGHT_SPEED = 254/,/HEAD_LIGHT_SPEED = 0/])assert.match(code,pattern);
  for(const change of [{lightInterval:14},{lightInterval:3601},{lightPalettes:[1]},{lightPalettes:[1,1]},{lightPalettes:[0,4]},{torsoEffect:4},{headSpeed:255},{torsoSpeed:1.5}])assert.throws(()=>g.generateSketch(c({lightRotation:true,...change})));
  assert.equal(g.DEFAULTS.lightRotation,false);assert.equal(g.DEFAULTS.torsoEffect,1);assert.equal(g.DEFAULTS.headEffect,1);
});
test('old profiles import with lighting off while new profiles preserve lighting settings',()=>{
  for(const version of [1,2]) {
    const old=plain(c({armEnabled:false,jawEnabled:true}));
    for(const key of ['lightRotation','lightInterval','lightPalettes','torsoEffect','headEffect','torsoSpeed','headSpeed'])delete old[key];
    const p=g.parseProfile(JSON.stringify({app:'SkellyStudio',version,config:old,clips:{}}));
    assert.equal(p.config.armEnabled,false);assert.equal(p.config.jawEnabled,true);assert.equal(p.config.lightRotation,false);assert.equal(p.config.headEffect,1);
  }
  const current=c({lightsEnabled:true,lightRotation:true,lightPalettes:[0,2],headEffect:3});
  const saved=g.createProfile(current,{});assert.equal(JSON.parse(saved).version,4);assert.deepEqual(plain(g.parseProfile(saved).config),plain(current));
  const bad=JSON.parse(saved);delete bad.config.lightInterval;assert.throws(()=>g.parseProfile(JSON.stringify(bad)));
});
test('named rotation palettes agree with the manual Studio palette buttons',()=>{
  const source=ctx.window.SKELLY_FIRMWARE_TEMPLATE;
  const block=/LIGHT_PALETTES\[4\]\[6\] = \{([\s\S]*?)\};/.exec(source);assert.ok(block);
  const actual=Array.from(block[1].matchAll(/\{([^}]+)\}/g),m=>m[1].split(',').map(Number));
  const expected=Object.values(g.PALETTES).map(p=>[p.torsoColor,p.headColor].flatMap(color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16))));
  assert.deepEqual(actual,plain(expected));
});
test('lighting template drift rejects missing or duplicated configuration anchors',()=>{
  const original=ctx.window.SKELLY_FIRMWARE_TEMPLATE;
  try {
    for(const anchor of ['const bool LIGHT_ROTATION_ENABLED = false;','const uint8_t LIGHT_PALETTE_MASK = 15;','const uint8_t HEAD_LIGHT_MODE = 1;','const uint8_t TORSO_LIGHT_SPEED = 190;'])
      for(const changed of [original.replace(anchor,''),original+'\n'+anchor]) {
        ctx.window.SKELLY_FIRMWARE_TEMPLATE=changed;
        assert.throws(()=>g.generateSketch(c({lightsEnabled:true,lightRotation:true})),/missing or repeated anchor/);
      }
  }finally{ctx.window.SKELLY_FIRMWARE_TEMPLATE=original;}
});

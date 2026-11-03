const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const looks=require('../looks.js'),model=require('../scene-model.js'),runtime=require('../runtime.js');
const context=vm.createContext({window:{}});for(const name of ['template.js','app.js'])vm.runInContext(fs.readFileSync(__dirname+'/../'+name,'utf8'),context);const g=context.window.SkellyStudioGenerator;
test('character looks are explicit, valid editor starting points with safety and other settings preserved',()=>{
 for(const deviceId of ['ultra','skelly12']){
  const current=g.adaptDevice({...g.DEFAULTS,bleName:g.DEVICE_PROFILES[deviceId].bleName,headMin:130,headMax:190,torsoBrightness:79,headBrightness:88,lightRestoreMode:1},deviceId);
  const before=JSON.stringify(current);
  for(const profile of ['friendly','mischief','guardian','storyteller']){
   const result=looks.characterLook(current,profile);
   assert.equal(g.validate(result).length,0);
   assert.equal(result.eyesEnabled,true);assert.equal(result.lightsEnabled,true);
   assert.equal(result.eyeChoices.length,1);assert.equal(result.lightRotation,false);
   for(const key of Object.keys(current))if(!['eyesEnabled','eyeChoices','lightsEnabled','lightRotation','torsoColor','headColor','torsoEffect','headEffect'].includes(key))assert.deepEqual(result[key],JSON.parse(JSON.stringify(current[key])),key);
  }
  assert.equal(JSON.stringify(current),before);
 }
 assert.throws(()=>looks.characterLook(g.DEFAULTS,'__proto__'),/known character/);
});
test('scoped copying keeps motor, mouth, restoration and connection fields on the current scene',()=>{
 const current={...g.DEFAULTS,jawEnabled:true,jawProtectBody:true,eyeJawMode:1,lightRestoreMode:1,clockEnabled:true,clockStart:100,headMin:81,headMax:130};
 const source=model.starter('haunted',g).profile.config,before=JSON.stringify(current),sourceBefore=JSON.stringify(source);
 for(const scope of ['eyes','lights','appearance']){
  const changed=looks.appearance(current,source,scope);assert.equal(g.validate(changed).length,0);
  for(const key of Object.keys(current)){
   const allowed=scope==='eyes'?looks.EYE_KEYS:scope==='lights'?looks.LIGHT_KEYS:[...looks.EYE_KEYS,...looks.LIGHT_KEYS];
   if(!allowed.includes(key))assert.deepEqual(changed[key],JSON.parse(JSON.stringify(current[key])),key);
  }
  const parsed=g.parseProfile(g.createProfile(changed,{}));assert.equal(parsed.config.headMin,81);assert.equal(parsed.config.jawEnabled,true);
  const sketch=g.generateSketch(changed);assert.match(sketch,/HEAD_MIN_INTERVAL_MS = 81000/);assert.match(sketch,/MOUTH_ENABLED = true/);
  assert.doesNotThrow(()=>runtime.encode([{name:'Current',seconds:600,config:parsed.config}],false,g.validate));
  if(scope!=='lights'){changed.eyeChoices.push(18);assert.equal(JSON.stringify(source),sourceBefore);}
 }
 assert.equal(JSON.stringify(current),before);assert.throws(()=>looks.appearance(current,{...source,deviceId:'skelly12'}),/same Skelly model/);assert.throws(()=>looks.appearance(current,source,'all'),/Choose/);
});
test('preview speed is illustrative, faster with higher UI speed and browser strobe is bounded',()=>{
 for(const effect of [2,3])assert.ok(looks.previewPeriod(effect,0)>looks.previewPeriod(effect,254));
 for(const speed of [-30,0,32,125,254,999,NaN])assert.ok(looks.previewPeriod(2,speed)>=.5);
 assert.equal(looks.previewPeriod(3,NaN),looks.previewPeriod(3,0));
});
test('eye labels follow model numbering and never fabricate missing previews',()=>{
 assert.equal(looks.eyeName(1),'Blue iris');assert.equal(looks.eyeName(8),'Orange reptile');assert.equal(looks.eyeName(12),'Skull and crossbones');
 assert.equal(looks.eyeName(1,'skelly12'),'American flag');assert.equal(looks.eyeName(19,'skelly12'),'Skull and crossbones');assert.match(looks.eyeName(5,'skelly12'),/unavailable/);
});

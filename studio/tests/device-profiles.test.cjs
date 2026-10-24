const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({window:{},TextEncoder,TextDecoder});
for(const name of ['template.js','runtime-schema.js','runtime.js','app.js'])vm.runInContext(fs.readFileSync(__dirname+'/../'+name,'utf8'),context);
const g=context.window.SkellyStudioGenerator,r=context.window.SkellyRuntime,m=require('../scene-model.js');
const config=(extra={})=>g.adaptDevice({...g.DEFAULTS,bleName:'12ft Skelly',...extra},'skelly12');
const scene=c=>({name:'Experimental',seconds:600,config:c});
test('old exports default to Ultra; unknown or incompatible profiles fail closed',()=>{
 const old=JSON.parse(g.createProfile({...g.DEFAULTS},{}));assert.equal(old.config.deviceId,undefined);
 assert.equal(g.parseProfile(JSON.stringify(old)).config.deviceId,'ultra');
 const c=config({eyeChoices:[19,20],eyesEnabled:true});
 assert.equal(g.parseProfile(g.createProfile(c,{})).config.deviceId,'skelly12');
 for(const extra of [{deviceId:'unknown'},{armEnabled:true},{torsoEnabled:true},{compoundEnabled:true},{jawEnabled:true},{playbackDiagnostics:true},{headMin:89},{eyeChoices:[21]}])
  assert.throws(()=>g.generateSketch({...c,...extra}));
 assert.throws(()=>g.parseProfile(g.createProfile({...g.DEFAULTS},{}).replace('"headEnabled": true','"deviceId": "unknown", "headEnabled": true')));
 assert.throws(()=>g.generateSketch({...g.DEFAULTS,eyeChoices:[19]}));
 assert.throws(()=>g.generateSketch({...g.DEFAULTS,bleName:'12ft Skelly'}),/other device model/);
 assert.throws(()=>g.generateSketch({...c,bleName:'Ultra Skelly v2'}),/other device model/);
});
test('every personality and scene starter restricts experimental capabilities without changing Ultra presets',()=>{
 const before=JSON.stringify(g.PRESETS);
 for(const preset of Object.values(g.PRESETS)){
  const c=config(preset);assert.equal(g.validate(c).length,0);
  for(const key of ['armEnabled','torsoEnabled','compoundEnabled','jawEnabled','playbackDiagnostics'])assert.equal(c[key],false);
  assert.equal(c.jawFollowupMotor,0);assert.ok(c.headMin>=90);
  assert.match(g.generateSketch(c),/#define SKELLY_DEVICE_12FT 1/);
 }
 for(const key of ['moonlit','haunted','ember']){
  const c=m.starter(key,g,config()).profile.config;assert.equal(c.deviceId,'skelly12');assert.equal(c.armEnabled,false);assert.equal(c.compoundEnabled,false);
 }
 assert.equal(JSON.stringify(g.PRESETS),before);
});
test('experimental scenes round trip through separate format; mixed models and invalid settings reject',()=>{
 const c=config({eyesEnabled:true,eyeChoices:[19,20],lightsEnabled:true,torsoEffect:3});
 const words=r.encode([scene(c)],true,g.validate),decoded=r.decode(words,g.DEFAULTS);
 assert.equal(words[0],12);assert.equal(decoded.scenes[0].config.deviceId,'skelly12');
 assert.equal(JSON.stringify(decoded.scenes[0].config.eyeChoices),'[19,20]');
 assert.equal(r.crc(r.encode(decoded.scenes,true,g.validate)),r.crc(words));
 const ultra=r.encode([scene({...g.DEFAULTS})],false,g.validate);assert.equal(ultra[0],1);assert.equal(ultra.length,words.length);
 assert.throws(()=>r.encode([scene(c),{name:'Ultra',config:{...g.DEFAULTS}}],true,g.validate),/same device model/);
 const bad=Array.from(words);bad[3+r.schema.fields.findIndex(f=>f.name==='armEnabled')]=1;assert.throws(()=>r.decode(bad,g.DEFAULTS),/Unsupported experimental/);
 assert.throws(()=>m.validateLibrary({app:'SkellyScenes',version:1,rotate:true,scenes:[{name:'One',seconds:600,profile:JSON.parse(g.createProfile(c,{}))},{name:'Two',seconds:600,profile:JSON.parse(g.createProfile(g.DEFAULTS,{}))}]},g),/same device model/);
 const source=g.generateRuntimeSketch([scene(c)],true);
 assert.match(source,/#define SKELLY_RUNTIME 1/);assert.match(source,/#define SKELLY_DEVICE_12FT 1/);
 assert.match(source,/RUNTIME_SEED\[\] = \{12UL/);
});
test('new model anchor rejects missing or duplicate substitutions',()=>{
 const original=context.window.SKELLY_FIRMWARE_TEMPLATE,anchor='#define SKELLY_DEVICE_12FT 0';
 try{for(const source of [original.replace(anchor,''),original+'\n'+anchor]){context.window.SKELLY_FIRMWARE_TEMPLATE=source;assert.throws(()=>g.generateSketch(config()),/missing or repeated anchor/);}}
 finally{context.window.SKELLY_FIRMWARE_TEMPLATE=original;}
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const m=require('../scene-model.js'),r=require('../runtime.js');
const ctx=vm.createContext({window:{}});for(const f of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);const g=ctx.window.SkellyStudioGenerator;
const scene=(name='One',extra={})=>({name,seconds:600,profile:JSON.parse(g.createProfile({...g.DEFAULTS,...extra},{}))});
test('explicit add and update never overwrite another scene by matching its name',()=>{
 const lib=new m.SceneLibrary(g);lib.add(scene());lib.add(scene('Two'));lib.editing=0;const before=lib.snapshot();
 assert.throws(()=>lib.add(scene('One')),/unique/);assert.deepEqual(lib.snapshot(),before);
 assert.throws(()=>lib.update(scene('Two')),/unique/);assert.deepEqual(lib.snapshot(),before);
 lib.update(scene('Renamed',{headMin:40}));assert.equal(lib.value.scenes[0].name,'Renamed');assert.equal(lib.value.scenes[1].name,'Two');assert.equal(lib.value.scenes[0].profile.config.headMin,40);
});
test('move, delete and undo preserve the editing scene and exports remain version one',()=>{
 const lib=new m.SceneLibrary(g);for(const name of ['One','Two','Three'])lib.add(scene(name));lib.editing=1;
 lib.move(0,1);assert.equal(lib.editing,0);assert.equal(lib.value.scenes[0].name,'Two');lib.remove(0);assert.equal(lib.editing,null);assert.equal(lib.value.scenes.length,2);
 assert.equal(lib.undo(),true);assert.equal(lib.editing,0);assert.equal(lib.value.scenes[0].name,'Two');assert.equal(lib.undo(),false);assert.equal(lib.snapshot().version,1);
 assert.equal(lib.move(0,-1),false);assert.equal(lib.move(2,1),false);
});
test('duplicate uses a unique bounded name, keeps independent settings, and respects four slots',()=>{
 const lib=new m.SceneLibrary(g);lib.add(scene('A'.repeat(32)));lib.duplicate(0);lib.duplicate(0);lib.duplicate(0);
 assert.equal(new Set(lib.value.scenes.map(s=>s.name)).size,4);assert.ok(lib.value.scenes.every(s=>s.name.length<=32));
 lib.value.scenes[1].profile.config.headMin=42;assert.equal(lib.value.scenes[0].profile.config.headMin,g.DEFAULTS.headMin);
 const before=lib.snapshot();assert.throws(()=>lib.duplicate(0),/four/);assert.deepEqual(lib.snapshot(),before);
});
test('invalid replacement is atomic and full program encoding survives export/import',()=>{
 const lib=new m.SceneLibrary(g);lib.add(scene());const before=lib.snapshot(),bad=scene('Bad');bad.profile.config.headMin=1;assert.throws(()=>lib.commit({...before,scenes:[bad]}));assert.deepEqual(lib.snapshot(),before);
 lib.add(scene('Second',{lightsEnabled:true}));const next=lib.snapshot();next.rotate=true;next.random=true;lib.commit(next);
 const round=new m.SceneLibrary(g,JSON.parse(JSON.stringify(lib.snapshot()))),p=round.program();assert.deepEqual(r.encode(p.scenes,p.rotate,g.validate,p.random),r.encode(lib.program().scenes,true,g.validate,true));
});
test('draft envelopes validate both editable settings and the revert baseline before recovery',()=>{
 const draft={app:'SkellyDraft',version:1,current:scene('Draft',{headMin:40}),baseline:scene(),editing:0,sceneKey:'key',pendingNew:false};
 const parsed=m.parseDraft(JSON.stringify(draft),g);assert.equal(parsed.current.profile.config.headMin,40);assert.equal(parsed.baseline.profile.config.headMin,35);assert.equal(parsed.pendingNew,false);
 const badBase=scene('Bad');badBase.profile.config.headMin=1;
 for(const bad of [{...draft,version:2},{...draft,baseline:badBase},{...draft,current:{...scene(),seconds:0}}])assert.throws(()=>m.parseDraft(JSON.stringify(bad),g));
 assert.throws(()=>m.parseDraft('x'.repeat(262145),g),/large/);
});
test('scene timing notes respect combined-only mode and leave motor cooldowns unchanged',()=>{
 const c={...g.DEFAULTS,compoundEnabled:true,compoundAlongside:false,compoundMin:240,compoundMax:600};assert.deepEqual(m.timingNotes(c,120),['Combined may not run before this scene ends.']);
 assert.ok(m.timingNotes({...g.DEFAULTS},120).some(s=>s.startsWith('Arm')));assert.equal(m.timingNotes({...g.DEFAULTS},600).length,0);
});
test('complete starters are valid, mouth-free and encode through the unchanged runtime format',()=>{
 for(const key of ['moonlit','haunted','ember']){const s=m.starter(key,g),c=s.profile.config;assert.equal(s.seconds,600);assert.equal(c.jawEnabled,false);assert.equal(c.clockEnabled,false);assert.equal(c.eyesEnabled,true);assert.equal(c.lightsEnabled,true);assert.equal(c.torsoBrightness,255);assert.equal(c.torsoSpeed,125);assert.equal(g.validate(c).length,0);assert.doesNotThrow(()=>r.encode([{name:s.name,seconds:s.seconds,config:c}],false,g.validate));assert.match(g.generateSketch(c),/MOUTH_ENABLED = false/);}
 assert.throws(()=>m.starter('missing',g));
 const named=m.starter('moonlit',g,{bleName:'My Porch Skelly',scanRetrySec:10});assert.equal(named.profile.config.bleName,'My Porch Skelly');assert.equal(named.profile.config.scanRetrySec,10);
});
test('extended timing windows include long-interval events without claiming physical starts',()=>{
 const c={...g.DEFAULTS,headEnabled:true,headMin:600,headMax:600,armEnabled:false};assert.equal(g.simulateSchedule(c,1).length,0);const events=g.simulateSchedule(c,1,900);assert.equal(events.length,1);assert.equal(events[0].time,600);
 assert.equal(g.simulateSchedule({...c,headMin:32,headMax:32},1,3600).length,112);assert.throws(()=>g.simulateSchedule(c,1,3601));
});

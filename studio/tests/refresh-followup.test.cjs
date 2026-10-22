const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx=vm.createContext({window:{}});for(const f of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);
const g=ctx.window.SkellyStudioGenerator,c=changes=>({...g.DEFAULTS,...changes});
test('custom palettes persist and emit all RGB values without emitting names into C++',()=>{
  const config=c({lightsEnabled:true,lightRotation:true,palette0Name:'My midnight',palette0Torso:'#123456',palette0Head:'#abcdef'});
  const saved=g.createProfile(config,{}),parsed=g.parseProfile(saved);
  assert.equal(parsed.config.palette0Name,'My midnight');assert.equal(parsed.config.palette0Head,'#abcdef');
  const code=g.generateSketch(parsed.config);assert.match(code,/LIGHT_PALETTES\[4\]\[6\] = \{\{18,52,86,171,205,239\}/);assert.doesNotMatch(code,/My midnight/);
  for(const change of [{palette0Torso:'#xyzxyz'},{palette1Name:''},{palette3Head:'red'},{scanRetrySec:4},{startupWindowSec:301},{startupRetrySec:5.5}])assert.throws(()=>g.generateSketch(c(change)));
});
test('v3 migration preserves combined-only semantics and disables failed overlap',()=>{
  const config=c({compoundEnabled:true,headEnabled:true,armEnabled:true,torsoEnabled:true,bodyOverlap:true});
  for(const key of Object.keys(config))if(key.startsWith('palette')||['scanRetrySec','startupRetrySec','startupWindowSec','compoundAlongside'].includes(key))delete config[key];
  const parsed=g.parseProfile(JSON.stringify({app:'SkellyStudio',version:3,config,clips:{}}));
  assert.equal(parsed.config.compoundAlongside,false);assert.equal(parsed.config.bodyOverlap,false);assert.equal(parsed.config.startupRetrySec,5);
});
test('Haunted interleaves combos and other presets turn combos off',()=>{
  const h=c(g.PRESETS.haunted);assert.equal(h.compoundEnabled,true);assert.equal(h.compoundAlongside,true);
  assert.equal(h.compoundMin,240);assert.equal(h.compoundMax,600);assert.deepEqual(Array.from(h.compoundMasks),[3,5,6,7]);
  const events=g.simulateSchedule({...h,compoundMin:240,compoundMax:240});assert.ok(events.some(e=>e.kind==='head'));assert.ok(events.some(e=>e.kind==='compound'));
  for(const preset of ['normal','subtle'])assert.equal(g.PRESETS[preset].compoundEnabled,false);
});
test('new retry and palette table anchors fail closed',()=>{
  const original=ctx.window.SKELLY_FIRMWARE_TEMPLATE;
  try{for(const anchor of ['const bool COMPOUND_ALONGSIDE = false;','const uint32_t STARTUP_SCAN_RETRY_MS = 5000;','const uint32_t SCAN_RETRY_MS = 30000;','const uint8_t LIGHT_PALETTES[4][6] = {']){
    ctx.window.SKELLY_FIRMWARE_TEMPLATE=original.replace(anchor,'');assert.throws(()=>g.generateSketch(c()),/missing or repeated anchor/);
  }}finally{ctx.window.SKELLY_FIRMWARE_TEMPLATE=original;}
});

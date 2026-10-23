const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {jawSetupFeedback}=require('../experience.js');
const {parseStatus,diagnosticView}=require('../controller-state.js');
const {profiles,wirelessSketch}=require('../../scripts/prepare-owner-tools.cjs');
const ctx=vm.createContext({window:{},TextEncoder,TextDecoder});
for(const file of ['template.js','runtime-schema.js','runtime.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);
const g=ctx.window.SkellyStudioGenerator;
test('portable collection uses existing profiles, no device clip mappings and no new defaults',()=>{
  for(const [name,source] of Object.entries(profiles())){
    assert.equal(fs.readFileSync(path.join(__dirname,'../presets',name+'.json'),'utf8'),source);
    const p=g.parseProfile(source),c=p.config;
    for(const key of ['jawEnabled','lightsEnabled','restEnabled','clockEnabled','playbackDiagnostics'])assert.equal(c[key],false);
    assert.ok(Object.values(p.clips).every(v=>v===null));
    assert.equal(g.validate(c).length,0);assert.equal(JSON.parse(source).version,4);
    const code=g.generateSketch(c);assert.match(code,/#define SKELLY_WIRELESS_STATUS 0/);assert.match(code,/MOUTH_ENABLED = false/);
  }
});
test('jaw guidance identifies fallback files, unsafe protection and estimates without changing settings',()=>{
  const c={...g.DEFAULTS,jawEnabled:true,jawFile:417,jawExtras:'9, 71',jawDurations:'9:40',jawClipSec:30,eyesEnabled:true,jawProtectBody:false};
  const before=JSON.stringify(c),text=jawSetupFeedback(c).join(' ');
  assert.match(text,/#417, #71 uses the 30-second fallback/);assert.doesNotMatch(text,/#9 uses/);
  assert.match(text,/interrupting a body action/);assert.match(text,/cannot read the stored files/);
  assert.match(text,/physical validation/);assert.equal(JSON.stringify(c),before);
  assert.deepEqual(jawSetupFeedback({...c,jawEnabled:false}),[]);
  assert.match(jawSetupFeedback({...c,jawDurations:'417:30,9:40,71:60'}).join(' '),/Each selected file/);
});
test('additive numeric diagnostics preserve old status and clearly label stale modeled evidence',()=>{
  const old='USB STATUS v2 connected=1 scene=0 sequence=2 pending=0';
  assert.deepEqual(diagnosticView(parseStatus(old)),[]);
  const d=parseStatus(old+' firmware=4 build=2026102301 wait=2 jawMs=21001 accepted=1 acceptedAge=5000');
  const rows=diagnosticView(d,true).flat().join(' ');
  assert.match(rows,/usb-scheduler-v4/);assert.match(rows,/Last reported/);assert.match(rows,/22 seconds remaining \(modeled\)/);assert.match(rows,/before this snapshot/);
  for(const extra of [' wait=8',' accepted=3',' accepted=1'])assert.throws(()=>parseStatus(old+extra));
  assert.match(diagnosticView({...d,pending:1}).flat().join(' '),/Settings\/scene change pending/);
});
test('wireless status is a separate opt-in build with no writable characteristic or notifications',()=>{
  const source=wirelessSketch();
  assert.match(source,/#define SKELLY_WIRELESS_STATUS 1/);assert.match(source,/BLECharacteristic::PROPERTY_READ\)/);
  assert.match(source,/setAccessPermissions\(ESP_GATT_PERM_READ\)/);
  assert.doesNotMatch(source,/PROPERTY_WRITE|PROPERTY_NOTIFY|\.notify\(/);
  assert.match(source,/Skelly Status Experiment/);
  assert.match(source,/MOUTH_ENABLED = false/);
  const normal=g.generateRuntimeSketch([{name:'Subtle',config:{...g.DEFAULTS,...g.PRESETS.subtle}}]);
  assert.match(normal,/#define SKELLY_WIRELESS_STATUS 0/);
  const original=ctx.window.SKELLY_FIRMWARE_TEMPLATE;
  try{
    for(const replacement of ['', 'bool diagnosticResting(uint32_t now) { (void)now; return false; }\nbool diagnosticResting(uint32_t now) { (void)now; return false; }']){
      ctx.window.SKELLY_FIRMWARE_TEMPLATE=original.replace('bool diagnosticResting(uint32_t now) { (void)now; return false; }',replacement);
      assert.throws(()=>g.generateSketch({...g.DEFAULTS}),/anchor|Expected|missing|replace/i);
    }
  }finally{ctx.window.SKELLY_FIRMWARE_TEMPLATE=original;}
});

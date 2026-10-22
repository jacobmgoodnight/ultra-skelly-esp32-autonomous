const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {firstRoutine,scheduleFeedback}=require('../experience.js');
const ctx=vm.createContext({window:{}});for(const file of ['template.js','app.js'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),ctx);
const api=ctx.window.SkellyStudioGenerator;
test('head-only first run clears advanced behavior without audio assumptions',()=>{
  const c=firstRoutine({...api.DEFAULTS,compoundEnabled:true,jawFollowupMotor:3,clockEnabled:true});
  assert.equal(c.headMin,120);assert.equal(c.headMax,240);assert.equal(c.jawEnabled,false);assert.equal(c.clockEnabled,false);
  assert.equal(api.validate(c).length,0);assert.match(api.generateSketch(c),/const bool MOUTH_ENABLED = false;/);
});
test('feedback explains real delays without claiming movement',()=>{
  const text=scheduleFeedback({...api.DEFAULTS,jawMin:22,lightsEnabled:true,restEnabled:true,clockEnabled:true}).join(' ');
  for(const pattern of [/starve/,/six light/,/breaks/,/USB time/,/not guaranteed/])assert.match(text,pattern);
});
test('new settings generate bounded estimates, fair turns and offline clock window',()=>{
  const c={...api.DEFAULTS,fairBodyTurns:true,playbackDiagnostics:true,clockEnabled:true,clockStart:1320,clockEnd:120,clockDays:32,jawExtras:'13,14',jawDurations:'13:24,14:30'};
  const code=api.generateSketch(c);for(const pattern of [/FAIR_BODY_TURNS = true/,/CLOCK_START_MINUTE = 1320/,/case 13: return 24000/,/jawDurationMs\(chosenJawFile\)/])assert.match(code,pattern);
  for(const changes of [{jawDurations:'13:20'},{jawDurations:'15:30'},{jawDurations:'13:30,13:40'},{clockStart:120,clockEnd:120},{clockDays:0},{jawClipSec:121}])assert.throws(()=>api.generateSketch({...c,...changes}));
});
test('old version-one profiles receive safe defaults only for newly added fields',()=>{
  const config={...api.DEFAULTS};for(const key of ['fairBodyTurns','playbackDiagnostics','clockEnabled','clockStart','clockEnd','clockDays','jawClipSec','jawDurations'])delete config[key];
  const imported=api.parseProfile(JSON.stringify({app:'SkellyStudio',version:1,config,clips:{}}));assert.equal(imported.config.clockEnabled,false);assert.equal(imported.config.jawClipSec,21);
});
test('new profiles use version two so older Studio cannot silently drop clock or duration protection',()=>{
  const encoded=api.createProfile({...api.DEFAULTS,clockEnabled:true,jawClipSec:60},{});
  const parsed=JSON.parse(encoded);assert.equal(parsed.version,2);
  delete parsed.config.jawClipSec;assert.throws(()=>api.parseProfile(JSON.stringify(parsed)),/Invalid profile setting/);
});

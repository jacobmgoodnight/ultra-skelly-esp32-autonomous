const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const buildRoot = path.resolve(root, process.env.SKELLY_BUILD_ROOT || ".skelly-build");
const ctx = vm.createContext({window:{},TextEncoder,TextDecoder});
for(const file of ["studio/template.js","studio/runtime-schema.js","studio/runtime.js","studio/app.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),ctx,{filename:file});
}
const generator = ctx.window.SkellyStudioGenerator;
const base = {...generator.DEFAULTS, jawEnabled:true,headMin:32,headMax:60,armEnabled:false,armMin:360,armMax:720, eyeChoices: [...generator.DEFAULTS.eyeChoices]};
const cases = {
  FixedEye:{eyesEnabled:true,eyeChoices:[7]},
  HauntedInterleaved:{...generator.PRESETS.haunted},
  CustomPalettesAndRetry:{jawEnabled:false,lightsEnabled:true,lightRotation:true,palette0Name:"Custom",palette0Torso:"#123456",palette0Head:"#abcdef",scanRetrySec:10,startupRetrySec:5,startupWindowSec:90},
  RotatingStaticLights:{headEnabled:false,jawEnabled:false,lightsEnabled:true,lightRotation:true,lightInterval:15,lightPalettes:[0,2]},
  MixedLightEffects:{headEnabled:false,jawEnabled:false,lightsEnabled:true,torsoEffect:3,headEffect:2,torsoSpeed:0,headSpeed:254},
  RotatingEffectsWithClockRest:{lightsEnabled:true,lightRotation:true,lightInterval:30,lightPalettes:[1,3],torsoEffect:3,headEffect:1,clockEnabled:true,restEnabled:true},
  RotatingEffectsWithJawPool:{lightsEnabled:true,lightRotation:true,lightInterval:15,torsoEffect:2,headEffect:3,jawExtras:"13,14",lightRestoreMode:2},
  ClockWithIdleBreaks:{clockEnabled:true,restEnabled:true},
  Watchful:{...generator.PRESETS.watchful},
  Storyteller:{...generator.PRESETS.storyteller},
  UsbClockFairAndNotifications:{clockEnabled:true,clockStart:1320,clockEnd:120,clockDays:32,fairBodyTurns:true,playbackDiagnostics:true,lightsEnabled:true},
  PerFileLongerClips:{jawClipSec:30,jawExtras:"13,14",jawDurations:"13:24,14:45",eyesEnabled:true,lightsEnabled:true,restEnabled:true},
  FairCompoundWindow:{headEnabled:true,armEnabled:true,torsoEnabled:true,compoundEnabled:true,fairBodyTurns:true,clockEnabled:true,clockStart:0,clockEnd:720,clockDays:65},
  Normal: {...generator.PRESETS.normal},
  MovementEyesAndLights: {jawEnabled:false,headEnabled:true,armEnabled:true,torsoEnabled:true,eyesEnabled:true,lightsEnabled:true,clockEnabled:true},
  HauntedWithBothMotors: {jawEnabled:false,torsoEnabled:true,torsoMin:180,torsoMax:360,armEnabled:true,armMin:360,armMax:720,bodyOverlap:false,headMin:32,headMax:45,jawMin:30,jawMax:60},
  BodyMotorOverlapExperimental: {torsoEnabled:true,armEnabled:true,bodyOverlap:true,eyesEnabled:true},
  FastMotorJawProtected: {torsoEnabled:true,torsoMin:45,torsoMax:60,armEnabled:true,armMin:45,armMax:60,bodyOverlap:true,jawEnabled:true,jawProtectBody:true},
  JawFirstArmTwoSeconds: {headEnabled:false,torsoEnabled:false,armEnabled:true,jawEnabled:true,jawFile:13,jawFollowupMotor:1,jawFollowupDelaySec:2,jawProtectBody:true},
  JawFirstRecurringArm: {headEnabled:false,torsoEnabled:false,armEnabled:true,armMin:180,armMax:300,jawEnabled:true,jawFile:13,jawFollowupMotor:1,jawFollowupDelaySec:2,jawFollowupRecurring:true,jawProtectBody:true},
  JawFirstRecurringTorso: {headEnabled:false,torsoEnabled:true,torsoMin:120,torsoMax:240,armEnabled:false,jawEnabled:true,jawFile:14,jawFollowupMotor:2,jawFollowupDelaySec:2,jawFollowupRecurring:true,jawProtectBody:true},
  JawFirstAlternatingMotors: {headEnabled:false,armEnabled:true,torsoEnabled:true,armMin:90,armMax:150,torsoMin:90,torsoMax:150,jawEnabled:true,jawFile:13,jawFollowupMotor:3,jawFollowupRecurring:true,jawFollowupDelaySec:2,jawProtectBody:true},
  CompoundAllMasks: {headEnabled:true,armEnabled:true,torsoEnabled:true,jawEnabled:true,jawFile:13,jawFollowupMotor:0,compoundEnabled:true,compoundMasks:[3,5,6,7],compoundMin:180,compoundMax:300,jawProtectBody:true,bodyOverlap:false},
  CompoundTorsoArmOnly: {headEnabled:false,armEnabled:true,torsoEnabled:true,jawEnabled:false,compoundEnabled:true,compoundMasks:[6],compoundMin:100,compoundMax:180},
  LightsAfterJaw: {lightsEnabled:true,torsoColor:"#ff0000",headColor:"#00ff00",torsoBrightness:180,headBrightness:150,lightRestoreMode:1,jawFile:13},
  LightsDuringJaw: {lightsEnabled:true,torsoColor:"#aabbcc",headColor:"#ffee99",torsoBrightness:40,headBrightness:255,lightRestoreMode:2,jawFile:13},
  LightingDiagnostic: {headEnabled:false,armEnabled:false,torsoEnabled:false,eyesEnabled:false,restEnabled:false,jawEnabled:true,jawFile:13,jawMin:60,jawMax:60,jawExtras:"",jawFollowupMotor:0,compoundEnabled:false,lightsEnabled:true,torsoColor:"#ff0000",headColor:"#00ff00",torsoBrightness:180,headBrightness:150,lightRestoreMode:1,diagnosticsEnabled:true},
  CompoundAndLights: {headEnabled:true,armEnabled:true,torsoEnabled:true,jawFile:13,compoundEnabled:true,compoundMasks:[3,7],lightsEnabled:true,lightRestoreMode:2},
  JawFirstHeadOneShot: {headEnabled:true,headMin:90,headMax:150,armEnabled:false,torsoEnabled:false,jawEnabled:true,jawFile:13,jawFollowupMotor:4,jawFollowupRecurring:false,jawFollowupDelaySec:2,jawProtectBody:true,bodyOverlap:false,eyesEnabled:false},
  JawFirstHeadRecurring: {headEnabled:true,headMin:90,headMax:150,armEnabled:false,torsoEnabled:false,jawEnabled:true,jawFile:13,jawFollowupMotor:4,jawFollowupRecurring:true,jawFollowupDelaySec:2,jawProtectBody:true,bodyOverlap:false,eyesEnabled:false},
  HeadOnJawFirstAlternatingProtected: {headEnabled:true,headMin:60,headMax:90,armEnabled:true,torsoEnabled:true,armMin:90,armMax:150,torsoMin:90,torsoMax:150,jawEnabled:true,jawMin:45,jawMax:60,jawFile:13,jawFollowupMotor:3,jawFollowupRecurring:true,jawFollowupDelaySec:2,jawProtectBody:true,overlap:true,bodyOverlap:false},
  HeadOnJawFirstAlternatingUnprotected: {headEnabled:true,armEnabled:true,torsoEnabled:true,jawEnabled:true,jawFile:13,jawFollowupMotor:3,jawFollowupRecurring:true,jawProtectBody:false,overlap:true,bodyOverlap:false},
  JawFirstTorsoFourSeconds: {headEnabled:false,torsoEnabled:true,armEnabled:false,jawEnabled:true,jawFile:14,jawFollowupMotor:2,jawFollowupDelaySec:4,jawProtectBody:true},
  FastMotorJawUnprotected: {torsoEnabled:true,torsoMin:45,torsoMax:60,armEnabled:true,armMin:45,armMax:60,bodyOverlap:true,jawEnabled:true,jawProtectBody:false},
  ArmOnlyVerified: {headEnabled:false,jawEnabled:false,eyesEnabled:false,torsoEnabled:false,armEnabled:true,armMin:360,armMax:720},
  SubtleHeadOnly: {...generator.PRESETS.subtle},
  RandomEyes: {eyesEnabled:true,eyeMin:30,eyesMin:30,eyesMax:60,eyeChoices:[1,2,5,12]},
  JawPoolAndRest: {jawExtras:"13,14",restEnabled:true,restMin:180,restMax:420,restDurationMin:25,restDurationMax:60,overlap:false},
  EyeRestoreAfterJaw: {eyesEnabled:true,eyeJawMode:1,eyesMin:20,eyesMax:40,eyeChoices:[2,4,6]},
  EyeChangeWithJaw: {eyesEnabled:true,eyeJawMode:2,eyesMin:20,eyesMax:40,eyeChoices:[1,3,5,9]},
  JawMP3EyeMode: {eyesEnabled:true,eyeJawMode:0,eyesMin:20,eyesMax:40}
};
for(const key of ['moonlit','haunted','ember'])cases['SceneStarter_'+key]=require('../scene-model.js').starter(key,generator).profile.config;
for(const [name,options] of Object.entries(cases)) {
  const settings={...base,...options};
  const code=generator.generateSketch(settings);
  const dir=path.join(buildRoot,name);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,name+".ino"),code,"utf8");
  console.log("Generated "+name+" ("+code.length+" characters)");
}
for(const [name,scenes,rotate,random] of [
  ['RuntimeRandomScenes',[{name:'One',seconds:600,config:{...generator.DEFAULTS}},{name:'Two',seconds:600,config:{...generator.DEFAULTS,...generator.PRESETS.subtle}},{name:'Three',seconds:600,config:{...generator.DEFAULTS,...generator.PRESETS.haunted}}],true,true],
  ['RuntimeSingle',[{name:'Subtle',seconds:300,config:{...generator.DEFAULTS,...generator.PRESETS.subtle}}],false],
  ['RuntimeScenes',[{name:'Subtle',seconds:300,config:{...generator.DEFAULTS,...generator.PRESETS.subtle}},{name:'Haunted',seconds:600,config:{...generator.DEFAULTS,...generator.PRESETS.haunted,eyesEnabled:true,lightsEnabled:true}}],true],
  ['RuntimeJawProtected',[{name:'Limited mouth',seconds:600,config:{...generator.DEFAULTS,jawEnabled:true,jawFile:13,jawExtras:'12,14',jawDurations:'12:30,14:45',fairBodyTurns:true,eyesEnabled:true,lightsEnabled:true,restEnabled:true,clockEnabled:true}}],false]
]) {const dir=path.join(buildRoot,name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name+'.ino'),generator.generateRuntimeSketch(scenes,rotate,random));console.log('Generated '+name);}

for(const runtime of [false,true]){const name=runtime?'RuntimeAudioScene':'AudioScene',dir=path.join(buildRoot,name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name+'.ino'),require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'export-audio-fixture.cjs'),...(runtime?['--runtime']:[])],{encoding:'utf8'}));}

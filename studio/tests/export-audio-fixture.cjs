const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.resolve(__dirname,'..');
const c=vm.createContext({window:{},TextEncoder,TextDecoder});for(const f of ['template.js','runtime-schema.js','runtime.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const g=c.window.SkellyStudioGenerator,config={...g.DEFAULTS,headEnabled:true,armEnabled:true,torsoEnabled:true,jawEnabled:true,jawMin:180,jawMax:300,jawClipSec:30,jawFile:27,eyeJawMode:3,overlap:false,jawProtectBody:true,jawFollowupMotor:0,lightsEnabled:true,lightRestoreMode:1,eyesEnabled:true,eyeChoices:[4,8],eyesMin:15,eyesMax:30};
process.stdout.write(process.argv.includes('--runtime')?g.generateRuntimeSketch([{name:'Audio preview',seconds:600,config}]):g.generateSketch(config));

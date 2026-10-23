const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.resolve(__dirname,'..');
const c=vm.createContext({window:{},TextEncoder,TextDecoder});for(const f of ['template.js','runtime-schema.js','runtime.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const g=c.window.SkellyStudioGenerator;
const scenes=[{name:'Quiet',seconds:60,config:{...g.DEFAULTS,...g.PRESETS.subtle,eyeChoices:Array.from({length:18},(_,i)=>i+1)}},{name:'Haunted',seconds:120,config:{...g.DEFAULTS,...g.PRESETS.haunted,lightsEnabled:true,eyesEnabled:true}}];
process.stdout.write(g.generateRuntimeSketch(scenes,true));

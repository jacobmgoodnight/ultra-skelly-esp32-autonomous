const fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({window:{},TextEncoder,TextDecoder});
for(const file of ['template.js','runtime-schema.js','runtime.js','app.js'])vm.runInContext(fs.readFileSync(__dirname+'/../'+file,'utf8'),c);
const g=c.window.SkellyStudioGenerator;
const config=g.adaptDevice({...g.DEFAULTS,bleName:'12ft Skelly',eyesEnabled:true,eyeChoices:[19,20],lightsEnabled:true,torsoEffect:3},'skelly12');
process.stdout.write(process.argv.includes('--runtime')?g.generateRuntimeSketch([{name:'Experimental',seconds:600,config}]):g.generateSketch(config));

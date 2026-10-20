const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const ctx = vm.createContext({window:{}});
for(const file of ["studio/template.js","studio/app.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),ctx,{filename:file});
}
const generator = ctx.window.SkellyStudioGenerator;
const base = {...generator.DEFAULTS, eyeChoices: [...generator.DEFAULTS.eyeChoices]};
const cases = {
  Normal: {},
  SubtleHeadOnly: {jawEnabled:false, headMin:65, headMax:120},
  RandomEyes: {eyesEnabled:true,eyeMin:30,eyesMin:30,eyesMax:60,eyeChoices:[1,2,5,12]},
  JawPoolAndRest: {jawExtras:"13,14",restEnabled:true,restMin:180,restMax:420,restDurationMin:25,restDurationMax:60,overlap:false},
  EyeRestoreAfterJaw: {eyesEnabled:true,eyeJawMode:1,eyesMin:20,eyesMax:40,eyeChoices:[2,4,6]},
  EyeChangeWithJaw: {eyesEnabled:true,eyeJawMode:2,eyesMin:20,eyesMax:40,eyeChoices:[1,3,5,9]},
  JawMP3EyeMode: {eyesEnabled:true,eyeJawMode:0,eyesMin:20,eyesMax:40}
};
for(const [name,options] of Object.entries(cases)) {
  const settings={...base,...options};
  const code=generator.generateSketch(settings);
  const dir=path.join(root,".skelly-build",name);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,name+".ino"),code,"utf8");
  console.log("Generated "+name+" ("+code.length+" characters)");
}

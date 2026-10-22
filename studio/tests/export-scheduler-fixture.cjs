const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"../..");
const context=vm.createContext({window:{}});
for(const file of ["studio/template.js","studio/app.js"])
  vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context);
const api=context.window.SkellyStudioGenerator;
process.stdout.write(api.generateSketch({...api.DEFAULTS,
  headEnabled:true,armEnabled:true,torsoEnabled:true,compoundEnabled:true,
  jawExtras:"13, 14",lightsEnabled:false,eyesEnabled:false,restEnabled:false}));

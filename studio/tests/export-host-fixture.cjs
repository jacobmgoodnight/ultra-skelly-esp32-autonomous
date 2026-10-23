// Feed the native harness a real Studio-generated sketch, preserving default
// lighting bytes so the same independently known CRC vectors apply.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const context = vm.createContext({window:{}});
for (const file of ["studio/template.js", "studio/app.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
}
const api = context.window.SkellyStudioGenerator;
process.stdout.write(api.generateSketch({
  ...api.DEFAULTS,
  // Preserve these independently known packet vectors across Studio default changes.
  torsoBrightness:180,headBrightness:180,eyeChoices:Array.from({length:18},(_,i)=>i+1),
  ...(process.argv.includes('--audio-free')
    ? {headEnabled:true,armEnabled:true,torsoEnabled:true,eyesEnabled:true,lightsEnabled:true,restEnabled:true}
    : {jawEnabled:true,headEnabled:false,armEnabled:false,lightsEnabled:true,diagnosticsEnabled:true})
}));

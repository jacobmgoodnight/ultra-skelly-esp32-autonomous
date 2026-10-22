// A fixed, audio-free first routine. No custom-source compilation in the browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'.skelly-build/prebuilt/HeadOnly'));
const context=vm.createContext({window:{}});
for(const file of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,'studio',file),'utf8'),context);
const generator=context.window.SkellyStudioGenerator;
const config={...generator.DEFAULTS,headMin:120,headMax:240,jawEnabled:false};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'HeadOnly.ino'),generator.generateSketch(config));
console.log(path.join(out,'HeadOnly.ino'));

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ctx=vm.createContext({window:{}});
for(const f of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,'studio',f),'utf8'),ctx);
const g=ctx.window.SkellyStudioGenerator;
const mixed=process.argv.includes('--mixed'),single=process.argv.includes('--single');
process.stdout.write(g.generateSketch({...g.DEFAULTS,headEnabled:false,armEnabled:false,torsoEnabled:false,jawEnabled:false,
  jawEnabled:process.argv.includes('--jaw'),lightsEnabled:true,lightRotation:true,lightInterval:15,lightPalettes:[0,2],torsoEffect:mixed?3:1,headEffect:single?1:mixed?2:1,
  torsoSpeed:0,headSpeed:254,clockEnabled:true,clockStart:0,clockEnd:1439,restEnabled:true}));

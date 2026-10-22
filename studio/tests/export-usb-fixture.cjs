const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ctx=vm.createContext({window:{}});
for(const f of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,'studio',f),'utf8'),ctx);
const g=ctx.window.SkellyStudioGenerator;
process.stdout.write(g.generateSketch({...g.DEFAULTS,jawEnabled:true,headEnabled:true,armEnabled:true,torsoEnabled:true,
  compoundEnabled:true,compoundMin:45,compoundMax:45,fairBodyTurns:true,playbackDiagnostics:true,clockEnabled:true,lightsEnabled:true,restEnabled:true,
  clockStart:1320,clockEnd:120,clockDays:32,jawMin:22,jawMax:22,jawExtras:'13,14',jawDurations:'13:24,14:30'}));

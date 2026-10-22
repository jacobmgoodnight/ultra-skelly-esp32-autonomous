const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const c=vm.createContext({window:{}});for(const f of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);
const g=c.window.SkellyStudioGenerator;
process.stdout.write(g.generateSketch({...g.DEFAULTS,...g.PRESETS.haunted}));

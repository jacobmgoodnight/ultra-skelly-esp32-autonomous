const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'.skelly-build/prebuilt/Universal'));
const c=vm.createContext({window:{},TextEncoder,TextDecoder});for(const f of ['template.js','runtime-schema.js','runtime.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,'studio',f),'utf8'),c);
const g=c.window.SkellyStudioGenerator,deviceId=process.argv[3]||'ultra';
if(!['ultra','skelly12'].includes(deviceId))throw Error('Unknown installer device');
const config=g.adaptDevice({...g.DEFAULTS,...g.PRESETS.subtle,deviceId,bleName:g.DEVICE_PROFILES[deviceId].bleName},deviceId);
const source=g.generateRuntimeSketch([{name:'Subtle',seconds:600,config}]);
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'Universal.ino'),source);console.log(path.join(out,'Universal.ino'));

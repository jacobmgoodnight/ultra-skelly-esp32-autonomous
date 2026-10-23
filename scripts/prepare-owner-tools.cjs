// Reproducible portable profiles and a separately gated, read-only experiment.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({window:{},TextEncoder,TextDecoder});
for(const file of ['template.js','runtime-schema.js','runtime.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,'studio',file),'utf8'),context);
const g=context.window.SkellyStudioGenerator;
function profiles(){return Object.fromEntries(['subtle','normal','haunted'].map(name=>[name,g.createProfile({...g.DEFAULTS,...g.PRESETS[name]}, {})+'\n']));}
function wirelessSketch(){
  const source=g.generateRuntimeSketch([{name:'Subtle',seconds:600,config:{...g.DEFAULTS,...g.PRESETS.subtle}}]);
  const anchor='#define SKELLY_WIRELESS_STATUS 0';
  if(source.split(anchor).length!==2)throw Error('Wireless experiment anchor missing or duplicated.');
  return source.replace(anchor,'#define SKELLY_WIRELESS_STATUS 1');
}
if(require.main===module){
  if(process.argv.includes('--wireless')){
    const out=path.join(root,'.skelly-build/WirelessStatusExperiment');
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'WirelessStatusExperiment.ino'),wirelessSketch());
    console.log('EXPERIMENTAL / hardware UNTESTED: '+out);
  }else for(const [name,source] of Object.entries(profiles())){
    const target=path.join(root,'studio/presets',name+'.json');
    if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==source)throw Error('Preset drift: '+name);}
    else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,source);}
  }
}
module.exports={profiles,wirelessSketch};

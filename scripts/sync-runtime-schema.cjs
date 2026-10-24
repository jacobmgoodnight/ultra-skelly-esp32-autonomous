// Generate only the marked runtime schema in the canonical sketch, never template.js.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const schema=require('../studio/runtime-schema.js'),runtime=require('../studio/runtime.js');
const root=path.resolve(__dirname,'..'),file=path.join(root,'firmware/SkellyAutonomous/SkellyAutonomous.ino');
const ctx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'studio/app.js'),'utf8'),ctx);
const g=ctx.window.SkellyStudioGenerator,seed=runtime.encode([{config:{...g.DEFAULTS,...g.PRESETS.subtle},seconds:600}],false,g.validate);
let block='// BEGIN GENERATED RUNTIME SCHEMA\n';
block+='enum RuntimeField {\n'+schema.fields.map(f=>'  RF_'+f.name+',').join('\n')+'\n  RF_COUNT\n};\n';
block+='const uint32_t RUNTIME_LIMITS[RF_COUNT][2] = {\n'+schema.fields.map(f=>'  {'+f.min+'UL,'+f.max+'UL}, // '+f.name).join('\n')+'\n};\n';
block+='const uint32_t RUNTIME_SEED[] = {'+seed.map(n=>n+'UL').join(',')+'};\n';
block+='uint32_t runtimeValues[RF_COUNT] = {};\nuint8_t runtimeEyes[DEVICE_PROFILE.eyeCount], runtimeEyeCount=0, runtimeMasks[4], runtimeMaskCount=0;\nuint16_t runtimeFiles[8];\nuint8_t runtimeFileCount=0;\nuint8_t runtimePalettes[4][6];\nchar runtimeName[49];\n';
for(const f of schema.fields)if(f.macro){block+='#undef '+f.macro+'\n#define '+f.macro+' ('+(f.expression||'v').replaceAll('v','runtimeValues[RF_'+f.name+']')+')\n';}
for(const [prefix,name] of [['TORSO_LIGHT','torsoColor'],['HEAD_LIGHT','headColor']])for(const [i,ch] of ['R','G','B'].entries())block+='#define '+prefix+'_'+ch+' ((runtimeValues[RF_'+name+'] >> '+(16-i*8)+') & 255UL)\n';
for(const [macro,value] of Object.entries({SKELLY_NAME:'runtimeName',COMPOUND_BODY_MASKS:'runtimeMasks',LIGHT_PALETTES:'runtimePalettes',EYE_OPTIONS:'runtimeEyes',EYE_OPTIONS_COUNT:'runtimeEyeCount',EYE_ROTATION_ENABLED:'(runtimeEyeCount > 1)',JAW_FILE_POOL:'runtimeFiles',JAW_POOL_COUNT:'runtimeFileCount'}))block+='#undef '+macro+'\n#define '+macro+' '+value+'\n';
block+='// END GENERATED RUNTIME SCHEMA';
const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),pattern=/\/\/ BEGIN GENERATED RUNTIME SCHEMA[\s\S]*?\/\/ END GENERATED RUNTIME SCHEMA/;
if(!pattern.test(source))throw Error('Runtime schema markers missing');
const out=source.replace(pattern,block);
if(process.argv.includes('--check')){if(out!==source)throw Error('Runtime schema is stale');}else fs.writeFileSync(file,out);

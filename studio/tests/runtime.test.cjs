const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const r=require('../runtime.js'),{validateLibrary}=require('../scenes.js'),{Session}=require('../serial.js');
const ctx=vm.createContext({window:{},TextEncoder,TextDecoder});for(const f of ['template.js','runtime-schema.js','runtime.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);const g=ctx.window.SkellyStudioGenerator;
const plain=o=>JSON.parse(JSON.stringify(o)),config=(extra={})=>({...g.DEFAULTS,...extra});
test('universal program round trip retains all firmware settings, scene names and custom palette names',()=>{
 const c=config({...g.PRESETS.haunted,palette0Name:'Midnight',palette0Torso:'#123456',eyeChoices:[2,6,18],jawExtras:'13,14',jawDurations:'13:35',clockEnabled:true,restEnabled:true});
 const program=[{name:'My custom scene',seconds:600,config:c}];const words=r.encode(program,true,g.validate),decoded=r.decode(words,g.DEFAULTS);assert.equal(decoded.rotate,true);assert.equal(decoded.scenes[0].name,'My custom scene');assert.equal(decoded.scenes[0].seconds,600);
 const output=decoded.scenes[0].config;for(const key of Object.keys(c).filter(k=>k!=='jawExtras'))assert.deepEqual(plain(output[key]),plain(c[key]),key);assert.equal(output.jawExtras,'13, 14');assert.equal(r.crc(words),r.crc(r.encode(decoded.scenes,true,g.validate)));
});
test('runtime rejects failed diagnostics, mismatched Skelly names and invalid scene intervals',()=>{
 assert.throws(()=>r.encode([{config:config({jawEnabled:true,jawFollowupMotor:4}),seconds:300}],false,g.validate),/failed head/);
 assert.throws(()=>r.encode([{config:config(),seconds:59}],false,g.validate),/holdSec/);
 assert.throws(()=>r.encode([{config:config()},{config:config({bleName:'Other'})}],false,g.validate),/same Skelly/);
 assert.throws(()=>r.encode(Array(5).fill({config:config()}),true,g.validate),/one to four/);
});
test('universal sketch enables runtime hooks without changing ordinary generated defaults',()=>{
 const sketch=g.generateRuntimeSketch([{name:'Haunted',seconds:300,config:config(g.PRESETS.haunted)}]);assert.ok(sketch.startsWith('#define SKELLY_RUNTIME 1'));assert.match(sketch,/class RuntimeEngine/);assert.match(sketch,/Preferences/);assert.match(sketch,/USB CFG APPLIED/);assert.match(sketch,/REST_ENABLED = true/);
 assert.ok(!g.generateSketch(config()).startsWith('#define SKELLY_RUNTIME 1'));
});
test('scene libraries validate every saved configuration before returning any entry',()=>{
 const p=JSON.parse(g.createProfile(config(),{})),library={app:'SkellyScenes',version:1,rotate:false,scenes:[{name:'Quiet',seconds:300,profile:p}]};assert.equal(validateLibrary(library,g).scenes.length,1);
 assert.throws(()=>validateLibrary({...library,scenes:[...library.scenes,{...library.scenes[0]}]},g),/unique/);
 assert.throws(()=>validateLibrary({...library,scenes:[{...library.scenes[0],profile:{...p,config:{...p.config,headMin:1}}}]},g));
});
test('protocol parsing continues after capture is full and matches only fresh acknowledgments',async()=>{
 const s=new Session(null);s.capture.limit=0;s.capture.clear();s.ingest(new TextEncoder().encode('[ 1 ms] USB CFG ACK 7 8\n'));const after=s.messageSerial;const promise=s.waitFor(t=>t==='USB CFG ACK 7 8',after,1000);s.ingest(new TextEncoder().encode('[ 2 ms] USB CFG ACK 7 '));s.ingest(new TextEncoder().encode('8\n'));assert.equal((await promise).id,after+1);
});
test('USB writer waits for each chunk and verifies application acknowledgment',async()=>{
 const s=new Session(null);s.port={};const sent=[];s.send=async command=>{sent.push(command);const a=command.trim().split(' '),id=a[3];let reply;if(a[2]==='BEGIN')reply='USB CFG ACK '+id+' 0';if(a[2]==='DATA')reply='USB CFG ACK '+id+' '+(Number(a[4])+a.length-5);if(a[2]==='COMMIT')reply='USB CFG QUEUED '+id+'\nUSB CFG APPLIED '+id+' 1 42';if(reply)s.ingest(new TextEncoder().encode(reply+'\n'));};
 const result=await s.writeSettings([1,2,3,4,5,6,7,8,9],42);assert.match(result.text,/APPLIED/);assert.equal(sent.filter(x=>x.includes(' DATA ')).length,2);assert.equal(s.operation,false);
});
test('USB read-back rejects missing/out-of-order chunks and collects a coherent snapshot',async()=>{
 const s=new Session(null);s.port={};s.send=async command=>{const id=command.trim().split(' ').at(-1);s.ingest(new TextEncoder().encode('USB CFG DUMP '+id+' 3 9 42\nUSB CFG DATA '+id+' 0 00000001 00000002 00000003\nUSB CFG END '+id+'\n'));};
 assert.deepEqual(await s.readSettings(),{words:[1,2,3],sequence:9,crc:42});
 s.send=async command=>{const id=command.trim().split(' ').at(-1);s.ingest(new TextEncoder().encode('USB CFG DUMP '+id+' 3 9 42\nUSB CFG DATA '+id+' 1 00000001\nUSB CFG END '+id+'\n'));};await assert.rejects(s.readSettings(),/out of order/);assert.equal(s.operation,false);
});
test('storage rejection never reports a successful USB save',async()=>{
 const s=new Session(null);s.port={};s.send=async command=>{const p=command.trim().split(' '),id=p[3];let line=p[2]==='BEGIN'?'USB CFG ACK '+id+' 0':p[2]==='DATA'?'USB CFG ACK '+id+' '+(Number(p[4])+p.length-5):p[2]==='COMMIT'?'USB CFG QUEUED '+id+'\nUSB CFG ERROR '+id+' STORAGE':'';if(line)s.ingest(new TextEncoder().encode(line+'\n'));};await assert.rejects(s.writeSettings([1,2,3],42),/STORAGE/);assert.equal(s.operation,false);
});

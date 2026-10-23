const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const stateApi=require('../controller-state.js'),runtime=require('../runtime.js');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'controller.js'),'utf8');
const generatorContext=vm.createContext({window:{}});for(const file of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),generatorContext);
const generator=generatorContext.window.SkellyStudioGenerator;
class Element{
 constructor(){Object.assign(this,{textContent:'',dataset:{},disabled:false,hidden:false,checked:false,open:false,children:[]});}
 replaceChildren(...nodes){this.children=nodes;}append(...nodes){this.children.push(...nodes);}
}
function page({supported=true,settings=true,statusFails=false,badReadback=false,allowScenes=true,keepRead=false}={}){
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()])),events={},windowEvents={};
 let sceneLibrary=[],connects=0,config={...generator.DEFAULTS},created=0,records=[];
 class FakeSession{
  constructor(){created++;this.port=null;this.capture={size:40,text:'Mock UART log'};this.messageSerial=0;this.operations=[];this.words=runtime.encode([{name:'Saved',seconds:600,config}],false,generator.validate);}
  async connect(){connects++;this.port={};this.onChange();}
  async disconnect(){this.port=null;this.onChange();}
  async capabilities(){return {text:'USB CAPS v2 settings='+Number(settings)+' scenes=4 randomScenes=1'};}
  async status(){if(statusFails)throw Error('timeout');return {text:'USB STATUS v2 runtime=1 connected=0 scene=0 sequence=2 crc=42 pending=0 failures=0 heap=133324 clock=0 window=1'};}
  async readSettings(){this.operations.push('read');return {words:this.words,sequence:2,crc:runtime.crc(this.words)+(badReadback?1:0)};}
  async writeSettings(words,crc,progress){this.operations.push('write');assert.equal(crc,runtime.crc(words));progress(20);progress('waiting');this.words=words;}
 }
 let session;
 const document={hidden:false,getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},createElement:()=>new Element(),querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn};
 const window={SkellySerial:{Session:class extends FakeSession{constructor(){super();session=this;}}},SkellyRuntime:runtime,SkellyControllerState:stateApi,
  SkellyScenes:{snapshot:()=>({scenes:sceneLibrary}),program:()=>({scenes:sceneLibrary,rotate:false}),confirmSendScenes:async()=>allowScenes,recordController:(program,kind)=>records.push({program,kind}),loadProgram:async program=>{if(keepRead)return false;sceneLibrary=program.scenes;events['skelly-scenes-changed']?.();return true;}},
  SkellyStudioGenerator:{...generator,readConfig:()=>config,writeConfig:c=>config=c,writeLibrary:()=>{},downloadText:()=>{}},addEventListener:(name,fn)=>windowEvents[name]=fn};
 const context=vm.createContext({window,document,navigator:supported?{serial:{}}:{}});vm.runInContext(source,context);events.DOMContentLoaded();
 return {nodes,document,events,windowEvents,records,get session(){return session;},get config(){return config;},get connects(){return connects;},get created(){return created;},async close(){if(session.port)await nodes.controllerDisconnect.onclick();else windowEvents.pagehide();}};
}
test('one explicit USB session serves the separate everyday panel and diagnostics; USB ready is independent of Bluetooth',async()=>{
 const p=page();try{
  assert.equal(p.connects,0);assert.equal(p.created,1);assert.equal(p.nodes.controllerWrite.disabled,true);
  await p.nodes.controllerConnect.onclick();assert.equal(p.nodes.controllerUsb.textContent,'Ready');assert.equal(p.nodes.controllerSkelly.textContent,'Not connected yet');assert.equal(p.nodes.controllerRead.disabled,false);assert.equal(p.nodes.controllerScenes.disabled,true);
  await p.nodes.controllerRead.onclick();assert.equal(p.config.headMin,generator.DEFAULTS.headMin);assert.equal(p.nodes.controllerScenes.disabled,false);assert.match(p.nodes.controllerMessage.textContent,/Read 1/);
  assert.ok(p.nodes.controllerDetails.children.length);await p.nodes.controllerDisconnect.onclick();assert.equal(p.nodes.controllerSkelly.textContent,'Unknown');assert.equal(p.nodes.controllerDetails.children.length,0);assert.equal(p.nodes.controllerRead.disabled,true);assert.equal(p.created,1);
 }finally{await p.close();}
});
test('incompatible firmware reveals first-time setup without sending settings',async()=>{
 const p=page({settings:false});try{await p.nodes.controllerConnect.onclick();assert.equal(p.nodes.controllerSetup.open,true);assert.equal(p.nodes.controllerWrite.disabled,true);assert.equal(p.nodes.controllerRead.disabled,true);assert.equal(p.session.operations.length,0);}finally{await p.close();}
});

test('unplug during a manual status refresh keeps the disconnected message and clears current details',async()=>{
 const p=page();try{
  await p.nodes.controllerConnect.onclick();
  p.session.status=async()=>{p.session.port=null;p.session.onChange();throw Error('USB disconnected');};
  await p.nodes.controllerStatus.onclick();
  assert.equal(p.nodes.controllerUsb.textContent,'Not connected');assert.equal(p.nodes.controllerSkelly.textContent,'Unknown');
  assert.match(p.nodes.controllerMessage.textContent,/USB disconnected/);assert.equal(p.nodes.controllerDetails.children.length,0);
 }finally{await p.close();}
});
test('unsupported browsers retain editing/download guidance and do not open a port',()=>{
 const p=page({supported:false});assert.equal(p.nodes.controllerConnect.disabled,true);assert.match(p.nodes.controllerMessage.textContent,/Chrome or Edge/);assert.equal(p.connects,0);p.windowEvents.pagehide();
});
test('replacement confirmation gates actual saves and successful read-back is shown even if status is unavailable',async()=>{
 const p=page({statusFails:true});try{
  await p.nodes.controllerConnect.onclick();assert.equal(p.nodes.controllerUsb.textContent,'Ready');assert.equal(p.nodes.controllerSkelly.textContent,'Unknown');
  await p.nodes.controllerWrite.onclick();assert.match(p.nodes.controllerMessage.textContent,/Confirm replacing/);assert.equal(p.session.operations.length,0);
  p.nodes.controllerConsent.checked=true;await p.nodes.controllerWrite.onclick();assert.deepEqual(p.session.operations,['write','read']);assert.match(p.nodes.controllerMessage.textContent,/read-back verified/);assert.equal(p.nodes.controllerMessage.dataset.state,'ready');
 }finally{await p.close();}
});
test('checksum mismatch is never labeled saved and never auto-retries a mutation',async()=>{
 const p=page({badReadback:true});try{await p.nodes.controllerConnect.onclick();p.nodes.controllerConsent.checked=true;await p.nodes.controllerWrite.onclick();assert.match(p.nodes.controllerMessage.textContent,/did not match/);assert.equal(p.nodes.controllerMessage.dataset.state,'error');assert.deepEqual(p.session.operations,['write','read']);assert.equal(p.records.length,0);}finally{await p.close();}
});

test('canceling the asynchronous unsaved-scenes confirmation sends no settings',async()=>{
 const p=page({allowScenes:false});try{await p.nodes.controllerConnect.onclick();await p.nodes.controllerRead.onclick();p.nodes.controllerConsent.checked=true;await p.nodes.controllerScenes.onclick();assert.deepEqual(p.session.operations,['read']);assert.match(p.nodes.controllerMessage.textContent,/No scenes sent/);}finally{await p.close();}
});

test('canceling replacement after a verified USB read preserves editor configuration and browser scenes',async()=>{
 const p=page({keepRead:true});try{await p.nodes.controllerConnect.onclick();p.session.words=runtime.encode([{name:'Other',seconds:600,config:{...generator.DEFAULTS,headMin:40}}],false,generator.validate);await p.nodes.controllerRead.onclick();assert.equal(p.config.headMin,35);assert.equal(p.nodes.controllerScenes.disabled,true);assert.match(p.nodes.controllerMessage.textContent,/were kept/);assert.equal(p.records[0].program.scenes[0].config.headMin,40);}finally{await p.close();}
});

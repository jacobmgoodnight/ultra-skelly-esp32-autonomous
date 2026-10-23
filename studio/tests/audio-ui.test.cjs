const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const a=require('../audio.js'),experience=require('../experience.js'),root=path.resolve(__dirname,'..');
const gc=vm.createContext({window:{}});for(const file of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),gc);const generator=gc.window.SkellyStudioGenerator;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
class Element{constructor(){Object.assign(this,{value:'',checked:false,disabled:false,hidden:false,textContent:'',dataset:{},children:[],files:[]});}replaceChildren(){this.children=[];}append(node){this.children.push(node);}}
function page({supported=true,usb=false,saveError=false}={}){
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));nodes.audioMin.value='180';nodes.audioMax.value='300';
 let chosen=true;const preset={classList:{remove:()=>chosen=false}};const events={};const document={getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},createElement:()=>new Element(),querySelectorAll:()=>[preset],addEventListener:(name,fn)=>(events[name]??=[]).push(fn),dispatchEvent:e=>{for(const fn of events[e.type]??[])fn(e);}};
 let config={...generator.DEFAULTS},connects=0,saves=0,session;
 const file={serial:27,cluster:45,name:'Greeting.mp3',action:3,eye:8,lights:[0,1].map(()=>({mode:1,brightness:255,color:'#b28df9',speed:129,cycle:0}))};
 class FakeSession{constructor(_,options){session=this;this.onChange=options.onChange;this.connected=this.busy=false;this.files=[];}
  async connect(name){this.name=name.trim();connects++;this.connected=true;this.files=[file];this.onChange();}
  disconnect(){this.connected=false;this.files=[];this.onChange();}cancel(){this.disconnect();}
  async refresh(){this.onChange();}
  async save(f,value){saves++;if(saveError)throw Error('Clip settings did not match read-back.');const saved={...f,action:value.action,eye:value.eye,lights:value.lights.map(l=>({mode:l.mode,brightness:l.brightness,color:l.color,speed:254-l.speed,cycle:Number(l.cycle)}))};this.files=[saved];return saved;}
 }
 const window={SkellyAudio:{...a,Session:FakeSession},SkellyStudioGenerator:{...generator,readConfig:()=>config,writeConfig:c=>{config={...config,...c};document.dispatchEvent({type:'skelly-config-changed'});}},SkellyExperience:experience,SkellyControllerPortOpen:()=>usb,addEventListener:()=>{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'audio-ui.js'),'utf8'),{document,window,navigator:{bluetooth:supported?{}:undefined},CustomEvent:class{constructor(type){this.type=type;}},Uint8Array,Date});events.DOMContentLoaded[0]();
 return {nodes,window,session,get chosen(){return chosen;},get config(){return config;},get connects(){return connects;},get saves(){return saves;},async settle(){await new Promise(r=>setImmediate(r));}};
}
test('optional audio starts disconnected and unsupported browsers retain routine editing',()=>{
 const p=page();assert.equal(p.connects,0);assert.equal(p.nodes.audioEdit.hidden,true);assert.equal(p.nodes.audioUpload.disabled,true);assert.equal(p.nodes.audioEdit.disabled,true);assert.equal(p.config.jawEnabled,false);
 const q=page({supported:false});assert.equal(q.nodes.audioConnect.disabled,true);assert.match(q.nodes.audioMessage.textContent,/cannot connect directly/);assert.equal(q.config.headEnabled,true);
});
test('USB connection blocks direct BLE preparation without opening another controller',async()=>{const p=page({usb:true});p.nodes.audioConnect.onclick();await p.settle();assert.equal(p.connects,0);assert.match(p.nodes.audioMessage.textContent,/Close the ESP32 USB session/);});
test('read device identity plus explicit estimate configures editor only and audio can be turned off',async()=>{
 const p=page();p.nodes.audioConnect.onclick();await p.settle();assert.equal(p.nodes.audioEdit.hidden,false);assert.equal(p.nodes.audioFileSelect.value,'27:45:Greeting.mp3');
 p.nodes.audioUse.onclick();assert.equal(p.config.jawEnabled,false);p.nodes.audioGuard.value='28';p.nodes.audioUse.onclick();
 assert.equal(p.config.jawFile,27);assert.equal(p.config.eyeJawMode,3);assert.equal(p.config.jawClipSec,28);assert.equal(p.config.overlap,false);assert.equal(p.config.eyesEnabled,true);assert.equal(p.config.lightsEnabled,true);assert.equal(p.saves,0);assert.match(p.nodes.audioMessage.textContent,/added to the editor/);
 p.nodes.audioOff.onclick();assert.equal(p.config.jawEnabled,false);assert.equal(p.config.eyeJawMode,1);assert.equal(p.config.headMin,35);
});
test('clip appearance draft and copy do not change regular routine; read-back failure is never saved',async()=>{
 const p=page({saveError:true});p.nodes.audioConnect.onclick();await p.settle();const before=JSON.stringify(p.config);p.nodes.audioCopyLook.onclick();assert.equal(JSON.stringify(p.config),before);
 p.nodes.audioSaveLook.onclick();await p.settle();assert.equal(p.saves,1);assert.match(p.nodes.audioMessage.textContent,/did not match read-back/);assert.equal(p.nodes.audioMessage.dataset.state,'error');assert.equal(JSON.stringify(p.config),before);
});
test('valid clip look save preserves a manually entered estimate and reports software read-back scope',async()=>{
 const p=page();p.nodes.audioConnect.onclick();await p.settle();p.nodes.audioGuard.value='38';p.nodes.audioSaveLook.onclick();await p.settle();assert.equal(p.nodes.audioGuard.value,'38');assert.match(p.nodes.audioMessage.textContent,/Physical playback still needs/);
 p.nodes.audioDisconnect.onclick();assert.equal(p.nodes.audioEdit.hidden,true);assert.equal(p.nodes.audioGuard.value,'');assert.equal(p.window.SkellyAudioConnection(),false);
});

test('saved scene previews name the selected audio file instead of a generic jaw action',()=>{
 const g=generator,model=require('../scene-model.js'),config=a.audioRoutine({...g.DEFAULTS},{serial:27},32,180,300);
 const value={scenes:[{name:'Greeting',seconds:600,profile:JSON.parse(g.createProfile(config,{}))}],rotate:false};
 const preview=model.routinePreview(value,g);assert.equal(preview[0].lanes.find(x=>x.kind==='jaw').label,'Audio #27');
});

test('copying a rotating regular look uses its first selected palette and audio edits clear personality selection',async()=>{
 const p=page();p.nodes.audioConnect.onclick();await p.settle();p.window.SkellyStudioGenerator.writeConfig({lightRotation:true,lightPalettes:[2,3],palette2Torso:'#123456',palette2Head:'#abcdef',eyeChoices:[5,8]});
 p.nodes.audioCopyLook.onclick();assert.equal(p.nodes.audioTorsoColor.value,'#123456');assert.equal(p.nodes.audioHeadColor.value,'#abcdef');assert.equal(p.nodes.audioEye.value,5);assert.equal(p.chosen,true);p.nodes.audioSaveLook.onclick();await p.settle();
 p.nodes.audioGuard.value='32';p.nodes.audioUse.onclick();assert.equal(p.chosen,false);assert.equal(p.config.eyeJawMode,3);
});

test('unsaved clip edits cannot schedule the device’s previous movement flags',async()=>{
 const p=page();p.nodes.audioConnect.onclick();await p.settle();p.nodes.audioGuard.value='32';p.nodes.audioHead.checked=false;p.nodes.audioUse.onclick();
 assert.equal(p.config.jawEnabled,false);assert.equal(p.chosen,true);assert.match(p.nodes.audioMessage.textContent,/Save clip look to Skelly/);assert.equal(p.saves,0);assert.equal(p.nodes.audioClipLook.open,true);
 p.nodes.audioSaveLook.onclick();await p.settle();p.nodes.audioUse.onclick();assert.equal(p.config.eyeJawMode,3);assert.equal(p.config.jawEnabled,true);
});

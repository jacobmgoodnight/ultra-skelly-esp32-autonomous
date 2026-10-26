const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../talkback.html'),'utf8'),source=fs.readFileSync(path.join(__dirname,'../talkback-ui.js'),'utf8');
function page({supported=true,bluetooth=true,chooser=true,enumeration=true,sink=true,devices=[],enumerationError=false}={}){
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],{disabled:false,checked:false,hidden:m[1]==='outputField',dataset:{},textContent:'',value:m[1]==='propName'?'Ultra Skelly v2':'',children:[],replaceChildren(...children){this.children=children;},get selectedOptions(){return this.children.filter(o=>o.value===this.value);}}]));
 const events={},windowEvents={},calls=[];let repeat,live,resolveOutput;
 class Repeat{constructor({onChange}){repeat=this;this.state='idle';this.message='Ready';this.stream=null;this.render=onChange;}record(){calls.push('record');this.state='recording';this.stream={};this.render();}finish(){this.state='ready';this.stream=null;this.render();}play(){calls.push('play');}stop(){calls.push('stop');this.state='idle';this.stream=null;this.render();}}
 class Live{constructor(){live=this;}cancel(){calls.push('cancel');}async enable(name){calls.push('enable:'+name);return 'Transport only';}}
 const document={hidden:false,createElement:()=>({}),getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},addEventListener:(name,fn)=>events[name]=fn};
 const window={isSecureContext:supported,MediaRecorder:supported?{}:null,SkellyTalkback:{RepeatBack:Repeat,LiveLink:Live},SkellyAudio:{frame(){}},addEventListener:(name,fn)=>windowEvents[name]=fn};
 const navigator={bluetooth:bluetooth?{}:null,mediaDevices:{getUserMedia(){}}};
 if(chooser)navigator.mediaDevices.selectAudioOutput=()=>new Promise(r=>resolveOutput=r);
 if(enumeration)navigator.mediaDevices.enumerateDevices=async()=>{calls.push('enumerate');if(enumerationError)throw Error('unavailable');return devices;};
 vm.runInNewContext(source,{document,window,navigator,HTMLMediaElement:{prototype:sink?{setSinkId(){}}:{}}});
 return {nodes,calls,events,windowEvents,document,repeat,live,media:navigator.mediaDevices,resolveOutput:device=>resolveOutput(device)};
}
test('isolated page is idle on load, never enables Bluetooth before consent, and locks setup during capture',async()=>{
 const p=page();assert.deepEqual(p.calls,[]);assert.equal(p.nodes.enableLive.disabled,true);assert.equal(p.nodes.repeat.disabled,true);
 await p.nodes.enableLive.onclick();assert.deepEqual(p.calls,[]);
 p.nodes.isolated.checked=true;p.nodes.isolated.onchange();assert.equal(p.nodes.enableLive.disabled,false);
 p.nodes.record.onclick();assert.equal(p.nodes.enableLive.disabled,true);assert.equal(p.nodes.chooseOutput.disabled,true);assert.equal(p.nodes.micState.textContent,'Microphone ON');
 p.nodes.finish.onclick();assert.equal(p.nodes.repeat.disabled,false);assert.equal(p.nodes.micState.textContent,'Microphone OFF');
 await p.nodes.enableLive.onclick();assert.ok(p.calls.includes('enable:Ultra Skelly v2'));assert.equal(p.nodes.liveStatus.textContent,'Transport only');
});
test('hiding or leaving the page stops capture and cancels live setup',()=>{
 const p=page();p.nodes.record.onclick();p.document.hidden=true;p.events.visibilitychange();assert.equal(p.repeat.state,'idle');assert.ok(p.calls.includes('cancel'));
 p.windowEvents.pagehide();assert.equal(p.nodes.micState.textContent,'Microphone OFF');
});
test('late output chooser results cannot change routing after Stop',async()=>{
 const p=page(),selection=p.nodes.chooseOutput.onclick();assert.equal(p.nodes.record.disabled,true);p.nodes.stop.onclick();p.resolveOutput({deviceId:'late',label:'Late speaker'});await selection;
 assert.notEqual(p.repeat.sink,'late');assert.equal(p.nodes.record.disabled,false);
});
test('unsupported features have clear fallback without opening microphone or Bluetooth',()=>{
 const p=page({supported:false,bluetooth:false});assert.equal(p.nodes.record.disabled,true);assert.equal(p.nodes.enableLive.disabled,true);assert.match(p.nodes.status.textContent,/HTTPS or localhost/);assert.deepEqual(p.calls,[]);
});
test('live setup preserves an accurate pre-write failure without appending a sent-request warning',async()=>{
 const p=page();p.nodes.isolated.checked=true;p.nodes.isolated.onchange();
 const message='BLE connection failed before live enable. No live-enable request was sent.';
 p.live.enable=async()=>{throw Error(message);};await p.nodes.enableLive.onclick();
 assert.equal(p.nodes.liveStatus.textContent,message);assert.equal(p.nodes.enableLive.disabled,false);
});
test('Chrome/Edge fallback lists only outputs and keeps selection explicit',async()=>{
 const p=page({chooser:false,devices:[{kind:'audioinput',deviceId:'mic',label:'Microphone'},{kind:'audiooutput',deviceId:'speaker',label:'USB speaker <test>'}]});
 assert.equal(p.nodes.chooseOutput.disabled,false);await p.nodes.chooseOutput.onclick();
 assert.equal(p.nodes.outputField.hidden,false);assert.equal(p.nodes.speakerSelect.children.length,2);
 assert.equal(p.nodes.speakerSelect.children[1].textContent,'USB speaker <test>');assert.equal(p.repeat.sink,undefined);
 p.nodes.speakerSelect.value='speaker';p.nodes.speakerSelect.onchange();assert.equal(p.repeat.sink,'speaker');
 p.nodes.record.onclick();assert.equal(p.nodes.speakerSelect.disabled,true);assert.deepEqual(p.calls,['enumerate','record']);
});
test('a late enumerated device list cannot reopen selection after Stop',async()=>{
 const p=page({chooser:false});let resolve;
 p.media.enumerateDevices=()=>new Promise(r=>resolve=r);
 const selection=p.nodes.chooseOutput.onclick();p.nodes.stop.onclick();resolve([{kind:'audiooutput',deviceId:'late',label:'Late'}]);await selection;
 assert.equal(p.nodes.outputField.hidden,true);assert.equal(p.nodes.speakerSelect.children.length,0);assert.equal(p.nodes.record.disabled,false);
});
test('output enumeration explains missing permission or failure and never silently changes a prior sink',async()=>{
 const empty=page({chooser:false});await empty.nodes.chooseOutput.onclick();assert.match(empty.nodes.outputLabel.textContent,/allow microphone access/);
 const p=page({chooser:false});p.repeat.sink='disconnected';await p.nodes.chooseOutput.onclick();assert.equal(p.repeat.sink,'disconnected');assert.match(p.nodes.outputLabel.textContent,/unavailable/);
 p.nodes.speakerSelect.value='';p.nodes.speakerSelect.onchange();assert.equal(p.repeat.sink,'');
 const failed=page({chooser:false,enumerationError:true});await failed.nodes.chooseOutput.onclick();assert.equal(failed.nodes.record.disabled,false);assert.match(failed.nodes.outputLabel.textContent,/Previous output kept/);
 const unsupported=page({chooser:false,enumeration:false,sink:false});assert.equal(unsupported.nodes.chooseOutput.disabled,true);assert.match(unsupported.nodes.outputLabel.textContent,/computer sound settings/);
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../talkback.html'),'utf8'),source=fs.readFileSync(path.join(__dirname,'../talkback-ui.js'),'utf8');
function page({supported=true,bluetooth=true}={}){
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],{disabled:false,checked:false,dataset:{},textContent:'',value:'Ultra Skelly v2'}]));
 const events={},windowEvents={},calls=[];let repeat,live,resolveOutput;
 class Repeat{constructor({onChange}){repeat=this;this.state='idle';this.message='Ready';this.stream=null;this.render=onChange;}record(){calls.push('record');this.state='recording';this.stream={};this.render();}finish(){this.state='ready';this.stream=null;this.render();}play(){calls.push('play');}stop(){calls.push('stop');this.state='idle';this.stream=null;this.render();}}
 class Live{constructor(){live=this;}cancel(){calls.push('cancel');}async enable(name){calls.push('enable:'+name);return 'Transport only';}}
 const document={hidden:false,getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},addEventListener:(name,fn)=>events[name]=fn};
 const window={isSecureContext:supported,MediaRecorder:supported?{}:null,SkellyTalkback:{RepeatBack:Repeat,LiveLink:Live},SkellyAudio:{frame(){}},addEventListener:(name,fn)=>windowEvents[name]=fn};
 const navigator={bluetooth:bluetooth?{}:null,mediaDevices:{getUserMedia(){},selectAudioOutput:()=>new Promise(r=>resolveOutput=r)}};
 vm.runInNewContext(source,{document,window,navigator,HTMLMediaElement:{prototype:{setSinkId(){}}}});
 return {nodes,calls,events,windowEvents,document,repeat,live,resolveOutput:device=>resolveOutput(device)};
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

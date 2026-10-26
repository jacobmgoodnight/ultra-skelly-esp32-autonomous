const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../talkback.html'),'utf8'),source=fs.readFileSync(path.join(__dirname,'../talkback-ui.js'),'utf8');
function page({supported=true,bluetooth=true,chooser=true,enumeration=true,sink=true,devices=[],enumerationError=false,autoAvailable=true}={}){
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],{disabled:false,checked:false,hidden:['outputField','inputField'].includes(m[1]),dataset:{},textContent:'',value:m[1]==='propName'?'Ultra Skelly v2':m[1]==='sensitivity'?'0.025':'',children:[],replaceChildren(...children){this.children=children;},get selectedOptions(){return this.children.filter(o=>o.value===this.value);}}]));
 const events={},windowEvents={},mediaEvents={},calls=[];let repeat,live,auto,resolveOutput;
 class Repeat{constructor({onChange}){repeat=this;this.input='';this.state='idle';this.message='Ready';this.stream=null;this.render=onChange;}record(){calls.push('record');this.state='recording';this.stream={getAudioTracks:()=>[{label:'Laptop microphone'}]};this.render();}finish(){this.state='ready';this.stream=null;this.render();}play(){calls.push('play');}stop(){calls.push('stop');this.state='idle';this.stream=null;this.render();}}
 class Live{constructor(){live=this;}cancel(){calls.push('cancel');}async enable(name){calls.push('enable:'+name);return 'Transport only';}}
 class Auto{constructor({onChange,onLevel}){auto=this;this.active=false;this.message='Off';this.render=onChange;this.level=onLevel;}async start(threshold){calls.push('auto:'+threshold);this.active=true;this.phase='calibrating';this.capture={stream:{}};this.render();}stop(message='Stopped'){this.active=false;this.capture=null;this.message=message;repeat.stop();this.render();}changed(){}}
 const document={hidden:false,createElement:()=>({}),getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},addEventListener:(name,fn)=>events[name]=fn};
 const window={isSecureContext:supported,MediaRecorder:supported?{}:null,AudioContext:supported?{}:null,AudioWorkletNode:supported?{}:null,SkellyTalkbackAuto:autoAvailable?{AutomaticRepeat:Auto}:undefined,SkellyTalkback:{RepeatBack:Repeat,LiveLink:Live},SkellyAudio:{frame(){}},addEventListener:(name,fn)=>windowEvents[name]=fn};
 const navigator={bluetooth:bluetooth?{}:null,mediaDevices:{getUserMedia(){},addEventListener:(name,fn)=>mediaEvents[name]=fn}};
 if(chooser)navigator.mediaDevices.selectAudioOutput=()=>new Promise(r=>resolveOutput=r);
 if(enumeration)navigator.mediaDevices.enumerateDevices=async()=>{calls.push('enumerate');if(enumerationError)throw Error('unavailable');return devices;};
 vm.runInNewContext(source,{document,window,navigator,HTMLMediaElement:{prototype:sink?{setSinkId(){}}:{}}});
 return {nodes,calls,events,windowEvents,mediaEvents,document,repeat,live,auto,media:navigator.mediaDevices,resolveOutput:device=>resolveOutput(device)};
}
test('isolated page is idle on load, never enables Bluetooth before consent, and locks setup during capture',async()=>{
 const p=page();assert.deepEqual(p.calls,[]);assert.equal(p.nodes.enableLive.disabled,true);assert.equal(p.nodes.repeat.disabled,true);
 await p.nodes.enableLive.onclick();assert.deepEqual(p.calls,[]);
 p.nodes.isolated.checked=true;p.nodes.isolated.onchange();assert.equal(p.nodes.enableLive.disabled,false);
 p.nodes.record.onclick();assert.equal(p.nodes.enableLive.disabled,true);assert.equal(p.nodes.chooseOutput.disabled,true);assert.equal(p.nodes.chooseInput.disabled,true);assert.equal(p.nodes.micState.textContent,'Microphone ON · Laptop microphone');
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
test('automatic pilot requires explicit attendance, locks manual controls and stops on hide or device changes',async()=>{
 for(const mode of ['stop','hide','device']){
  const p=page();assert.equal(p.nodes.startAuto.disabled,true);p.nodes.autoConsent.checked=true;p.nodes.autoConsent.onchange();
  assert.equal(p.nodes.startAuto.disabled,false);p.nodes.startAuto.onclick();assert.equal(p.auto.active,true);assert.equal(p.nodes.micState.textContent,'Microphone ON');
  for(const id of ['record','repeat','chooseOutput','speakerSelect','chooseInput','microphoneSelect','enableLive','sensitivity'])assert.equal(p.nodes[id].disabled,true,id);
  if(mode==='stop')p.nodes.stop.onclick();if(mode==='hide'){p.document.hidden=true;p.events.visibilitychange();}if(mode==='device')p.mediaEvents.devicechange();
  assert.equal(p.auto.active,false);assert.equal(p.nodes.micState.textContent,'Microphone OFF');assert.equal(p.nodes.record.disabled,false);
 }
 assert.equal(page({supported:false}).nodes.startAuto.disabled,true);
 const fallback=page({autoAvailable:false});assert.equal(fallback.nodes.startAuto.disabled,true);assert.equal(fallback.nodes.record.disabled,false);fallback.nodes.record.onclick();assert.ok(fallback.calls.includes('record'));
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
test('microphone selection lists inputs without recording and applies only an explicit choice',async()=>{
 const p=page({devices:[{kind:'audiooutput',deviceId:'speaker',label:'Speaker'},{kind:'audioinput',deviceId:'laptop',label:'Laptop <mic>'}]});
 await p.nodes.chooseInput.onclick();assert.deepEqual(p.calls,['enumerate']);assert.equal(p.nodes.inputField.hidden,false);assert.equal(p.nodes.microphoneSelect.children.length,2);
 assert.equal(p.nodes.microphoneSelect.children[1].textContent,'Laptop <mic>');assert.equal(p.repeat.input,'');
 p.nodes.microphoneSelect.value='laptop';p.nodes.microphoneSelect.onchange();assert.equal(p.repeat.input,'laptop');assert.match(p.nodes.inputLabel.textContent,/next manual recording or automatic pilot/);
 p.nodes.record.onclick();p.nodes.microphoneSelect.value='';p.nodes.microphoneSelect.onchange();assert.equal(p.repeat.input,'laptop');
 const unsupported=page({enumeration:false});assert.equal(unsupported.nodes.chooseInput.disabled,true);assert.match(unsupported.nodes.inputLabel.textContent,/computer input settings/);
});
test('microphone enumeration preserves missing inputs and ignores results after Stop, hide or device changes',async()=>{
 const missing=page();missing.repeat.input='gone';await missing.nodes.chooseInput.onclick();assert.equal(missing.repeat.input,'gone');assert.match(missing.nodes.inputLabel.textContent,/unavailable/);
 const empty=page();await empty.nodes.chooseInput.onclick();assert.match(empty.nodes.inputLabel.textContent,/permission/);
 const failed=page({enumerationError:true});await failed.nodes.chooseInput.onclick();assert.match(failed.nodes.inputLabel.textContent,/Previous input kept/);assert.equal(failed.nodes.record.disabled,false);
 for(const mode of ['stop','hide','device']){
  const p=page();let resolve;p.media.enumerateDevices=()=>new Promise(r=>resolve=r);const pending=p.nodes.chooseInput.onclick();assert.equal(p.nodes.record.disabled,true);
  if(mode==='stop')p.nodes.stop.onclick();if(mode==='hide'){p.document.hidden=true;p.events.visibilitychange();}if(mode==='device')p.mediaEvents.devicechange();
  resolve([{kind:'audioinput',deviceId:'late',label:'Late mic'}]);await pending;assert.equal(p.nodes.inputField.hidden,true);assert.equal(p.repeat.input,'');assert.equal(p.nodes.record.disabled,false);
 }
});
test('automatic sound meter shows input level and resets on playback, Stop and hidden page',()=>{
 for(const mode of ['playback','stop','hide']){
  const p=page();p.nodes.autoConsent.checked=true;p.nodes.autoConsent.onchange();p.nodes.startAuto.onclick();
  p.auto.level(.01,.025,'calibrating');assert.match(p.nodes.levelHint.textContent,/background/);
  p.auto.level(.08,.025,'speech');assert.equal(p.nodes.soundLevel.value,.08);assert.match(p.nodes.levelHint.textContent,/above/);
  p.auto.level(.001,.025,'waiting');assert.match(p.nodes.levelHint.textContent,/Below/);
  if(mode==='playback'){p.auto.phase='playing';p.auto.capture=null;p.auto.render();}if(mode==='stop')p.nodes.stop.onclick();if(mode==='hide'){p.document.hidden=true;p.events.visibilitychange();}
  assert.equal(p.nodes.soundLevel.value,0);assert.match(p.nodes.levelHint.textContent,/Microphone off/);
 }
});
test('voice choice is explicit and locked for active recording and automatic sessions',()=>{
 const p=page();p.nodes.voice.value='deep';p.nodes.voice.onchange();assert.equal(p.repeat.voice,'deep');p.nodes.record.onclick();assert.equal(p.nodes.voice.disabled,true);
 p.nodes.voice.value='original';p.nodes.voice.onchange();assert.equal(p.repeat.voice,'deep');p.nodes.stop.onclick();p.nodes.voice.onchange();assert.equal(p.repeat.voice,'original');
 p.nodes.autoConsent.checked=true;p.nodes.autoConsent.onchange();p.nodes.startAuto.onclick();assert.equal(p.nodes.voice.disabled,true);
});

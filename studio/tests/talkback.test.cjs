const test=require('node:test'),assert=require('node:assert/strict');
const {RepeatBack,LiveLink,RECORD_MS,MAX_BYTES}=require('../talkback.js'),{frame,crc}=require('../audio.js');
test('default browser timers keep the Window receiver instead of the engine instance',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
 const timers=new Map();let next=0,scope;
 function receiver(value){assert.ok(value===undefined||value===scope,'browser timer called with an invalid receiver');}
 const context=vm.createContext({module:{exports:{}},URL,Blob,
  setTimeout:function(fn,ms){'use strict';receiver(this);timers.set(++next,{fn,ms});return next;},
  clearTimeout:function(id){'use strict';receiver(this);timers.delete(id);}});
 scope=vm.runInContext('globalThis',context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../talkback.js'),'utf8'),context);
 const {RepeatBack:BrowserRepeat,LiveLink:BrowserLive}=context.module.exports;let requests=0;
 const repeat=new BrowserRepeat({visible:()=>true,Recorder:function(){},media:{async getUserMedia(){++requests;throw Object.assign(Error(),{name:'NotAllowedError'});}}});
 await repeat.record();assert.equal(requests,1);assert.equal(repeat.state,'error');assert.match(repeat.message,/permission denied/);assert.equal(timers.size,0);
 const live=new BrowserLive({async requestDevice(){throw Error('chooser dismissed');}},frame);
 await assert.rejects(live.enable('Ultra Skelly v2'),e=>e.stage==='chooser'&&!e.writeAttempted&&e.cause.message==='chooser dismissed');assert.equal(live.busy,false);assert.equal(timers.size,0);
});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture({pending=false,deny=false,playFails=false,sinkPending=false}={}){
 const timers=new Map(),events=[],request=deferred(),sink=deferred();let next=0,recorder,audio;
 const track={stopped:false,onended:null,stop(){this.stopped=true;}},stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 class Recorder{
  static isTypeSupported(t){return t==='audio/webm;codecs=opus';}
  constructor(s,options){assert.equal(s,stream);this.mimeType=options.mimeType;this.state='inactive';recorder=this;}
  start(ms){assert.equal(ms,250);this.state='recording';}
  stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['voice'])});this.onstop?.();});}
 }
 let visible=true;
 const engine=new RepeatBack({media:{getUserMedia:async options=>{events.push('mic');assert.equal(options.video,false);if(deny)throw Object.assign(Error(),{name:'NotAllowedError'});return pending?request.promise:stream;}},Recorder,
  visible:()=>visible,setTimer:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimer:id=>timers.delete(id),
  urls:{createObjectURL:()=>{events.push('url');return 'blob:clip';},revokeObjectURL:u=>events.push('revoke:'+u)},
  audioFactory:()=>audio={onended:null,onerror:null,src:'',async setSinkId(id){events.push('sink:'+id);if(sinkPending)await sink.promise;},async play(){assert.equal(track.stopped,true,'microphone must be released before playback');events.push('play');if(playFails)throw Error();},pause(){events.push('pause');},removeAttribute(){this.src='';},load(){}},onChange:()=>{}});
 return {engine,timers,events,track,stream,request,sink,get recorder(){return recorder;},get audio(){return audio;},hide(){visible=false;engine.stop();},fire(ms){const entry=[...timers.entries()].find(([,t])=>t.ms===ms);assert.ok(entry,'timer '+ms);timers.delete(entry[0]);entry[1].fn();}};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('manual recording is bounded, releases microphone before explicit playback and revokes URLs',async()=>{
 const p=fixture();assert.deepEqual(p.events,[]);await p.engine.record();assert.equal(p.engine.state,'recording');assert.equal(p.events.includes('play'),false);
 p.fire(RECORD_MS);await tick();assert.equal(p.engine.state,'ready');assert.equal(p.track.stopped,true);assert.equal(p.events.includes('play'),false);
 await p.engine.play();assert.equal(p.engine.state,'playing');await p.engine.record();assert.equal(p.events.filter(e=>e==='mic').length,1);
 p.audio.onended();assert.equal(p.engine.state,'ready');assert.ok(p.events.includes('revoke:blob:clip'));assert.equal(p.timers.size,0);
 p.engine.stop();assert.equal(p.engine.clip,null);
});
test('stop or hidden page discards pending permission results and stops every late track',async()=>{
 for(const mode of ['stop','hide','timeout']){
  const p=fixture({pending:true}),starting=p.engine.record();await tick();
  if(mode==='hide')p.hide();else if(mode==='timeout')p.fire(30000);else p.engine.stop();
  p.request.resolve(p.stream);await starting;assert.equal(p.track.stopped,true);assert.equal(p.engine.clip,null);assert.equal(p.recorder,undefined);assert.equal(p.timers.size,0);
 }
});
test('permission errors, empty clips, recorder errors and excess bytes fail closed',async()=>{
 const denied=fixture({deny:true});await denied.engine.record();assert.equal(denied.engine.state,'error');assert.equal(denied.timers.size,0);
 for(const fault of ['empty','error','oversize','unplug','stopTimeout']){
  const p=fixture();await p.engine.record();
  if(fault==='empty')p.recorder.onstop();
  if(fault==='error')p.recorder.onerror();
  if(fault==='oversize')p.recorder.ondataavailable({data:new Blob([new Uint8Array(MAX_BYTES+1)])});
  if(fault==='unplug')p.track.onended();
  if(fault==='stopTimeout'){p.recorder.stop=()=>{};p.engine.finish();p.fire(3000);}
  await tick();assert.equal(p.engine.state,'error',fault);assert.equal(p.engine.clip,null);assert.equal(p.track.stopped,true);assert.equal(p.timers.size,0);
 }
});
test('discard while recording ignores final recorder events; duplicate record requests do nothing',async()=>{
 const p=fixture();await p.engine.record();await p.engine.record();const late=p.recorder.onstop;p.engine.stop();late();await tick();
 assert.equal(p.events.filter(e=>e==='mic').length,1);assert.equal(p.engine.clip,null);assert.equal(p.engine.state,'idle');
});
test('play rejection, media error and playback deadline release audio and discard the clip',async()=>{
 for(const fault of ['reject','error','timeout']){
  const p=fixture({playFails:fault==='reject'});await p.engine.record();p.engine.finish();await tick();await p.engine.play();
  if(fault==='error')p.audio.onerror();if(fault==='timeout')p.fire(15000);
  assert.equal(p.engine.state,'error');assert.equal(p.engine.clip,null);assert.equal(p.audio.src,'');assert.equal(p.timers.size,0);assert.ok(p.events.includes('revoke:blob:clip'));
 }
});
test('cancellation during output selection cannot start late playback',async()=>{
 const p=fixture({sinkPending:true});await p.engine.record();p.engine.finish();await tick();p.engine.sink='chosen-output';
 const playing=p.engine.play();p.engine.stop();p.sink.resolve();await playing;assert.equal(p.events.includes('play'),false);assert.equal(p.engine.clip,null);
});
test('audio construction failure and a late play resolution leave no active playback',async()=>{
 const broken=fixture();await broken.engine.record();broken.engine.finish();await tick();
 broken.engine.audioFactory=()=>{throw Error('audio unavailable');};await broken.engine.play();
 assert.equal(broken.engine.state,'error');assert.equal(broken.engine.clip,null);assert.equal(broken.timers.size,0);
 const p=fixture(),pending=deferred();await p.engine.record();p.engine.finish();await tick();
 const factory=p.engine.audioFactory;p.engine.audioFactory=()=>{const audio=factory();audio.play=()=>pending.promise;return audio;};
 const playing=p.engine.play();p.engine.stop();const pauses=p.events.filter(e=>e==='pause').length;
 pending.resolve();await playing;assert.equal(p.engine.state,'idle');assert.equal(p.audio.src,'');
 assert.equal(p.events.filter(e=>e==='pause').length,pauses+1);assert.equal(p.timers.size,0);
});
function liveFixture({hold=''}={}){
 const wait=deferred(),writes=[],filters=[];let selected=false;
 const server={connected:false,disconnect(){this.connected=false;},async connect(){if(hold==='connect')await wait.promise;this.connected=true;return this;},async getPrimaryService(id){assert.match(id,/ae00/);return {async getCharacteristic(id){assert.match(id,/ae01/);if(hold==='writer')await wait.promise;return {async writeValueWithoutResponse(bytes){writes.push([...bytes]);if(hold==='write')await wait.promise;}};}};}};
 const device={name:'Ultra Skelly v2',gatt:server},bluetooth={async requestDevice(options){filters.push(options.filters);if(hold==='chooser')await wait.promise;selected=true;return device;}};
 const live=new LiveLink(bluetooth,frame);return {live,server,writes,filters,wait,get selected(){return selected;}};
}
test('live setup sends exactly one correctly checksummed AAFD request and releases BLE',async()=>{
 const p=liveFixture();assert.equal(p.selected,false);const message=await p.live.enable('Ultra Skelly v2');
 assert.deepEqual(p.filters,[[{name:'Ultra Skelly v2'}]]);assert.equal(p.writes.length,1);const bytes=p.writes[0];assert.deepEqual(bytes.slice(0,3),[0xaa,0xfd,1]);assert.equal(bytes.length,11);assert.equal(bytes[10],crc(bytes.slice(0,10)));
 assert.match(message,/unverified/);assert.equal(p.server.connected,false);assert.equal(p.live.busy,false);
});
test('cancel at chooser, connection or discovery prevents writes and closes late connections',async()=>{
 for(const hold of ['chooser','connect','writer']){
  const p=liveFixture({hold}),job=p.live.enable('Ultra Skelly v2');await tick();p.live.cancel();p.wait.resolve();await assert.rejects(job,/cancelled/);await tick();
  assert.deepEqual(p.writes,[]);assert.equal(p.server.connected,false);assert.equal(p.live.busy,false);
 }
});
test('live setup excludes 12-foot model, invalid names and unavailable Bluetooth',async()=>{
 const p=liveFixture();for(const name of ['', '12ft Skelly','x'.repeat(49),'bad\nname'])await assert.rejects(p.live.enable(name));assert.equal(p.selected,false);
 await assert.rejects(new LiveLink(null,frame).enable('Ultra Skelly v2'),/Web Bluetooth/);
});
test('live setup timeout disconnects late connections; failed writes are never retried',async()=>{
 const p=liveFixture({hold:'connect'}),timers=new Map();let next=0;
 p.live.setTimer=(fn,ms)=>{timers.set(++next,{fn,ms});return next;};p.live.clearTimer=id=>timers.delete(id);
 const job=p.live.enable('Ultra Skelly v2');await tick();
 [...timers.values()].find(t=>t.ms===10000).fn();await assert.rejects(job,/timed out/);
 p.wait.resolve();await tick();assert.equal(p.server.connected,false);assert.deepEqual(p.writes,[]);assert.equal(timers.size,0);
 const failed=liveFixture();let writes=0;
 failed.server.getPrimaryService=async()=>({getCharacteristic:async()=>({writeValueWithoutResponse:async()=>{++writes;throw Error('write failed');}})});
 await assert.rejects(failed.live.enable('Ultra Skelly v2'),e=>e.stage==='write'&&e.writeAttempted&&e.cause.message==='write failed');
 assert.equal(writes,1);assert.equal(failed.live.busy,false);assert.equal(failed.server.connected,false);
});
test('connection and discovery failures identify the stage and confirm no enable write was attempted',async()=>{
 for(const stage of ['connection','service','writer']){
  const p=liveFixture(),progress=[];p.live.onChange=message=>progress.push(message);
  if(stage==='connection')p.server.connect=async()=>{throw Error('Connection Error: Connection attempt failed.');};
  if(stage==='service')p.server.getPrimaryService=async()=>{throw Error('service missing');};
  if(stage==='writer')p.server.getPrimaryService=async()=>({getCharacteristic:async()=>{throw Error('writer missing');}});
  await assert.rejects(p.live.enable('Ultra Skelly v2'),e=>{
   assert.equal(e.stage,stage);assert.equal(e.writeAttempted,false);assert.equal(e.writeCompleted,false);
   assert.match(e.message,/No live-enable request was sent/);assert.doesNotMatch(e.message,/may have reached/);return true;
  });
  assert.equal(p.writes.length,0);assert.equal(p.server.connected,false);assert.equal(p.live.busy,false);assert.ok(progress.some(m=>m.includes('Step 2 of 4')));
 }
});
test('cancellation after an enable write reports uncertainty and never retries',async()=>{
 const p=liveFixture({hold:'write'}),job=p.live.enable('Ultra Skelly v2');await tick();assert.equal(p.writes.length,1);
 p.live.cancel();await assert.rejects(job,e=>e.cancelled&&e.stage==='write'&&e.writeAttempted&&/may have reached/.test(e.message));
 p.wait.resolve();await tick();assert.equal(p.writes.length,1);assert.equal(p.server.connected,false);
});
test('a completed enable write followed by a disconnect remains a transport-only result',async()=>{
 const p=liveFixture();p.server.getPrimaryService=async()=>({getCharacteristic:async()=>({writeValueWithoutResponse:async bytes=>{p.writes.push([...bytes]);p.server.connected=false;}})});
 const message=await p.live.enable('Ultra Skelly v2');assert.match(message,/write completed; Skelly disconnected afterward/);assert.match(message,/unverified/);
 assert.equal(p.writes.length,1);assert.equal(p.live.writeCompleted,true);
});

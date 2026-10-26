const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {SpeechGate,PcmCapture,AutomaticRepeat,wav,RATE,PHRASE_SAMPLES,SESSION_MS,PAUSE_MS,WORKLET}=require('../talkback-auto.js');
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const block=value=>new Float32Array(1024).fill(value);
function phrase(send){for(let i=0;i<18;i++)send(block(0));for(let i=0;i<9;i++)send(block(.1));for(let i=0;i<13;i++)send(block(0));}
test('speech gate calibrates, retains the beginning, ends on silence, caps speech and ignores clicks',()=>{
 const gate=new SpeechGate(),results=[];phrase(samples=>results.push(gate.push(samples)));
 const result=results.find(r=>r.kind==='phrase');assert.ok(result);assert.ok(result.samples.some(s=>s>.09));assert.equal(result.samples[0],0);
 assert.ok(result.samples.length<PHRASE_SAMPLES);assert.equal(gate.chunks.length,0);
 const continuous=new SpeechGate();for(let i=0;i<16;i++)continuous.push(block(0));let capped;
 for(let i=0;i<150&&!capped;i++){const r=continuous.push(block(.1));if(r.kind==='phrase')capped=r;}
 assert.equal(capped.samples.length,PHRASE_SAMPLES);
 const quiet=new SpeechGate();for(let i=0;i<200;i++)assert.notEqual(quiet.push(block(i===20?.1:0)).kind,'phrase');assert.ok(quiet.preSamples<=RATE/4);
 const noisy=new SpeechGate();assert.throws(()=>{for(let i=0;i<16;i++)noisy.push(block(.2));},/too loud/);
 assert.throws(()=>new SpeechGate(1));assert.throws(()=>quiet.push(new Float32Array([NaN])));assert.throws(()=>quiet.push(new Float32Array(5000)));
});
test('WAV is bounded mono PCM with correct sample rate, duration and signed samples',async()=>{
 const clip=wav(new Float32Array([-1,0,1])),view=new DataView(await clip.arrayBuffer());
 assert.equal(clip.type,'audio/wav');assert.equal(view.getUint16(22,true),1);assert.equal(view.getUint32(24,true),RATE);assert.equal(view.getUint32(40,true),6);
 assert.equal(view.getInt16(44,true),-32768);assert.equal(view.getInt16(46,true),0);assert.equal(view.getInt16(48,true),32767);
 assert.throws(()=>wav(new Float32Array(PHRASE_SAMPLES+1)));assert.throws(()=>wav(new Float32Array([NaN])));
});
test('worklet accepts variable render blocks and bounds queued audio; overload is explicit',()=>{
 let Processor;const messages=[];
 class Base{constructor(){this.port={postMessage:data=>messages.push(data)};}}
 vm.runInNewContext(WORKLET,{AudioWorkletProcessor:Base,Float32Array,registerProcessor:(name,p)=>{assert.equal(name,'skelly-capture');Processor=p;}});
 const p=new Processor();for(let i=0;i<30;i++)p.process([[new Float32Array(257).fill(.2)]]);
 assert.equal(messages.length,4);assert.ok(messages.every(m=>m.samples.length===1024));assert.ok(p.pending<=4);
 p.port.onmessage();for(let i=0;i<5;i++)p.process([[new Float32Array(257)]]);
 assert.ok(messages[4].missed>0);assert.equal(p.process([]),true);
});
function pilot({pending=false,denied=false,factoryFails=false}={}){
 const timers=new Map(),captures=[],starting=deferred();let next=0,auto,visible=true;
 const repeat={state:'idle',clip:null,message:'',stop(){this.state='idle';this.clip=null;auto?.changed();},say(state,message){this.state=state;this.message=message;auto.changed();},async play(){assert.equal(captures.at(-1).stream,null,'microphone must stop before playback');assert.ok(this.clip.size>44);this.state='playing';},end(){this.say('ready','Ended');}};
 auto=new AutomaticRepeat({repeat,visible:()=>visible,onChange:()=>{},setTimer:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimer:id=>timers.delete(id),captureFactory:()=>{
  if(factoryFails)throw Error('capture unavailable');
  const capture={stream:null,stops:0,async start(send,error){this.send=send;this.error=error;if(pending)await starting.promise;if(denied)throw Object.assign(Error(),{name:'NotAllowedError'});this.stream={};return true;},stop(){this.stream=null;this.stops++;}};captures.push(capture);return capture;
 }});
 return {auto,repeat,timers,captures,starting,hide(){visible=false;auto.stop();},fire(ms){const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,'timer '+ms);timers.delete(entry[0]);entry[1].fn();},speak(){phrase(samples=>captures.at(-1).send(samples));}};
}
test('pilot releases the mic before playback, waits 45 seconds and ends after two repeats',async()=>{
 const p=pilot();assert.equal(p.captures.length,0);await p.auto.start();assert.equal(p.auto.phase,'calibrating');p.speak();
 assert.equal(p.auto.phase,'playing');assert.equal(p.repeat.state,'playing');assert.equal(p.captures[0].stream,null);assert.equal(p.auto.repeats,1);
 await p.auto.start();assert.equal(p.captures.length,1);p.repeat.end();assert.equal(p.auto.phase,'cooldown');assert.equal(p.captures.length,1);
 p.fire(PAUSE_MS);await tick();assert.equal(p.captures.length,2);p.speak();p.repeat.end();
 assert.equal(p.auto.active,false);assert.match(p.auto.message,/two phrases/);assert.equal(p.repeat.clip,null);assert.equal(p.timers.size,0);
});
test('pilot stop, session limit, silence timeout and late permission cannot resume capture or playback',async()=>{
 for(const mode of ['stop','hide','session','silence']){
  const p=pilot();await p.auto.start();if(mode==='stop')p.auto.stop();if(mode==='hide')p.hide();if(mode==='session')p.fire(SESSION_MS);if(mode==='silence')p.fire(30000);
  phrase(samples=>p.captures[0].send(samples));assert.equal(p.auto.active,false);assert.equal(p.repeat.state,'idle');assert.equal(p.timers.size,0);assert.equal(p.captures[0].stream,null);
 }
 const pending=pilot({pending:true}),job=pending.auto.start();pending.fire(30000);pending.starting.resolve();await job;
 assert.equal(pending.auto.active,false);assert.equal(pending.captures[0].stream,null);assert.equal(pending.timers.size,0);
});
test('permission, capture, invalid audio and playback errors stop the pilot without retrying',async()=>{
 for(const options of [{denied:true},{factoryFails:true}]){const p=pilot(options);await p.auto.start();assert.equal(p.auto.active,false);assert.equal(p.timers.size,0);}
 const p=pilot();await p.auto.start();p.captures[0].error(Error('Microphone disconnected'));assert.equal(p.auto.active,false);assert.match(p.auto.message,/disconnected/);
 const invalid=pilot();await invalid.auto.start();invalid.captures[0].send(new Float32Array([NaN]));assert.equal(invalid.auto.active,false);
 const playback=pilot();await playback.auto.start();playback.speak();playback.repeat.say('error','Output unavailable');assert.equal(playback.auto.active,false);assert.equal(playback.captures.length,1);
});
test('session limit and Stop during cooldown or playback clear every restart timer',async()=>{
 for(const mode of ['cooldown','playing']){
  const p=pilot();await p.auto.start();p.speak();if(mode==='cooldown')p.repeat.end();p.fire(SESSION_MS);
  p.repeat.end();assert.equal(p.auto.active,false);assert.equal(p.timers.size,0);assert.equal(p.captures.length,1);
 }
});
function captureFixture({hold='',rate=RATE,deny=false}={}){
 const wait=deferred(),events=[],track={onended:null,stop(){events.push('track stopped');}},stream={getTracks:()=>[track],getAudioTracks:()=>[track]};let context,node;
 class Context{constructor(){context=this;this.sampleRate=rate;this.state='running';this.destination={};this.audioWorklet={addModule:async()=>{if(hold==='module')await wait.promise;}};}async resume(){events.push('resume');}async close(){events.push('context closed');}createMediaStreamSource(){return {connect(){},disconnect(){events.push('source disconnected');}};}createGain(){return {gain:{value:1},connect(){},disconnect(){}};}}
 class Node{constructor(){node=this;this.port={onmessage:null,postMessage(){events.push('ack');},close(){events.push('port closed');}};}connect(){}disconnect(){events.push('node disconnected');}}
 const capture=new PcmCapture({Context,WorkletNode:Node,media:{async getUserMedia(){events.push('permission');if(deny)throw Object.assign(Error(),{name:'NotAllowedError'});if(hold==='permission')await wait.promise;return stream;}},urls:{createObjectURL:()=> 'blob:worklet',revokeObjectURL:()=>events.push('url revoked')}});
 return {capture,events,track,wait,get context(){return context;},get node(){return node;}};
}
test('PCM capture closes tracks, worklet, context and URLs, including late setup results',async()=>{
 const p=captureFixture();let blocks=0,errors=0;await p.capture.start(()=>blocks++,()=>errors++);assert.deepEqual(p.events.slice(0,2),['resume','permission']);
 p.node.port.onmessage({data:{samples:block(.1),missed:0}});assert.equal(blocks,1);assert.ok(p.events.includes('ack'));
 p.node.port.onmessage({data:{samples:block(.1),missed:1024}});assert.equal(errors,1);const lateError=p.node.onprocessorerror,lateTrack=p.track.onended;p.capture.stop();lateError();lateTrack();assert.equal(errors,1);
 for(const event of ['track stopped','context closed','node disconnected','port closed','url revoked'])assert.ok(p.events.includes(event),event);
 for(const hold of ['permission','module']){const late=captureFixture({hold}),job=late.capture.start(()=>assert.fail('late audio'),()=>{});await tick();late.capture.stop();late.wait.resolve();await job;assert.ok(late.events.includes('track stopped'));assert.equal(late.node,undefined);}
 for(const options of [{rate:48000},{deny:true}]){const failed=captureFixture(options);await assert.rejects(failed.capture.start(()=>{},()=>{}));assert.ok(failed.events.includes('context closed'));assert.equal(failed.capture.stream,null);}
});

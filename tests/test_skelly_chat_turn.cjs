const test=require('node:test'),assert=require('node:assert/strict');
const {Conversation,ThinkingCue,CueSchedule,decodeCue}=require('../experiments/pocket-conversation/chat-turn.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function wave(seconds=.1){
 const b=Buffer.alloc(44+Math.round(seconds*22050)*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(22050,24);b.writeUInt32LE(44100,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b;
}
const reply={card:0,text:'A fine treasure!',heard:'I like ghosts.',audio:wave().toString('base64')};
function fixture(){
 const timers=new Map(),network=deferred(),cueDone=deferred(),calls=[];let next=0,turn,mic=true;
 const cue={finished:Promise.resolve(),stop(){calls.push('cue-stop');cueDone.resolve();},play(){assert.equal(mic,false);calls.push('cue-play');this.finished=cueDone.promise;return this.finished;}};
 const repeat={voice:'original',state:'idle',stop(){this.state='idle';this.clip=null;turn?.changed();},say(state){this.state=state;turn?.changed();},async play(){assert.equal(mic,false);assert.ok(!calls.includes('cue-play')||calls.includes('cue-end'));calls.push('reply-play');this.state='playing';},end(){this.say('ready');}};
 turn=new Conversation({repeat,cue,visible:()=>true,now:()=>0,setTimer:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimer:id=>timers.delete(id),request:async(clip,signal)=>{assert.equal(mic,false);calls.push('request');return network.promise;}});
 turn.active=true;turn.capture={stop(){mic=false;}};turn.thinkingClip=new Blob(['cue']);turn.releaseCapture();
 const pending=turn.respond(new Blob(['input']),turn.generation);
 return {turn,repeat,network,calls,pending,timers,finishCue(){calls.push('cue-end');cueDone.resolve();},fire(ms){const found=[...timers].find(([,t])=>t.ms===ms);assert.ok(found);timers.delete(found[0]);found[1].fn();}};
}
test('one delayed cue runs with the mic off, and final audio waits without overlap',async()=>{
 const p=fixture();assert.deepEqual(p.calls,['request']);p.fire(1100);assert.deepEqual(p.calls,['request','cue-play']);
 p.network.resolve(reply);await tick();assert.equal(p.turn.phase,'thinking');assert.ok(!p.calls.includes('reply-play'));
 p.finishCue();await p.pending;assert.equal(p.turn.phase,'playing');assert.equal(p.turn.heardText,'I like ghosts.');assert.equal(p.calls.filter(x=>x==='cue-play').length,1);
 p.repeat.end();assert.equal(p.turn.active,false);assert.equal(p.turn.remaining,45);assert.equal(p.timers.size,0);
});
test('fast replies skip the cue; Stop suppresses a queued cue and all late replies',async()=>{
 const fast=fixture();fast.network.resolve(reply);await fast.pending;assert.ok(!fast.calls.includes('cue-play'));assert.ok(fast.calls.includes('reply-play'));assert.equal([...fast.timers.values()].some(t=>t.ms===1100),false);fast.turn.stop();
 for(const cueStarted of [false,true]){
  const p=fixture();if(cueStarted)p.fire(1100);p.turn.stop();p.network.resolve(reply);await p.pending;
  assert.ok(!p.calls.includes('reply-play'));assert.equal(p.turn.active,false);assert.equal(p.timers.size,0);assert.equal(p.turn.remaining,cueStarted?60:0);
 }
});
test('Stop while a complete reply waits behind the cue cannot release late playback',async()=>{
 const p=fixture();p.fire(1100);p.network.resolve(reply);await tick();p.turn.stop();await p.pending;assert.ok(!p.calls.includes('reply-play'));assert.equal(p.turn.replyText,'');assert.equal(p.turn.heardText,'');
});
test('cue WAV decoder rejects oversized, damaged and unsupported audio',()=>{
 assert.equal(decodeCue({audio:wave().toString('base64')}).type,'audio/wav');
 for(const audio of [Buffer.alloc(44),wave(2.01),Buffer.from('invalid')])assert.throws(()=>decodeCue({audio:audio.toString('base64')}));
 const damaged=wave();damaged.writeUInt32LE(0xffffffff,40);assert.throws(()=>decodeCue({audio:damaged.toString('base64')}));
 const stereo=wave();stereo.writeUInt16LE(2,22);assert.throws(()=>decodeCue({audio:stereo.toString('base64')}));
});
test('thinking remarks skip most turns, respect spacing, and rotate away from the last variation',()=>{
 let time=0;const plan=new CueSchedule({random:()=>0,now:()=>time}),clips=['a','b','c'];
 assert.equal(plan.choose(clips,true),null);assert.equal(plan.choose(clips,true),'a');
 for(let i=0;i<2;i++){time+=30000;assert.equal(plan.choose(clips,true),null);}
 assert.equal(plan.choose(clips,true),'b');assert.equal(plan.choose(clips,false),null);
 const silent=new CueSchedule({random:()=>.99,now:()=>time});for(let i=0;i<30;i++)assert.equal(silent.choose(clips,true),null);
});
test('cue playback releases URLs on Stop, completion, failure and timeout',async()=>{
 for(const exit of ['stop','ended','error','timeout','blocked']){
  const timers=new Map(),calls=[],audio={play:()=>exit==='blocked'?Promise.reject(Error()):Promise.resolve(),pause:()=>calls.push('pause'),removeAttribute(){},load(){}};
  const cue=new ThinkingCue({audioFactory:()=>audio,urls:{createObjectURL:()=> 'blob:cue',revokeObjectURL:url=>calls.push(url)},setTimer:(fn,ms)=>{timers.set(1,{fn,ms});return 1;},clearTimer:id=>timers.delete(id)});
  const finished=cue.play(new Blob(['cue']),'original');
  if(exit==='stop')cue.stop();else if(exit==='ended')audio.onended();else if(exit==='error')audio.onerror();else if(exit==='timeout')timers.get(1).fn();
  await finished;assert.ok(calls.includes('pause'));assert.ok(calls.includes('blob:cue'));assert.equal(cue.audio,null);assert.equal(timers.size,0);
 }
});
test('a late audio.play resolution after Stop is paused again and never resurrected',async()=>{
 const pending=deferred(),calls=[],audio={play:()=>pending.promise,pause:()=>calls.push('pause'),removeAttribute(){},load(){}};
 const cue=new ThinkingCue({audioFactory:()=>audio,urls:{createObjectURL:()=> 'blob:cue',revokeObjectURL(){}},setTimer:()=>1,clearTimer(){}});
 const finished=cue.play(new Blob(['cue']),'original');cue.stop();await finished;const pauses=calls.length;pending.resolve();await tick();assert.ok(calls.length>pauses);assert.equal(cue.audio,null);
});

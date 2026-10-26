const test=require('node:test'),assert=require('node:assert/strict');
const {Conversation,decodeReply,readJSON,MAX_WAV,MAX_REPLY_WAV,PAUSE_MS}=require('../conversation.js');
const {SpeechGate,wav}=require('../talkback-auto.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const valid={card:1,text:'Boo there, friend!',audio:Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(100)]).toString('base64')};
function fixture({requestError=false,holdCapture=false}={}){
 const timers=new Map(),reply=deferred(),permission=deferred(),levels=[],captures=[];let turn,next=0,clock=0,visible=true,requests=0,signal;
 const repeat={state:'idle',clip:null,stop(){this.state='idle';this.clip=null;turn?.changed();},say(state){this.state=state;turn?.changed();},async play(){assert.equal(captures.at(-1).stream,null);assert.notEqual(this.clip.type,'audio/webm');this.state='playing';},end(){this.say('ready');}};
 turn=new Conversation({repeat,gateFactory:threshold=>new SpeechGate(threshold),encode:wav,visible:()=>visible,now:()=>clock,onLevel:(...args)=>levels.push(args),
  setTimer:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimer:id=>timers.delete(id),
  captureFactory:()=>{const capture={stream:null,async start(send,error){this.send=send;this.error=error;if(holdCapture)await permission.promise;this.stream={};return true;},stop(){this.stream=null;}};captures.push(capture);return capture;},
  request:async(clip,cancel)=>{requests++;signal=cancel;assert.equal(captures.at(-1).stream,null);assert.equal(clip.type,'audio/wav');assert.ok(clip.size<=MAX_WAV);if(requestError)throw Error('service failed');return reply.promise;}});
 return {turn,repeat,timers,reply,permission,captures,levels,get requests(){return requests;},get signal(){return signal;},advance(ms){clock+=ms;},hide(){visible=false;turn.stop();},speak(){const send=value=>captures.at(-1).send(new Float32Array(1024).fill(value));for(let i=0;i<18;i++)send(0);for(let i=0;i<9;i++)send(.1);for(let i=0;i<13;i++)send(0);},fire(ms){const entry=[...timers].find(([,timer])=>timer.ms===ms);assert.ok(entry);timers.delete(entry[0]);entry[1].fn();}};
}
test('conversation releases mic, requests one guarded reply and never plays the captured phrase',async()=>{
 const p=fixture();assert.equal(p.captures.length,0);await p.turn.start();p.speak();assert.equal(p.requests,1);assert.equal(p.turn.phase,'thinking');assert.equal(p.repeat.clip,null);assert.equal(p.captures[0].stream,null);
 p.reply.resolve(valid);await tick();assert.equal(p.turn.phase,'playing');assert.equal(p.turn.replyText,valid.text);assert.equal(p.repeat.clip.size,104);
 p.repeat.end();assert.equal(p.turn.active,false);assert.equal(p.turn.remaining,45);assert.equal(p.timers.size,0);assert.equal(p.repeat.clip,null);
 await p.turn.start();assert.equal(p.captures.length,1);p.advance(PAUSE_MS);await p.turn.start();assert.equal(p.captures.length,2);p.turn.stop();
});
test('Stop, hide, timeout and device failure discard late local replies without playback',async()=>{
 for(const reason of ['stop','hide','timeout','failure']){
  const p=fixture();await p.turn.start();p.speak();if(reason==='hide')p.hide();else if(reason==='timeout')p.fire(45000);else p.turn.stop(reason);
  assert.equal(p.signal.aborted,true);p.reply.resolve(valid);await tick();assert.equal(p.turn.active,false);assert.equal(p.repeat.state,'idle');assert.equal(p.repeat.clip,null);assert.equal(p.turn.replyText,'');assert.equal(p.timers.size,0);
 }
 const pending=fixture({holdCapture:true}),job=pending.turn.start();pending.turn.stop();pending.permission.resolve();await job;assert.equal(pending.captures[0].stream,null);assert.equal(pending.requests,0);
});
test('capture silence/permission, local processing errors and invalid replies fail without raw replay',async()=>{
 const silence=fixture();await silence.turn.start();silence.fire(30000);assert.equal(silence.requests,0);assert.equal(silence.repeat.clip,null);
 const broken=fixture({requestError:true});await broken.turn.start();broken.speak();await tick();assert.equal(broken.turn.active,false);assert.equal(broken.repeat.clip,null);assert.match(broken.turn.message,/service failed/);
 for(const value of [{...valid,card:20},{...valid,audio:'not base64!'},{...valid,text:'x'.repeat(181)},{...valid,audio:Buffer.alloc(MAX_REPLY_WAV+1).toString('base64')}]){
  assert.throws(()=>decodeReply(value));const p=fixture();await p.turn.start();p.speak();p.reply.resolve(value);await tick();assert.equal(p.repeat.clip,null);assert.equal(p.turn.active,false);assert.equal(p.timers.size,0);
 }
});
test('neural reply audio has a separate bounded allowance without increasing microphone capture',()=>{
 assert.equal(MAX_WAV,256044);assert.equal(MAX_REPLY_WAV,352844);
 const reply=decodeReply({...valid,audio:Buffer.alloc(MAX_REPLY_WAV).toString('base64')});assert.equal(reply.clip.size,MAX_REPLY_WAV);
 assert.throws(()=>decodeReply({...valid,audio:Buffer.alloc(MAX_REPLY_WAV+1).toString('base64')}));
});
test('Stop during playback retains a conservative pause and no restart timer or name',async()=>{
 const p=fixture();await p.turn.start();p.speak();p.reply.resolve(valid);await tick();p.turn.stop();assert.equal(p.turn.remaining,60);assert.equal(p.turn.replyText,'');assert.equal(p.timers.size,0);
 await p.turn.start();assert.equal(p.captures.length,1);p.advance(60000);await p.turn.start();assert.equal(p.captures.length,2);p.turn.stop();
});
test('local response reader bounds streamed bytes before joining or parsing them',async()=>{
 assert.deepEqual(await readJSON(new Response('{"ready":true}')),{ready:true});
 let cancelled=false;const response=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1000));},cancel(){cancelled=true;}}));
 await assert.rejects(readJSON(response,100),/exceeded/);assert.equal(cancelled,true);
 await assert.rejects(readJSON(new Response('not json')));
});

const test=require('node:test'),assert=require('node:assert/strict');
const {ControllerState,parseStatus,connectionView}=require('../controller-state.js');
const {Session}=require('../serial.js');
const reply=(connected=1)=>({text:`USB STATUS v2 runtime=1 connected=${connected} scene=0 sequence=2 crc=42 pending=0 scans=4 connects=1 writes=3 failures=0 heap=133324 minHeap=123320 clock=0 window=1`});
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture({ignoreAbort=false}={}){
 let time=0,hidden=false,next=0;const timers=new Map(),requests=[];
 const session={port:{},operation:false,closing:false,status({timeout,signal}){
   return new Promise((resolve,reject)=>{
     const request={resolve,reject,timeout,signal};requests.push(request);
     if(!ignoreAbort)signal?.addEventListener('abort',()=>reject(Object.assign(Error('canceled'),{name:'AbortError'})),{once:true});
   });
 }};
 const state=new ControllerState(session,{now:()=>time,hidden:()=>hidden,setTimer:(fn,delay)=>{timers.set(++next,{at:time+delay,fn});return next;},clearTimer:id=>timers.delete(id)});
 state.identified=state.capable=true;state.usb='ready';state.say('Ready.');
 return {state,session,requests,timers,setHidden:v=>hidden=v,async tick(ms){time+=ms;for(const [id,t] of [...timers])if(t.at<=time){timers.delete(id);t.fn();}await flush();}};
}
test('background status starts after five idle seconds, uses eight-second timeout and never overlaps',async()=>{
 const f=fixture();f.state.schedule();await f.tick(4999);assert.equal(f.requests.length,0);await f.tick(1);
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].timeout,8000);await f.tick(15000);f.state.poll();assert.equal(f.requests.length,1);
 f.requests[0].resolve(reply());await flush();assert.equal(f.state.data.connected,1);assert.equal(f.state.receivedAt,20000);assert.equal(f.state.message,'Ready.');assert.equal(f.timers.size,1);
 await f.tick(5000);assert.equal(f.requests.length,2);await f.state.pausePolling();assert.equal(f.timers.size,0);
});
test('manual read/save work cancels polling, stays exclusive, then resumes five seconds later',async()=>{
 const f=fixture();f.state.poll();let finish;const held=new Promise(r=>finish=r);let actions=0;
 const work=f.state.run(async()=>{actions++;f.state.say('Sending settings · 40%','busy');await held;f.state.say('Saved · read-back verified.','ready');});await flush();
 assert.equal(f.requests[0].signal.aborted,true);assert.equal(actions,1);assert.equal(f.state.pollTask,null);
 assert.equal(await f.state.run(async()=>actions++),false);await f.tick(20000);assert.equal(f.requests.length,1);assert.match(f.state.message,/Sending/);
 finish();assert.equal(await work,true);assert.equal(f.state.busy,false);assert.match(f.state.message,/verified/);await f.tick(5000);assert.equal(f.requests.length,2);await f.state.pausePolling();
});
test('a late canceled status reply cannot overwrite manual progress or repopulate the snapshot',async()=>{
 const f=fixture({ignoreAbort:true});f.state.poll();f.state.pollAbort.abort();f.state.say('Waiting for current actions…','busy');
 f.requests[0].resolve(reply(0));await flush();assert.equal(f.state.data,null);assert.equal(f.state.receivedAt,null);assert.match(f.state.message,/Waiting/);await f.state.pausePolling();
});
test('page visibility pauses a pending poll and resumes with an immediate fresh request',async()=>{
 const f=fixture();f.state.poll();f.setHidden(true);await f.state.visibilityChanged();await f.tick(20000);assert.equal(f.requests.length,1);assert.equal(f.timers.size,0);
 f.setHidden(false);await f.state.visibilityChanged();await f.tick(0);assert.equal(f.requests.length,2);await f.state.pausePolling();
 f.state.suspended=true;f.state.schedule();assert.equal(f.timers.size,0);
});
test('timeout keeps USB ready, labels old Bluetooth state as last reported, and preserves operation messages',async()=>{
 const f=fixture();f.state.poll();f.requests[0].resolve(reply());await flush();const received=f.state.receivedAt;
 await f.tick(5000);f.state.say('Saved · read-back verified.','ready');f.requests[1].reject(Error('timeout'));await flush();
 assert.equal(f.state.usb,'ready');assert.equal(f.state.stale,true);assert.equal(f.state.receivedAt,received);assert.match(connectionView(f.state).skelly,/Last reported: Connected/);assert.match(f.state.message,/verified/);await f.state.pausePolling();
});
test('USB close clears diagnostics and Bluetooth becomes unknown even if the last snapshot was disconnected',async()=>{
 const f=fixture({ignoreAbort:true});f.state.poll();f.requests[0].resolve(reply(0));await flush();assert.equal(connectionView(f.state).skelly,'Not connected yet');
 await f.tick(5000);f.session.port=null;f.state.transportChanged();assert.equal(f.state.data,null);assert.equal(f.state.receivedAt,null);assert.equal(connectionView(f.state).skelly,'Unknown');
 f.requests[1].resolve(reply());await flush();assert.equal(f.state.data,null);assert.equal(f.state.identified,false);assert.equal(f.timers.size,0);
});
test('failed manual work releases the lock without retrying a mutation',async()=>{
 const f=fixture();let attempts=0;assert.equal(await f.state.run(async()=>{attempts++;throw Error('STORAGE');}),false);
 assert.equal(attempts,1);assert.equal(f.state.busy,false);assert.equal(f.state.tone,'error');assert.equal(f.state.message,'STORAGE');await f.state.pausePolling();
});
test('status parser rejects malformed snapshots instead of inventing connection or clock values',()=>{
 assert.equal(parseStatus(reply().text).scene,0);
 for(const text of ['USB STATUS v1 connected=1',reply().text+' connected=0',reply().text.replace('connected=1','connected=9'),reply().text.replace('scene=0','scene=-1'),'USB STATUS v2 connected=1'])assert.throws(()=>parseStatus(text));
});
test('manual operation waits for the real serial writer to release after canceling a background status request',async()=>{
 const s=new Session(null);let releaseWrite,released=false,manualStarted=false;
 s.port={writable:{getWriter:()=>({write:()=>new Promise(r=>releaseWrite=r),releaseLock:()=>released=true})}};
 const state=new ControllerState(s,{setTimer:()=>1,clearTimer:()=>{}});state.identified=true;state.usb='ready';state.poll();
 const work=state.run(async()=>{assert.equal(released,true);assert.equal(s.writeTask,null);manualStarted=true;});await flush();assert.equal(manualStarted,false);
 releaseWrite();await work;assert.equal(manualStarted,true);assert.equal(s.waiters.length,0);assert.equal(state.pollTask,null);await state.pausePolling();
});

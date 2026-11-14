const test=require('node:test'),assert=require('node:assert/strict');
const {ConversationSession}=require('../experiments/pocket-conversation/chat-turn.js');
function fixture(){
 let clock=0,id=0,allowed=true,starts=0;const timers=new Map(),ends=[];
 const turn={active:false,remaining:0,completed:0,phase:'idle',keepTalking:true};
 const session=new ConversationSession({turn,startTurn:async()=>{starts++;turn.active=true;turn.phase='capturing';},mayListen:()=>allowed,onEnd:(message,preserve)=>{ends.push({message,preserve});turn.active=false;},now:()=>clock,setTimer:(fn,ms)=>{timers.set(++id,{fn,at:clock+ms});return id;},clearTimer:i=>timers.delete(i)});
 async function flush(){await Promise.resolve();await Promise.resolve();}
 async function advance(ms){clock+=ms;for(const [key,t] of [...timers])if(t.at<=clock){timers.delete(key);t.fn();}await flush();}
 async function complete(){turn.active=false;turn.phase='idle';turn.completed++;session.observe();await flush();}
 return {session,turn,timers,ends,flush,advance,complete,get starts(){return starts;},set allowed(v){allowed=v;}};
}
test('sessions are explicit and six completed replies get at most six captures',async()=>{
 const f=fixture();await f.advance(5000);assert.equal(f.starts,0);f.session.begin();await f.flush();assert.equal(f.starts,1);
 for(let i=1;i<=6;i++){await f.complete();assert.equal(f.starts,i);await f.advance(1999);assert.equal(f.starts,i);await f.advance(1);assert.equal(f.starts,Math.min(6,i+1));}
 assert.equal(f.session.active,false);assert.equal(f.ends.length,1);assert.equal(f.ends[0].preserve,true);assert.equal(f.timers.size,0);
});
test('Stop cancels a pending gap and never releases a late capture',async()=>{
 const f=fixture();f.session.begin();await f.flush();await f.complete();f.session.stop();await f.advance(5000);assert.equal(f.starts,1);assert.equal(f.timers.size,0);
});
test('hidden page, lost attendance or another permission change prevents the next capture',async()=>{
 const f=fixture();f.session.begin();await f.flush();await f.complete();f.allowed=false;await f.advance(2000);assert.equal(f.starts,1);assert.equal(f.session.active,false);
});
test('silence or an incomplete failed turn ends the session without retry',async()=>{
 const f=fixture();f.session.begin();await f.flush();f.turn.active=false;f.turn.phase='idle';f.turn.message='Microphone disconnected.';f.session.observe();await f.advance(60000);assert.equal(f.starts,1);assert.equal(f.session.active,false);assert.match(f.ends[0].message,/Microphone disconnected/);
});
test('goodbye or no-question response ends after playback, and three-minute bound cancels an active turn',async()=>{
 const f=fixture();f.session.begin();await f.flush();f.turn.keepTalking=false;await f.complete();await f.advance(2000);assert.equal(f.starts,1);assert.equal(f.session.active,false);assert.equal(f.ends[0].preserve,false);
 const g=fixture();g.session.begin();await g.flush();await g.advance(180000);assert.equal(g.turn.active,false);assert.equal(g.session.active,false);assert.equal(g.starts,1);
});
test('an existing cooldown cannot be erased by enabling a session',()=>{
 const f=fixture();f.turn.remaining=30;f.session.begin();assert.equal(f.starts,0);assert.equal(f.session.active,false);
});

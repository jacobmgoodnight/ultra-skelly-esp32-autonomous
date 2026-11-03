const test=require('node:test'),assert=require('node:assert/strict');
const {LocalEvents,CHANNEL,MAX_BATCH}=require('../character-events.js');
test('events require explicit enable and publish only bounded, expiring allowlisted fields',()=>{
 const messages=[];let channels=0,closed=0,now=1000;
 const e=new LocalEvents({now:()=>now,createSession:()=> 'session-1234567890',channelFactory:name=>{assert.equal(name,CHANNEL);channels++;return {postMessage:m=>messages.push(m),close:()=>closed++};}});
 e.publish([{type:'visitor_greeted',profile:'friendly'}]);assert.equal(channels,0);assert.deepEqual(messages,[]);
 assert.equal(e.enable(),true);assert.equal(e.enable(),true);assert.equal(channels,1);
 e.publish([{type:'speaking_started',profile:'friendly',name:'Alex',text:'private'}, {type:'motor',profile:'friendly'}, {type:'visitor_greeted',profile:'bad'}]);
 assert.deepEqual(messages,[{version:1,type:'speaking_started',profile:'friendly',session:'session-1234567890',sequence:1,expiresAt:6000}]);
 now=2000;e.publish(Array.from({length:30},()=>({type:'approved_surprise',profile:'guardian'})));
 assert.equal(messages.length,1+MAX_BATCH);assert.equal(messages.at(-1).sequence,17);assert.equal(messages.at(-1).expiresAt,7000);
 e.close();e.publish([{type:'conversation_finished',profile:'friendly'}]);assert.equal(messages.length,18);assert.deepEqual(messages.at(-1),{version:1,type:'session_ended',session:'session-1234567890',sequence:18,expiresAt:7000});assert.equal(closed,1);
});
test('bad identities, missing browser support and channel errors fail closed without escaping',()=>{
 assert.equal(new LocalEvents({createSession:()=> 'bad'}).enable(),false);
 assert.equal(new LocalEvents({createSession:()=> 'session-1234567890',channelFactory:()=>{throw Error();}}).enable(),false);
 let closed=0;const e=new LocalEvents({createSession:()=> 'session-1234567890',channelFactory:()=>({postMessage(){throw Error();},close(){closed++;}})});
 assert.equal(e.enable(),true);assert.doesNotThrow(()=>e.publish([{type:'visitor_greeted',profile:'friendly'}]));assert.equal(closed,1);assert.equal(e.channel,null);
});

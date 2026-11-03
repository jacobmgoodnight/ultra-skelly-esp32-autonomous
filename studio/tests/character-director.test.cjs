const test=require('node:test'), assert=require('node:assert/strict');
const {Director,LiveDirector,PROFILES}=require('../character-director.js');
test('finite rehearsal sequence gates invalid and stale actions',()=>{
 let now=0;const d=new Director({now:()=>now,events:true});
 assert.equal(Object.keys(PROFILES).length,4);assert.equal(d.step('speak'),false);
 const token=d.generation;for(const action of ['greet','listen','think','speak','react','finish']) assert.equal(d.step(action,token),true);
 assert.deepEqual(d.drainEvents().map(x=>x.type),['speaking_started','conversation_finished']);
 assert.equal(d.step('ready'),false);d.stop();assert.equal(d.step('ready'),false);
 now=45000;assert.equal(d.step('ready'),true);assert.equal(d.step('greet',token),false);
 assert.equal(d.describe().state,'idle');assert.deepEqual(d.drainEvents(),[]);
});
test('live lifecycle follows completed browser turns, waits through cooldown and rejects stale cues',()=>{
 let now=0;const live=new LiveDirector({now:()=>now,events:true}),d=live.director,token=d.generation;
 live.setProfile('guardian');live.observe({active:true,phase:'requesting'});assert.equal(d.state,'listening');
 live.observe({active:true,phase:'thinking'});live.observe({active:true,phase:'playing'});
 live.observe({active:false,phase:'playing',completed:1,sessionActive:true,familyGreeting:true});assert.equal(d.state,'reacting');
 assert.equal(d.approvedSurprise(token),true);live.observe({active:true,phase:'requesting',completed:1});
 live.observe({active:true,phase:'thinking',completed:1});live.observe({active:true,phase:'playing',completed:1});
 live.observe({active:false,phase:'idle',completed:2,remaining:45});assert.equal(d.state,'cooldown');
 assert.deepEqual(live.drainEvents().map(e=>e.type),['speaking_started','visitor_greeted','approved_surprise','speaking_started','conversation_finished']);
 live.stop();assert.equal(d.step('ready'),false);assert.equal(d.approvedSurprise(token),false);now=45000;
 live.observe({remaining:0});assert.equal(d.state,'idle');assert.equal(d.step('greet',token),false);
});
test('interrupted browser turn enters recovery without publishing completion',()=>{
 const live=new LiveDirector({events:true});live.observe({active:true,phase:'requesting'});live.observe({active:true,phase:'thinking'});
 live.observe({active:false,phase:'idle'});assert.equal(live.describe().state,'recovery');assert.deepEqual(live.drainEvents(),[]);
});
test('selection, bounded opt-in event queue and recovery discard pending events',()=>{
 const d=new Director({events:true});assert.throws(()=>d.setProfile('unknown'));d.setProfile('guardian');
 d.step('greet');d.step('listen');for(let i=0;i<20;i++){d.step('think');d.step('speak');d.step('react');d.step('listen');}
 assert.equal(d.drainEvents().length,16);assert.throws(()=>d.setProfile('friendly'));d.stop();assert.deepEqual(d.drainEvents(),[]);
 const off=new Director();off.step('greet');assert.deepEqual(off.drainEvents(),[]);
});

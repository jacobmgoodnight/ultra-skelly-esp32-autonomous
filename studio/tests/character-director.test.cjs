const test=require('node:test'), assert=require('node:assert/strict');
const {Director,PROFILES}=require('../character-director.js');
test('finite rehearsal sequence gates invalid and stale actions',()=>{
 let now=0;const d=new Director({now:()=>now,events:true});
 assert.equal(Object.keys(PROFILES).length,4);assert.equal(d.step('speak'),false);
 const token=d.generation;for(const action of ['greet','listen','think','speak','react','finish']) assert.equal(d.step(action,token),true);
 assert.deepEqual(d.drainEvents().map(x=>x.type),['visitor_greeted','speaking_started','conversation_finished']);
 assert.equal(d.step('ready'),false);d.stop();assert.equal(d.step('ready'),false);
 now=45000;assert.equal(d.step('ready'),true);assert.equal(d.step('greet',token),false);
 assert.equal(d.describe().state,'idle');assert.deepEqual(d.drainEvents(),[]);
});
test('selection, bounded opt-in event queue and recovery discard pending events',()=>{
 const d=new Director({events:true});assert.throws(()=>d.setProfile('unknown'));d.setProfile('guardian');
 d.step('greet');d.step('listen');for(let i=0;i<20;i++){d.step('think');d.step('speak');d.step('react');d.step('listen');}
 assert.equal(d.drainEvents().length,16);assert.throws(()=>d.setProfile('friendly'));d.stop();assert.deepEqual(d.drainEvents(),[]);
 const off=new Director();off.step('greet');assert.deepEqual(off.drainEvents(),[]);
});
